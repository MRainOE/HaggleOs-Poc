function fmtMoney(currency, value) {
  if (typeof value !== "number") return "N/A";
  if (currency === "GBP") return `£${value.toFixed(2)}`;
  if (currency === "USD") return `$${value.toFixed(2)}`;
  if (currency === "EUR") return `€${value.toFixed(2)}`;
  return value.toFixed(2);
}

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function load() {
  const data = await chrome.storage.sync.get(["haggleosSettings", "haggleosHistory"]);
  const settings = data.haggleosSettings || {};
  const history = Array.isArray(data.haggleosHistory) ? data.haggleosHistory : [];

  // Settings box
  const maxOver = typeof settings.max_overpay_percent === "number" ? settings.max_overpay_percent : 20;
  const style = typeof settings.negotiation_style === "string" ? settings.negotiation_style : "normal";
  const timeout = typeof settings.timeout_seconds === "number" ? settings.timeout_seconds : 120;

  document.getElementById("settingsBox").innerHTML = `
    <div>Max overpay: <b>${maxOver}%</b></div>
    <div>Style: <b>${style}</b></div>
    <div>Timeout: <b>${timeout}s</b></div>
  `;

  // History box
  const box = document.getElementById("historyBox");
  if (history.length === 0) {
    box.textContent = "No previous analyses yet.";
    return;
  }

  box.innerHTML = history.map((h) => {
    const decision = h.decision || "UNKNOWN";
    const title = h.title || "(no title)";
    const listing = fmtMoney(h.currency, h.listing_price);
    const market = fmtMoney(h.currency, h.market_price);
    const offer = typeof h.suggested_offer === "number" ? fmtMoney(h.currency, h.suggested_offer) : "N/A";
    const time = fmtTime(h.timestamp);

    let diffPart = "";
    if (typeof h.listing_price === "number" && typeof h.market_price === "number" && h.market_price > 0) {
      const percent = ((h.listing_price - h.market_price) / h.market_price) * 100;
      diffPart = ` • ${percent.toFixed(0)}% vs market`;
    }

    const urlPart = h.listing_url
      ? `<div class="small"><a href="${h.listing_url}" target="_blank" rel="noreferrer">Open listing</a></div>`
      : "";

    return `
      <div class="historyItem">
        <div class="historyTop">
          <div>
            <div class="historyTitle">[${decision}] ${title}</div>
            <div class="small">Listing: <b>${listing}</b> • Market: <b>${market}</b>${diffPart}</div>
            <div class="small">Suggested offer: <b>${offer}</b></div>
            <div class="small mono">${time}</div>
            ${urlPart}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnOpenEbay").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.ebay.com/" });
  });

  document.getElementById("btnClear").addEventListener("click", async () => {
    await chrome.storage.sync.set({ haggleosHistory: [] });
    await load();
  });

  document.getElementById("btnExport").addEventListener("click", async () => {
    const data = await chrome.storage.sync.get(["haggleosHistory"]);
    const history = Array.isArray(data.haggleosHistory) ? data.haggleosHistory : [];
    downloadJson("haggleos-history.json", history);
  });

  load().catch((e) => {
    const box = document.getElementById("historyBox");
    box.textContent = "Failed to load dashboard data. Check extension permissions.";
    console.error(e);
  });
});
