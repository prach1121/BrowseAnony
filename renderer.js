'use strict';

const tabsEl = document.getElementById('tabs');
const viewContainer = document.getElementById('view-container');
const addressEl = document.getElementById('address');
const backBtn = document.getElementById('back-btn');
const fwdBtn = document.getElementById('fwd-btn');
const reloadBtn = document.getElementById('reload-btn');
const goBtn = document.getElementById('go-btn');
const newTabBtn = document.getElementById('new-tab-btn');

const HOME_URL = 'https://duckduckgo.com/';

// A hidden tab's <webview> (its own renderer process, its own chunk of RAM)
// is torn down after this long. Reopening it just reloads the URL. Lower
// this for a stricter/leaner box, raise it if switching tabs feels laggy.
const SUSPEND_AFTER_MS = 60 * 1000;
const SUSPEND_CHECK_INTERVAL_MS = 15 * 1000;

let tabs = [];      // { id, tabEl, webview, title, url, suspended, lastHiddenAt }
let activeId = null;
let nextId = 1;

function normalizeInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return HOME_URL;
  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ||
                       (/^[\w-]+(\.[\w-]+)+([/:?#].*)?$/i.test(trimmed) && !trimmed.includes(' '));
  if (looksLikeUrl) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
  }
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(trimmed);
}

function buildWebview(tab) {
  const webview = document.createElement('webview');
  webview.setAttribute('partition', window.__ANONY_PARTITION__ || 'anony-session');
  webview.setAttribute('webpreferences', 'backgroundThrottling=true,spellcheck=false');
  webview.setAttribute('allowpopups', '');
  webview.src = tab.url;
  viewContainer.appendChild(webview);
  tab.webview = webview;

  webview.addEventListener('page-title-updated', (e) => {
    tab.title = e.title || tab.url;
    tab.tabEl.querySelector('.title').textContent = tab.title;
  });

  webview.addEventListener('did-navigate', (e) => {
    tab.url = e.url;
    if (tab.id === activeId) addressEl.value = e.url;
    updateNavButtons();
  });
  webview.addEventListener('did-navigate-in-page', (e) => {
    tab.url = e.url;
    if (tab.id === activeId) addressEl.value = e.url;
    updateNavButtons();
  });

  webview.addEventListener('new-window', (e) => {
    createTab(e.url);
  });

  return webview;
}

function createTab(url) {
  const id = nextId++;

  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.innerHTML =
    '<span class="sleep-icon"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M20 14.5a8 8 0 1 1-8.9-11.4 6.3 6.3 0 0 0 8.9 11.4z"/></svg></span>' +
    '<span class="title">New tab</span>' +
    '<span class="close"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></span>';
  tabEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('close')) {
      closeTab(id);
    } else {
      switchTab(id);
    }
  });
  tabsEl.appendChild(tabEl);

  const tab = { id, tabEl, webview: null, title: 'New tab', url, suspended: false, lastHiddenAt: null };
  tabs.push(tab);
  buildWebview(tab);

  switchTab(id);
  return tab;
}

// Tear down a hidden tab's webview to free its renderer process. The tab
// stays in the tab strip (dimmed, with a sleep icon) and just remembers its
// URL/title so it can be rebuilt on demand.
function suspendTab(tab) {
  if (tab.suspended || tab.id === activeId || !tab.webview) return;
  if (typeof tab.webview.isLoading === 'function' && tab.webview.isLoading()) return;

  tab.webview.remove();
  tab.webview = null;
  tab.suspended = true;
  tab.tabEl.classList.add('suspended');
}

function wakeTab(tab) {
  if (!tab.suspended) return;
  buildWebview(tab);
  tab.suspended = false;
  tab.tabEl.classList.remove('suspended');
}

function switchTab(id) {
  const prev = activeTab();
  if (prev && prev.id !== id) prev.lastHiddenAt = Date.now();

  activeId = id;
  const tab = tabs.find((t) => t.id === id);
  if (tab && tab.suspended) wakeTab(tab);
  if (tab) tab.lastHiddenAt = null;

  for (const t of tabs) {
    const isActive = t.id === id;
    t.tabEl.classList.toggle('active', isActive);
    if (t.webview) t.webview.classList.toggle('active', isActive);
    if (isActive) addressEl.value = t.url;
  }
  updateNavButtons();
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const [tab] = tabs.splice(idx, 1);
  tab.tabEl.remove();
  if (tab.webview) tab.webview.remove();

  if (tabs.length === 0) {
    createTab(HOME_URL);
    return;
  }
  if (activeId === id) {
    const next = tabs[idx] || tabs[idx - 1] || tabs[0];
    switchTab(next.id);
  }
}

function activeTab() {
  return tabs.find((t) => t.id === activeId) || null;
}

function updateNavButtons() {
  const t = activeTab();
  if (!t || !t.webview) return;
  backBtn.disabled = !t.webview.canGoBack();
  fwdBtn.disabled = !t.webview.canGoForward();
}

function navigateActive(input) {
  const t = activeTab();
  if (!t) return;
  const url = normalizeInput(input);
  if (t.webview) {
    t.webview.loadURL(url);
  } else {
    t.url = url;
    wakeTab(t);
  }
}

// Periodically freeze tabs that have been hidden long enough. Never touches
// the active tab, and skips anything still mid-load.
setInterval(() => {
  const now = Date.now();
  for (const t of tabs) {
    if (t.id === activeId || t.suspended || !t.lastHiddenAt) continue;
    if (now - t.lastHiddenAt >= SUSPEND_AFTER_MS) suspendTab(t);
  }
}, SUSPEND_CHECK_INTERVAL_MS);

// Toolbar wiring
backBtn.addEventListener('click', () => activeTab()?.webview?.goBack());
fwdBtn.addEventListener('click', () => activeTab()?.webview?.goForward());
reloadBtn.addEventListener('click', () => activeTab()?.webview?.reload());
goBtn.addEventListener('click', () => navigateActive(addressEl.value));
addressEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') navigateActive(addressEl.value);
});
newTabBtn.addEventListener('click', () => createTab(HOME_URL));

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 't') { e.preventDefault(); createTab(HOME_URL); }
  if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); if (activeId) closeTab(activeId); }
  if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); addressEl.focus(); addressEl.select(); }
  if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); activeTab()?.webview?.reload(); }
});

(async function init() {
  try {
    window.__ANONY_PARTITION__ = await window.browseAnony.getPartition();
  } catch (e) {
    window.__ANONY_PARTITION__ = 'anony-session';
  }
  createTab(HOME_URL);
})();
