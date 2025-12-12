const DASHBOARD_PATH = "dashboard.html";

async function openOrFocusDashboard() {
  const url = chrome.runtime.getURL(DASHBOARD_PATH);

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
