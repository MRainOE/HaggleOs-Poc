// content.js

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

    // 3) Click handler: scrape data & send to API
  button.addEventListener('click', async () => {
    console.log('HaggleOS: Analyze button clicked.');

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

    // --- SEND TO API ---
    const API_URL = "https://haggle-os-poc.vercel.app/api/analyze"; 

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('HaggleOS: API error status', response.status);
        return;
      }

      const result = await response.json();
      console.log('HaggleOS result from API:', result);
      // Later: show this nicely in a popup instead of just console.log
    } catch (err) {
      console.error('HaggleOS: Failed to call API', err);
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
