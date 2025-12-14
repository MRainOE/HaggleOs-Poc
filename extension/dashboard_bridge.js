(function () {
  const ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000", "https://haggle-os-poc.vercel.app"];
  const ALLOWED_PATH_PREFIX = "/dashboard";
  const MESSAGE_TYPES = new Set(["GET_SETTINGS", "SET_SETTINGS", "GET_HISTORY", "CLEAR_HISTORY"]);

  function isFromDashboard(event) {
    return (
      event.source === window &&
      ALLOWED_ORIGINS.includes(event.origin) &&
      typeof location === "object" &&
      ALLOWED_ORIGINS.includes(location.origin) &&
      location.pathname.startsWith(ALLOWED_PATH_PREFIX)
    );
  }

  async function handleMessage(event) {
    if (!isFromDashboard(event)) return;
    const { data } = event;
    if (!data || typeof data !== "object") return;
    const { type, requestId, payload } = data;
    if (!MESSAGE_TYPES.has(type) || typeof requestId !== "string") return;

    const reply = (response) => {
      try {
        event.source?.postMessage(
          {
            type: "RESPONSE",
            requestId,
            ...response,
          },
          event.origin
        );
      } catch (err) {
        console.warn("HaggleOS bridge: failed to post response", err);
      }
    };

    try {
      if (type === "GET_SETTINGS") {
        const res = await chrome.storage.sync.get(["haggleosSettings"]);
        reply({ success: true, data: res?.haggleosSettings || {} });
        return;
      }

      if (type === "SET_SETTINGS") {
        if (!payload || typeof payload.settings !== "object") {
          reply({ success: false, error: "Invalid settings payload" });
          return;
        }
        await chrome.storage.sync.set({ haggleosSettings: payload.settings });
        reply({ success: true });
        return;
      }

      if (type === "GET_HISTORY") {
        const res = await chrome.storage.sync.get(["haggleosHistory"]);
        const history = Array.isArray(res?.haggleosHistory) ? res.haggleosHistory : [];
        reply({ success: true, data: history });
        return;
      }

      if (type === "CLEAR_HISTORY") {
        await chrome.storage.sync.set({ haggleosHistory: [] });
        reply({ success: true });
      }
    } catch (err) {
      reply({ success: false, error: err?.message || String(err) });
    }
  }

  window.addEventListener("message", handleMessage);
})();
