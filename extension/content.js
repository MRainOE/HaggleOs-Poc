// content.js

let isAnalyzing = false;

// ---- SETTINGS MODEL ----
let currentSettings = {
  max_overpay_percent: 20,
  negotiation_style: 'normal',
  timeout_seconds: 120,
};

// ---- HISTORY MODEL ----
const MAX_HISTORY_ITEMS = 5;
let lastResult = null;
let lastPayload = null;

function loadSettings() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.warn('HaggleOS: chrome.storage.sync not available');
      return;
    }
  } catch {
    // In case "chrome" is not defined for some reason
    return;
  }

  chrome.storage.sync.get(['haggleosSettings'], (data) => {
    const stored = data.haggleosSettings;
    if (stored && typeof stored === 'object') {
      if (typeof stored.max_overpay_percent === 'number') {
        currentSettings.max_overpay_percent = stored.max_overpay_percent;
      }
      if (
        typeof stored.negotiation_style === 'string' &&
        ['soft', 'normal', 'aggressive'].includes(stored.negotiation_style)
      ) {
        currentSettings.negotiation_style = stored.negotiation_style;
      }
      if (typeof stored.timeout_seconds === 'number') {
        currentSettings.timeout_seconds = stored.timeout_seconds;
      }
    }
    console.log('HaggleOS: Loaded settings:', currentSettings);
  });
}

function saveSettings(newSettings, callback) {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.warn('HaggleOS: chrome.storage.sync not available for save');
      return;
    }
  } catch {
    if (callback) callback();
    return;
  }

  chrome.storage.sync.set({ haggleosSettings: newSettings }, () => {
    console.log('HaggleOS: Saved settings:', newSettings);
    if (callback) callback();
  });
}

