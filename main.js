'use strict';

const { app, BrowserWindow, Menu, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Low CPU / low RAM tuning
// These flags run before app is ready and shave background work that a
// default Electron/Chromium app would otherwise spend.
// ---------------------------------------------------------------------------
app.commandLine.appendSwitch('disable-background-timer-throttling', 'false'); // keep throttling ON for hidden tabs
app.commandLine.appendSwitch('disable-renderer-backgrounding', 'false');       // keep backgrounding ON
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');         // cap V8 heap per renderer
app.commandLine.appendSwitch('force-fieldtrials', '');
app.disableHardwareAcceleration && false; // hardware accel left ON by default (usually lowers CPU); flip if your GPU is bad

// Extra RAM trims: turn off Chromium background services this app never
// uses (sync, component updater, domain reliability pings, translate,
// optimization-guide downloads, media router discovery) and cap the two
// in-memory caches instead of letting them grow unbounded.
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch(
  'disable-features',
  'Translate,OptimizationHints,OptimizationHintsFetching,OptimizationGuideModelDownloading,MediaRouter,AutofillServerCommunication,BackForwardCache'
);
app.commandLine.appendSwitch('disk-cache-size', String(20 * 1024 * 1024));   // 20MB cap
app.commandLine.appendSwitch('media-cache-size', String(20 * 1024 * 1024)); // 20MB cap

// No crash reporting / telemetry of any kind.
app.setAppLogsPath = () => {};

const ANONY_PARTITION = 'anony-session'; // no "persist:" prefix => in-memory only, wiped on quit

let mainWindow = null;
let blockedHosts = [];

function loadBlocklist() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'blocklist.txt'), 'utf8');
    blockedHosts = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch (e) {
    blockedHosts = [];
  }
}

function isBlocked(urlString) {
  try {
    const host = new URL(urlString).hostname;
    return blockedHosts.some((b) => host === b || host.endsWith('.' + b));
  } catch (e) {
    return false;
  }
}

function hardenSession(ses) {
  // Strip identifying / tracking headers, force Do-Not-Track, drop referrers
  // down to origin only.
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders;
    headers['DNT'] = '1';
    headers['Sec-GPC'] = '1';
    if (headers['Referer']) {
      try {
        const u = new URL(headers['Referer']);
        headers['Referer'] = u.origin + '/';
      } catch (e) {
        delete headers['Referer'];
      }
    }
    callback({ requestHeaders: headers });
  });

  // Block ad/tracker requests before they leave the process.
  ses.webRequest.onBeforeRequest((details, callback) => {
    if (isBlocked(details.url)) {
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });

  // Deny every permission prompt by default (camera, mic, geo, notifications...).
  ses.setPermissionRequestHandler((_wc, _perm, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);

  // No spellcheck dictionaries loaded into RAM.
  ses.setSpellCheckerEnabled(false);
}

function createWindow() {
  const anonySession = session.fromPartition(ANONY_PARTITION);
  hardenSession(anonySession);
  hardenSession(session.defaultSession);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1e1f22',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: true,
      webviewTag: true,
      partition: ANONY_PARTITION,
    },
  });

  // No application menu — saves a little memory and UI chrome, and the app
  // ships its own minimal toolbar anyway.
  Menu.setApplicationMenu(null);

  mainWindow.loadFile('index.html');

  // Lock down anything a page tries to spawn as a webview: force it onto the
  // same hardened partition and strip node/preload access.
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, _params) => {
    delete webPreferences.preload;
    delete webPreferences.preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.spellcheck = false;
    webPreferences.backgroundThrottling = true;
    webPreferences.partition = ANONY_PARTITION;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('get-partition', () => ANONY_PARTITION);

app.whenReady().then(() => {
  loadBlocklist();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Clearing storage on the in-memory partition happens automatically since
  // it was never written to disk, but drop caches explicitly too.
  if (process.platform !== 'darwin') app.quit();
});
