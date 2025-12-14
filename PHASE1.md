# Phase 1 notes

## Run web dashboard locally
- `cd haggle_vercel`
- `npm install`
- `npm run dev`
- Visit `http://localhost:3000/dashboard`

## Load the Chrome extension (unpacked)
- Chrome -> Extensions -> Enable Developer Mode -> Load unpacked -> choose `extension` folder.
- Click the HaggleOS icon to open/focus the dashboard (defaults to `https://haggle-os-poc.vercel.app/dashboard` unless `haggleosSettings.api_base_url` is set in storage).

## Bridge (extension <-> web)
- A content script (`dashboard_bridge.js`) runs on `http://localhost:3000/dashboard*`, `http://127.0.0.1:3000/dashboard*`, and `https://haggle-os-poc.vercel.app/dashboard*`.
- The web page sends `window.postMessage` with `{ type, requestId, payload }`.
- Supported `type` values:
  - `GET_SETTINGS` -> returns `haggleosSettings` from `chrome.storage.sync`.
  - `SET_SETTINGS` -> writes `haggleosSettings` from `payload.settings`.
  - `GET_HISTORY` -> returns `haggleosHistory` (array) from `chrome.storage.sync`.
  - `CLEAR_HISTORY` -> clears `haggleosHistory` in `chrome.storage.sync`.
- Bridge replies with `{ type: "RESPONSE", requestId, success, data?, error? }`. Responses are only sent to the same origin/path.

## Manual test checklist (local)
1) Click extension icon -> new/existing tab opens `https://haggle-os-poc.vercel.app/dashboard` (or the URL in `haggleosSettings.api_base_url` if set).
2) On the dashboard, "Current settings" shows values stored in `chrome.storage.sync` (edit via the on-page settings panel on an eBay `/itm/` page, then reload dashboard to confirm).
3) Analyze a listing on eBay (`/itm/`), then reload dashboard -> history shows the new entry from `haggleosHistory`.
4) Click "Clear History" -> history becomes empty; reload dashboard and history stays empty.
5) Click "Export History" -> downloads `haggleos-history.json` matching the current history entries.
