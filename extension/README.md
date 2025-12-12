# HaggleOS 

**HaggleOS Deal Analyzer** is a Chrome Extension that acts as a negotiation coach for eBay. It injects directly into product pages to analyze listing prices against market data, detect item defects, and generate AI-powered negotiation scripts.

## 🚀 Features

* **Smart Deal Analysis:** Automatically detects listing details (price, condition, shipping, images) on eBay item pages.
* **Market Comparison:** Calculates the difference between the listing price and the estimated market value to determine if a deal is "Overpriced" or a "Negotiation opportunity".
* **AI Negotiation Coach:**
    * Generates ready-to-copy messages tailored to the seller.
    * Supports three negotiation styles: **Soft**, **Normal**, and **Aggressive**.
    * Identifies potential item defects to leverage in negotiations.
* **History Dashboard:** Tracks your last 5 analyzed deals, including the decision (Abort vs. Negotiate) and suggested offers.
* **Data Export:** Allows you to export your deal history to a JSON file for external tracking.
* **Configurable Settings:**
    * **Max Overpay %:** Set your threshold for when to walk away from a deal.
    * **Timeout:** Adjust how long the extension waits for the analysis backend.

## 📂 File Structure

* `manifest.json` - Extension configuration, permissions (`activeTab`, `storage`, `tabs`), and host matching (`*.ebay.com`, `*.ebay.co.uk`).
* `content.js` - The core script that injects the "Analyze Deal" button, scrapes listing data, and communicates with the backend API.
* `background.js` - Manages the extension icon click event to open or focus the main Dashboard.
* `dashboard.html` / `.css` / `.js` - The UI for viewing history, exporting data, and managing settings.

## 🛠️ Installation

1.  Download the source code and ensure all files are in a single folder named `HaggleOS`.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top-right corner.
4.  Click **Load unpacked**.
5.  Select the `Extension` folder.

## 📖 Usage Guide

### 1. Analyzing a Deal
1.  Go to any eBay product page. **Note:** The URL must contain `/itm/` for the tool to activate.
2.  Look for the **Analyze Deal** button in the bottom-left corner of the window.
3.  Click it to start the analysis. The tool will:
    * Check market prices.
    * Inspect images.
    * Provide a verdict (Negotiate or Abort) and a draft message.

### 2. Changing Settings
Click the **Gear (⚙)** icon located above the "Analyze Deal" button on the eBay page to configure:
* **Max % over market:** Defines when the AI suggests aborting the deal.
* **Negotiation style:** Choose between *Soft / very polite*, *Normal*, or *More direct*.
* **Timeout:** Set the API timeout duration (10–600 seconds).

### 3. Using the Dashboard
Click the HaggleOS extension icon in your browser toolbar to open the Dashboard.
* **History:** View a summary of your recent analyses.
* **Export:** Click "Export History" to download a `haggleos-history.json` file.
* **Clear:** Wipe your local history storage.

## 🔒 Privacy & Permissions

* **activeTab:** Used to access listing details only when you are on an eBay product page.
* **storage:** Used to save your settings and deal history locally in your browser.
* **API Usage:** This extension sends listing data (title, price, image URLs) to `https://haggle-os-poc.vercel.app/api/analyse` for processing.

---s
*Version 1.0.0*