// ---- SETTINGS PANEL UI ----
function createOrGetSettingsPanel() {
  let panel = document.getElementById('haggleos-settings-panel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'haggleos-settings-panel';

  Object.assign(panel.style, {
    position: 'fixed',
    left: '20px',
    bottom: '120px', // above main panel & button
    zIndex: '10001',
    padding: '12px 16px',
    maxWidth: '260px',
    backgroundColor: 'white',
    color: '#111',
    borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '12px',
    lineHeight: '1.4',
    display: 'none', // hidden by default
  });

  document.body.appendChild(panel);
  renderSettingsPanel(panel);
  return panel;
}

function renderSettingsPanel(panel) {
  panel.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 6px;">HaggleOS Settings</div>

    <label style="display:block; margin-bottom:6px;">
      <span>Max % over market before abort:</span><br>
      <input id="haggleos-max-overpay-input" type="number" min="0" max="100" style="
        width: 100%;
        margin-top: 4px;
        padding: 4px 6px;
        border-radius: 6px;
        border: 1px solid #ddd;
        font-size: 12px;
      ">
    </label>

    <label style="display:block; margin-bottom:6px;">
      <span>Negotiation style:</span><br>
      <select id="haggleos-style-select" style="
        width: 100%;
        margin-top: 4px;
        padding: 4px 6px;
        border-radius: 6px;
        border: 1px solid #ddd;
        font-size: 12px;
      ">
        <option value="soft">Soft / very polite</option>
        <option value="normal">Normal</option>
        <option value="aggressive">More direct</option>
      </select>
    </label>

    <label style="display:block; margin-bottom:8px;">
      <span>Timeout (seconds):</span><br>
      <input id="haggleos-timeout-input" type="number" min="10" max="600" style="
        width: 100%;
        margin-top: 4px;
        padding: 4px 6px;
        border-radius: 6px;
        border: 1px solid #ddd;
        font-size: 12px;
      ">
    </label>

    <button id="haggleos-settings-save" style="
      padding: 6px 10px;
      border-radius: 6px;
      border: none;
      background-color: #2563eb;
      color: white;
      font-size: 12px;
      cursor: pointer;
      margin-right: 8px;
    ">
      Save
    </button>
    <span id="haggleos-settings-status" style="font-size:11px; color:#16a34a;"></span>
  `;

  // Prefill inputs from currentSettings
  const maxInput = panel.querySelector('#haggleos-max-overpay-input');
  const styleSelect = panel.querySelector('#haggleos-style-select');
  const timeoutInput = panel.querySelector('#haggleos-timeout-input');
  const saveBtn = panel.querySelector('#haggleos-settings-save');
  const statusSpan = panel.querySelector('#haggleos-settings-status');

  if (maxInput) maxInput.value = String(currentSettings.max_overpay_percent);
  if (styleSelect) styleSelect.value = currentSettings.negotiation_style;
  if (timeoutInput) timeoutInput.value = String(currentSettings.timeout_seconds);

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const maxVal = parseFloat(maxInput.value);
      const timeoutVal = parseFloat(timeoutInput.value);
      const styleVal = styleSelect.value;

      // Reset status styling
      if (statusSpan) {
        statusSpan.textContent = '';
        statusSpan.style.color = '#16a34a';
      }

      // Basic validation + fallback
      const nextSettings = { ...currentSettings };

      if (!Number.isNaN(maxVal) && maxVal >= 0 && maxVal <= 100) {
        nextSettings.max_overpay_percent = maxVal;
      }

      if (!Number.isNaN(timeoutVal)) {
        if (timeoutVal < 10 || timeoutVal > 600) {
          if (statusSpan) {
            statusSpan.style.color = '#b91c1c'; // red
            statusSpan.textContent = 'Timeout must be between 10 and 600 seconds.';
          }
          return; // stop here, do NOT save
        } else {
          nextSettings.timeout_seconds = timeoutVal;
        }
      }

      if (['soft', 'normal', 'aggressive'].includes(styleVal)) {
        nextSettings.negotiation_style = styleVal;
      }

      currentSettings = nextSettings;

      saveSettings(currentSettings, () => {
        if (statusSpan) {
          statusSpan.style.color = '#16a34a';
          statusSpan.textContent = 'Saved ✅';
          setTimeout(() => {
            statusSpan.textContent = '';
          }, 1500);
        }
      });
    });
  }

  panel.style.display = 'block';
  attachPanelCloseButton(panel);
}

// ---- RESULT PANEL ----

function createOrGetPanel() {
  let panel = document.getElementById('haggleos-panel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'haggleos-panel';

  Object.assign(panel.style, {
    position: 'fixed',
    left: '20px',
    bottom: '70px', // above the button
    zIndex: '10000',
    padding: '12px 16px',
    maxWidth: '280px',
    backgroundColor: 'white',
    color: '#111',
    borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px',
    lineHeight: '1.4',
  });

  document.body.appendChild(panel);
  return panel;
}

function startLoadingAnimation(panel) {
  // Set initial content with dots placeholders on all lines
  panel.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">Analyzing deal...</div>
    <div>🔍 Checking market price<span class="haggleos-dots">.</span></div>
    <div>👀 Inspecting images<span class="haggleos-dots">.</span></div>
    <div>🧠 Thinking of negotiation strategy<span class="haggleos-dots">.</span></div>
  `;

  // make sure it's visible (in case user closed it previously)
  panel.style.display = 'block';

  attachPanelCloseButton(panel);

  const dotsEls = panel.querySelectorAll('.haggleos-dots');
  if (!dotsEls || dotsEls.length === 0) return;

  let step = 1;
  const intervalId = window.setInterval(() => {
    step = (step % 3) + 1; // 1 → 2 → 3 → 1...
    const dots = '.'.repeat(step);
    dotsEls.forEach((el) => {
      el.textContent = dots;
    });
  }, 500);

  // store interval id on the panel so we can stop it later
  panel.dataset.dotsIntervalId = String(intervalId);
}

function stopLoadingAnimation(panel) {
  const idStr = panel.dataset.dotsIntervalId;
  if (idStr) {
    const id = Number(idStr);
    window.clearInterval(id);
    delete panel.dataset.dotsIntervalId;
  }
}

function showError(panel, message) {
  stopLoadingAnimation(panel);
  panel.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px; color: #b91c1c;">Something went wrong</div>
    <div>${message}</div>
  `;
  panel.style.display = 'block';
  attachPanelCloseButton(panel);
}

// Close button helper
function attachPanelCloseButton(panel) {
  // Always create a fresh close button after we reset innerHTML
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.className = 'haggleos-panel-close';

  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '20px',
    height: '20px',
    border: 'none',
    borderRadius: '10px',
    background: 'transparent',
    color: '#555',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: '20px',
    padding: '0',
  });

  closeBtn.addEventListener('click', () => {
    panel.style.display = 'none';
  });

  // Ensure panel can host absolutely-positioned children
  if (!panel.style.position) {
    panel.style.position = 'fixed';
  }

  panel.appendChild(closeBtn);
}

// ---- HISTORY HELPERS ----

// Save one entry into history (max 5 items)
function addHistoryEntry(result, payload) {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.warn('HaggleOS: chrome.storage.sync not available for history');
      return;
    }
  } catch {
    return;
  }

  const entry = {
    title: payload?.title || '(no title)',
    listing_price: payload?.price_value ?? null,
    currency: payload?.currency ?? null,
    decision: result?.decision || 'UNKNOWN',
    market_price: result?.market_price ?? null,
    suggested_offer: result?.suggested_offer ?? null,
    timestamp: Date.now(),
  };

  chrome.storage.sync.get(['haggleosHistory'], (data) => {
    const oldHistory = Array.isArray(data.haggleosHistory) ? data.haggleosHistory : [];
    const newHistory = [entry, ...oldHistory].slice(0, MAX_HISTORY_ITEMS);

    chrome.storage.sync.set({ haggleosHistory: newHistory }, () => {
      console.log('HaggleOS: Saved history entry. Total:', newHistory.length);
    });
  });
}

// Render history view in the main panel
function renderHistory(panel) {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.warn('HaggleOS: chrome.storage.sync not available for history load');
      return;
    }
  } catch {
    return;
  }

  chrome.storage.sync.get(['haggleosHistory'], (data) => {
    const history = Array.isArray(data.haggleosHistory) ? data.haggleosHistory : [];

    if (history.length === 0) {
      panel.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 6px;">Recent analyses</div>
        <div style="font-size: 12px; color:#555; margin-bottom: 8px;">
          No previous analyses yet.
        </div>
        <button id="haggleos-history-back" style="
          padding: 6px 10px;
          border-radius: 6px;
          border: none;
          background-color: #2563eb;
          color: white;
          font-size: 12px;
          cursor: pointer;
        ">
          Back to result
        </button>
      `;
      panel.style.display = 'block';
      attachPanelCloseButton(panel);

      const backBtn = panel.querySelector('#haggleos-history-back');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (lastResult && lastPayload) {
            renderResult(panel, lastResult, lastPayload);
          } else {
            panel.style.display = 'none';
          }
        });
      }
      return;
    }

    // Helper to format price with currency
    const fmt = (currency, value) => {
      if (typeof value !== 'number') return 'N/A';
      if (currency === 'GBP') return `£${value.toFixed(2)}`;
      if (currency === 'USD') return `$${value.toFixed(2)}`;
      if (currency === 'EUR') return `€${value.toFixed(2)}`;
      return value.toFixed(2);
    };

    const rowsHtml = history
      .map((item) => {
        const dec = item.decision || 'UNKNOWN';
        const title = item.title || '(no title)';
        const listing = fmt(item.currency, item.listing_price);
        const market = fmt(item.currency, item.market_price);
        let extra = '';

        if (
          typeof item.listing_price === 'number' &&
          typeof item.market_price === 'number' &&
          item.market_price > 0
        ) {
          const diff = item.listing_price - item.market_price;
          const percent = (diff / item.market_price) * 100;
          extra = ` – ${percent.toFixed(0)}% vs market`;
        }

        let offerPart = '';
        if (typeof item.suggested_offer === 'number') {
          offerPart = ` – suggested ${fmt(item.currency, item.suggested_offer)}`;
        }

        return `
          <div style="margin-bottom:6px; font-size:12px;">
            <strong>[${dec}]</strong> ${title}<br>
            <span style="color:#555;">
              ${listing} vs ${market}${extra}${offerPart}
            </span>
          </div>
        `;
      })
      .join('');

    panel.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 6px;">Recent analyses</div>
      <div style="max-height: 200px; overflow-y: auto; margin-bottom:8px;">
        ${rowsHtml}
      </div>
      <button id="haggleos-history-back" style="
        padding: 6px 10px;
        border-radius: 6px;
        border: none;
        background-color: #2563eb;
        color: white;
        font-size: 12px;
        cursor: pointer;
      ">
        Back to result
      </button>
    `;

    panel.style.display = 'block';
    attachPanelCloseButton(panel);

    const backBtn = panel.querySelector('#haggleos-history-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (lastResult && lastPayload) {
          renderResult(panel, lastResult, lastPayload);
        } else {
          panel.style.display = 'none';
        }
      });
    }
  });
}

// render result from backend (ABORT vs NEGOTIATE)
function renderResult(panel, result, payload) {
  stopLoadingAnimation(panel);

  const listingPrice = payload?.price_value ?? null;
  const currency = payload?.currency ?? '';

  // Helper: format price with currency
  const fmtPrice = (value) => {
    if (typeof value !== 'number') return 'N/A';
    if (currency === 'GBP') return `£${value.toFixed(2)}`;
    if (currency === 'USD') return `$${value.toFixed(2)}`;
    if (currency === 'EUR') return `€${value.toFixed(2)}`;
    return value.toFixed(2);
  };

  if (!result || typeof result !== 'object') {
    panel.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">Analysis complete ✅</div>
      <div>Unexpected response format. Check console for details.</div>
      <button id="haggleos-history-btn" style="
        margin-top:8px;
        font-size:11px;
        border:none;
        background:none;
        color:#2563eb;
        cursor:pointer;
        padding:0;
      ">
        View history
      </button>
    `;
    panel.style.display = 'block';
    attachPanelCloseButton(panel);

    const historyBtn = panel.querySelector('#haggleos-history-btn');
    if (historyBtn) {
      historyBtn.addEventListener('click', () => renderHistory(panel));
    }
    return;
  }

  const decision = result.decision;
  const marketPrice = result.market_price;
  const defects = result.defects_found || [];
  const suggestedOffer = result.suggested_offer;
  const draftMessage = result.draft_message;

  // Helper: calculate overpriced %
  let overPercentText = '';
  if (typeof listingPrice === 'number' && typeof marketPrice === 'number' && marketPrice > 0) {
    const diff = listingPrice - marketPrice;
    const percent = (diff / marketPrice) * 100;
    overPercentText = `${percent.toFixed(0)}%`;
  }

  if (decision === 'ABORT') {
    panel.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #b91c1c;">
        ⚠️ Overpriced – walk away
      </div>
      <div style="margin-bottom: 4px;">
        Market average: <strong>${fmtPrice(marketPrice)}</strong>
      </div>
      <div style="margin-bottom: 4px;">
        Listing price: <strong>${fmtPrice(listingPrice)}</strong>
      </div>
      ${
        overPercentText
          ? `<div style="margin-bottom: 8px;">Overpriced by ~${overPercentText}.</div>`
          : ''
      }
      <div style="font-size: 12px; color: #555; margin-bottom: 6px;">
        We recommend skipping this deal and looking for cheaper alternatives.
      </div>
      <button id="haggleos-history-btn" style="
        margin-top:4px;
        font-size:11px;
        border:none;
        background:none;
        color:#2563eb;
        cursor:pointer;
        padding:0;
      ">
        View history
      </button>
    `;
    panel.style.display = 'block';
    attachPanelCloseButton(panel);

    const historyBtn = panel.querySelector('#haggleos-history-btn');
    if (historyBtn) {
      historyBtn.addEventListener('click', () => renderHistory(panel));
    }
    return;
  }

  if (decision === 'NEGOTIATE') {
    const defectsHtml =
      defects && defects.length
        ? `<ul style="padding-left: 18px; margin: 4px 0 8px 0;">
            ${defects
              .map(
                (d) =>
                  `<li style="margin-bottom: 2px;">${d}</li>`
              )
              .join('')}
          </ul>`
        : '<div style="margin-bottom: 8px;">No obvious defects detected.</div>';

    panel.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #166534;">
        ✅ Negotiation opportunity
      </div>
      <div style="margin-bottom: 4px;">
        Market average: <strong>${fmtPrice(marketPrice)}</strong>
      </div>
      <div style="margin-bottom: 8px;">
        Listing price: <strong>${fmtPrice(listingPrice)}</strong>
      </div>
      <div style="margin-bottom: 4px;">
        Detected issues:
      </div>
      ${defectsHtml}
      ${
        typeof suggestedOffer === 'number'
          ? `<div style="margin-bottom: 8px;">
               Suggested offer: <strong>${fmtPrice(suggestedOffer)}</strong>
             </div>`
          : ''
      }
      ${
        draftMessage
          ? `<div style="margin-bottom: 6px; font-weight: 500;">Suggested message:</div>
             <div style="padding: 8px; border-radius: 6px; background: #f0fdf4; margin-bottom: 6px; font-size: 12px;">
               ${draftMessage}
             </div>
             <button id="haggleos-copy-btn" style="
               padding: 6px 10px;
               border-radius: 6px;
               border: none;
               background-color: #16a34a;
               color: white;
               font-size: 12px;
               cursor: pointer;
               margin-right: 8px;
             ">
               Copy message
             </button>
             <button id="haggleos-history-btn" style="
               font-size:11px;
               border:none;
               background:none;
               color:#2563eb;
               cursor:pointer;
               padding:0;
             ">
               View history
             </button>`
          : `
             <button id="haggleos-history-btn" style="
               font-size:11px;
               border:none;
               background:none;
               color:#2563eb;
               cursor:pointer;
               padding:0;
             ">
               View history
             </button>
           `
      }
    `;

    panel.style.display = 'block';
    attachPanelCloseButton(panel);

    // Attach copy handler if button exists
    const copyBtn = panel.querySelector('#haggleos-copy-btn');
    if (copyBtn && draftMessage) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(draftMessage);
          copyBtn.innerText = 'Copied!';
          copyBtn.style.backgroundColor = '#15803d';
          setTimeout(() => {
            copyBtn.innerText = 'Copy message';
            copyBtn.style.backgroundColor = '#16a34a';
          }, 1500);
        } catch (e) {
          console.error('Failed to copy message:', e);
        }
      });
    }

    const historyBtn = panel.querySelector('#haggleos-history-btn');
    if (historyBtn) {
      historyBtn.addEventListener('click', () => renderHistory(panel));
    }

    return;
  }

  // Fallback if decision is unknown
  panel.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">Analysis complete ✅</div>
    <div>Decision: ${decision || 'N/A'}</div>
    <div style="font-size: 12px; color: #555; margin-top: 4px; margin-bottom: 6px;">
      Check console for full JSON response.
    </div>
    <button id="haggleos-history-btn" style="
      margin-top:4px;
      font-size:11px;
      border:none;
      background:none;
      color:#2563eb;
      cursor:pointer;
      padding:0;
    ">
      View history
    </button>
  `;
  panel.style.display = 'block';
  attachPanelCloseButton(panel);

  const historyBtn = panel.querySelector('#haggleos-history-btn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => renderHistory(panel));
  }
}

// ---- MAIN INIT ----

function initHaggleOS() {
  // Load settings in the background
  loadSettings();

  // 0) Only run on product pages (URLs that contain /itm/)
  if (!location.pathname.includes('/itm/')) {
    console.log('HaggleOS: Not a product page, skipping.');
    return;
  }

  // Avoid duplicates if something runs twice
  if (document.getElementById('haggleos-analyze-button')) {
    return;
  }

  // 1) Create the Analyze button
  const button = document.createElement('button');
  button.id = 'haggleos-analyze-button';
  button.innerText = 'Analyze Deal';

  // 2) Style it (bottom-left floating)
  Object.assign(button.style, {
    position: 'fixed',
    left: '20px',
    bottom: '20px',
    zIndex: '9999',
    padding: '10px 16px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  });

  // SETTINGS BUTTON
  const settingsButton = document.createElement('button');
  settingsButton.id = 'haggleos-settings-button';
  settingsButton.innerText = '⚙';
  Object.assign(settingsButton.style, {
    position: 'fixed',
    left: '20px',
    bottom: '60px',
    zIndex: '9999',
    width: '32px',
    height: '32px',
    borderRadius: '16px',
    border: 'none',
    backgroundColor: '#e5e7eb',
    color: '#111',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    fontSize: '16px',
    lineHeight: '32px',
    textAlign: 'center',
    padding: '0',
  });

  settingsButton.addEventListener('click', () => {
    const panel = createOrGetSettingsPanel();
    if (panel.style.display === 'none' || panel.style.display === '') {
      renderSettingsPanel(panel); // refresh values from currentSettings
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
  });

  // 3) Click handler: guard, scrape data, show loading UI & send to API
  button.addEventListener('click', async () => {
    if (isAnalyzing) {
      // Ignore extra clicks while we're already analyzing
      return;
    }
    isAnalyzing = true;

    // visually disable button
    button.disabled = true;
    button.innerText = '⏳ Analyzing...';
    button.style.opacity = '0.7';
    button.style.cursor = 'not-allowed';

    console.log('HaggleOS: Analyze button clicked.');

    // --- PANEL: show "Scanning..." UI with dots animation ---
    const panel = createOrGetPanel();
    startLoadingAnimation(panel);

    // --- TITLE ---
    let titleEl =
      document.querySelector('h1.x-item-title__mainTitle span.ux-textspans') ||
      document.querySelector('h1.x-item-title__mainTitle') ||
      document.querySelector('h1[itemprop="name"]') ||
      document.querySelector('h1');

    const title = titleEl ? titleEl.innerText.trim() : null;

    // --- PRICE ---
    let priceEl =
      document.querySelector('.x-price-primary .ux-textspans') ||
      document.querySelector('.x-price-primary') ||
      document.querySelector('[itemprop="price"]') ||
      document.querySelector('.x-bin-price .ux-textspans') ||
      document.querySelector('.x-buybox__price-section .ux-textspans');

    const rawPrice = priceEl ? priceEl.innerText.trim() : null;

    let currency = null;
    let price_value = null;

    if (rawPrice) {
      const symbolMatch = rawPrice.match(/[£$€]/);
      const symbol = symbolMatch ? symbolMatch[0] : null;

      if (symbol === '£') currency = 'GBP';
      else if (symbol === '$') currency = 'USD';
      else if (symbol === '€') currency = 'EUR';

      if (!currency) {
        if (location.host.includes('.co.uk')) currency = 'GBP';
        else if (location.host.includes('.com')) currency = 'USD';
      }

      const numberMatch = rawPrice.match(/[\d.,]+/g);
      if (numberMatch && numberMatch.length > 0) {
        const firstNumber = numberMatch[0].replace(/,/g, '');
        const parsed = parseFloat(firstNumber);
        if (!Number.isNaN(parsed)) {
          price_value = parsed;
        }
      }
    }

    // --- IMAGE URL ---
    let imgEl =
      document.querySelector('img[data-zoom-src]') ||
      document.querySelector('img[data-idx="0"][src*="i.ebayimg.com"]') ||
      document.querySelector('img[src*="i.ebayimg.com"]') ||
      document.querySelector('img');

    let imageUrl = null;
    if (imgEl) {
      imageUrl = imgEl.getAttribute('data-zoom-src') || imgEl.src;
    }

    const source = 'ebay';

    const payload = {
      title,
      price_value,
      currency,
      imageUrl,
      source,
      settings: {
        max_overpay_percent: currentSettings.max_overpay_percent,
        negotiation_style: currentSettings.negotiation_style,
        timeout_seconds: currentSettings.timeout_seconds,
      },
    };

    console.log('HaggleOS payload (before sending):', payload);

    const API_URL = 'https://haggle-os-poc.vercel.app/api/analyse'; // make sure this matches your backend

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('HaggleOS: API error status', response.status);
        showError(panel, `API error (status ${response.status}).`);
      } else {
        const result = await response.json();
        console.log('HaggleOS result from API:', result);

        // store last result in memory for "Back to result" in history view
        lastResult = result;
        lastPayload = payload;

        renderResult(panel, result, payload);
        addHistoryEntry(result, payload);
      }
    } catch (err) {
      console.error('HaggleOS: Failed to call API', err);
      showError(panel, 'Failed to reach backend. Please try again.');
    } finally {
      // Re-enable button
      isAnalyzing = false;
      button.disabled = false;
      button.innerText = 'Analyze Deal';
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
  });

  // 4) Attach to page
  document.body.appendChild(button);
  document.body.appendChild(settingsButton);

  console.log('HaggleOS: Analyze button & settings button injected on product page.');
}

// 5) Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHaggleOS);
} else {
  initHaggleOS();
}
