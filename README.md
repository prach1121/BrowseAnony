# BrowseAnony

A lightweight, low-RAM, low-CPU, privacy-first browser built with Electron. Plain
JavaScript, no frameworks, no bundlers, no telemetry.

## Run it

```bash
npm install
npm start
```

Requires Node.js 18+.

## What makes it lightweight

- **Background tabs are suspended, not just throttled.** A hidden tab's
  `<webview>` — its own renderer process, its own chunk of RAM — is torn
  down entirely after it's been hidden for `SUSPEND_AFTER_MS` (default 60s,
  see the top of `renderer.js`). The tab stays in the strip, dimmed with a
  💤 icon, and just remembers its URL; clicking it rebuilds the webview and
  reloads. This is the single biggest RAM lever in the app — a window with
  ten tabs open costs about the same as one with two, as long as you're not
  actively using all ten at once.
- Chromium's own background services are turned off at the switch level
  since this app never uses them: sync, component updater, domain
  reliability pings, translate, optimization-guide downloads/fetching,
  media-router discovery, and the back/forward page cache.
- Disk and media caches are capped at 20MB instead of growing unbounded.
- No application menu, no devtools panel, no extensions, no default apps.
- Plain HTML/CSS/JS — nothing to compile, no React/webpack overhead in the
  renderer.
- Background tabs (while still awake, i.e. within the suspend window) are
  throttled (`backgroundThrottling: true`) so they don't compete for CPU.
- Spellcheck dictionaries are disabled (they sit in RAM for the life of the
  app otherwise).
- V8 heap is capped per renderer (`--max-old-space-size=256`) to keep runaway
  pages in check.
- Sandboxed, isolated renderers (`sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`) with no preload exposed to web content.

### Squeezing further

- Lower `SUSPEND_AFTER_MS` in `renderer.js` (e.g. to `20 * 1000`) for a more
  aggressive box — tabs sleep almost as soon as you leave them, at the cost
  of a reload flicker when you switch back quickly.
- Drop `--max-old-space-size` in `main.js` to `192` or lower if pages don't
  need it.
- `--disable-site-isolation-trials --disable-features=IsolateOrigins,site-per-process`
  can be added to `main.js` to merge same-site iframes into fewer processes.
  This is **not** enabled by default — it weakens Chromium's isolation
  between origins on the same page, which is a real security trade-off, not
  just a memory one. Only add it if you understand and accept that.

## What makes it private

- **In-memory session by default.** All tabs share a single non-persistent
  session partition (`anony-session`, no `persist:` prefix). Cookies, cache,
  and history live in RAM only and disappear the moment you quit — there is
  nothing to clear.
- **Tracker/ad blocking.** `blocklist.txt` lists common analytics, ad, and
  tracking domains; requests to them are cancelled before they leave the
  process. Edit the file and restart to add or remove entries.
- **Do Not Track / Global Privacy Control headers** are sent with every
  request (`DNT: 1`, `Sec-GPC: 1`).
- **Referrers are trimmed** to the origin only, never the full path/query.
- **Permissions are denied by default** — camera, microphone, geolocation,
  notifications, etc. all fail closed.
- Any popup or `<webview>` a page tries to open is forced onto the same
  hardened, sandboxed partition — it can't escape into Node or get its own
  persistent storage.

## Shortcuts

| Action        | Shortcut |
|---------------|----------|
| New tab       | Ctrl/Cmd+T |
| Close tab     | Ctrl/Cmd+W |
| Focus address | Ctrl/Cmd+L |
| Reload        | Ctrl/Cmd+R |

## Notes / honest limitations

- Electron ships a full Chromium, so "lightweight" here means lightweight
  *for an Electron app* — leaner than a default Electron shell, not leaner
  than a native browser.
- Each tab is a separate `<webview>` guest process, same as Chrome's
  per-tab process model; closing unused tabs is still the biggest RAM lever
  you control.
- The tracker blocklist is a simple domain list, not a full filter-list
  engine (no EasyList rule syntax) — it catches the common trackers but
  isn't a replacement for uBlock Origin's rule set.

## Project layout

```
browseanony/
├── main.js         # app entry, window creation, privacy/session hardening
├── preload.js      # minimal contextBridge, no Node exposed to pages
├── index.html       # toolbar + tab strip shell
├── style.css        # flat, dark UI
├── renderer.js       # tab management, navigation, webview wiring
├── blocklist.txt      # tracker/ad domains blocked at the network layer
└── package.json
```
