# BrowseAnony

A small Electron browser built around one idea: **browse without leaving a
trace, without your laptop fans spinning up.** No frameworks, no bundler,
no telemetry — just plain HTML/CSS/JS.

![CI](https://github.com/prach1121/BrowseAnony/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

## What's different about it

Compared to a normal browser (or a plain Electron wrapper), BrowseAnony
changes three things:

| | Normal browser | BrowseAnony |
|---|---|---|
| **History / cookies** | Saved to disk until you clear them | Kept in RAM only, gone the moment you quit — nothing to clear |
| **Ads & trackers** | Loaded unless you install an extension | Blocked at the network layer by default (`blocklist.txt`) |
| **Idle tabs** | Stay loaded, keep burning RAM | Automatically "put to sleep" (process killed) after 60s hidden, and rebuilt on demand when you click back |
| **Permissions** | Sites can ask for camera/mic/location | Every permission prompt is denied automatically |
| **Background chatter** | Sync, telemetry, update-checkers running quietly | All disabled — the app talks to nothing except the sites you open |

The tab-sleeping part is the one that actually matters day to day: leave
ten tabs open and idle, and the app uses roughly the RAM of two. Nothing
else about it needs configuring for that to work.

## How to use it

**Install and launch:**

```bash
npm install
npm start
```

Requires Node.js 18+. A window opens with one tab, already on DuckDuckGo.

**Browsing:**
- Type a URL or a search term into the address bar and press Enter (or hit
  **Go**).
- Click **+** for a new tab, click a tab to switch to it, click the **×**
  on a tab to close it.
- Use the **back / forward / reload** buttons in the toolbar like any
  browser.
- A dimmed tab with a moon icon means it's asleep (see table above) — click
  it and it reloads automatically.
- The **🔒 Anony** badge in the toolbar is just a reminder that the session
  is in-memory and ad/tracker blocking is on; nothing to click there.

**Keyboard shortcuts:**

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + T` | New tab |
| `Ctrl/Cmd + W` | Close current tab |
| `Ctrl/Cmd + L` | Focus the address bar |
| `Ctrl/Cmd + R` | Reload current tab |

**Closing the app:** just quit it normally — that's the "clear history"
step. There's nothing saved to disk to begin with.

## Tuning it (optional)

- Want tabs to sleep faster/slower? Change `SUSPEND_AFTER_MS` near the top
  of `renderer.js` (milliseconds; default is `60 * 1000`).
- Want to block or unblock a domain? Add or remove a line in
  `blocklist.txt` and restart the app.
- Want a smaller memory ceiling per tab? Lower `--max-old-space-size` in
  `main.js`.

## Project layout

```
browseanony/
├── main.js                     # window creation, privacy/session hardening
├── preload.js                  # minimal bridge, no Node exposed to pages
├── index.html                  # toolbar + tab strip shell
├── style.css                   # flat, dark UI
├── renderer.js                 # tabs, navigation, tab-sleeping logic
├── blocklist.txt                 # tracker/ad domains blocked by default
├── package.json
├── LICENSE
└── .github/workflows/ci.yml     # syntax-checks the JS on push/PR
```

## Honest limitations

- It's still Chromium under the hood, so "lightweight" means lightweight
  *for an Electron app*, not lighter than a native browser.
- The blocklist is a plain domain list, not a full filter-list engine like
  uBlock Origin's.
- An awake tab is still its own renderer process — the sleep behavior is
  what keeps that from adding up.

## Push to GitHub

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(This folder is already a git repo with commits on `main` — just add the
remote and push. Create the empty repo on GitHub first so there's nothing
to merge.)

## License

MIT — see [LICENSE](./LICENSE).
