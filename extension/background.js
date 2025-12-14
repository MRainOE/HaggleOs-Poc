const DEFAULT_API_BASE = "https://haggle-os-poc.vercel.app";
const DASHBOARD_PATH = "/dashboard";

async function getDashboardUrl() {
  try {
    const data = await chrome.storage.sync.get(["haggleosSettings"]);
    const base = data?.haggleosSettings?.api_base_url;
    const normalizedBase =
      typeof base === "string" && base.trim().length > 0 ? base.trim().replace(/\/$/, "") : DEFAULT_API_BASE;
    return `${normalizedBase}${DASHBOARD_PATH}`;
  } catch (err) {
    console.warn("Failed to read api_base_url, using default:", err);
    return `${DEFAULT_API_BASE}${DASHBOARD_PATH}`;
  }
}

async function openOrFocusDashboard() {
  const url = await getDashboardUrl();

  // If dashboard tab already open, focus it
  const tabs = await chrome.tabs.query({ url });
  if (tabs && tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId != null) {
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
    return;
  }

  // Otherwise open a new one
  await chrome.tabs.create({ url });
}

chrome.action.onClicked.addListener(() => {
  openOrFocusDashboard().catch((e) => console.error("Open dashboard failed:", e));
});
