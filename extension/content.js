// content.js

let isAnalyzing = false;

function createOrGetPanel() {
  let panel = document.getElementById('haggleos-panel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'haggleos-panel';

  Object.assign(panel.style, {
    position: 'fixed',
    right: '20px',
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
}

function initHaggleOS() {
  // 0) Only run on product pages (URLs that contain /itm/)
  if (!location.pathname.includes('/itm/')) {
    console.log('HaggleOS: Not a product page, skipping.');
    return;
  }

  // Avoid duplicates if something runs twice
  if (document.getElementById('haggleos-analyze-button')) {
    return;
  }

  // 1) Create the button
  const button = document.createElement('button');
  button.id = 'haggleos-analyze-button';
  button.innerText = 'Analyze Deal';

  // 2) Style it (bottom-right floating)
  Object.assign(button.style, {
    position: 'fixed',
    right: '20px',
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
    };

    console.log('HaggleOS payload (before sending):', payload);

    const API_URL = 'https://haggle-os-poc.vercel.app/api/analyse'; 

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
        // Next phase we'll render result nicely here
        stopLoadingAnimation(panel);
        panel.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 4px;">Analysis complete ✅</div>
          <div>Check console for raw JSON result (UI coming next).</div>
        `;
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

  console.log('HaggleOS: Analyze button injected on product page.');
}

// 5) Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHaggleOS);
} else {
  initHaggleOS();
}
