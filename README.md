# 🦅 HaggleOS : The AI Bargain Agent

<div align="center">

![Kestra](https://img.shields.io/badge/Orchestrated%20with-Kestra-7c3aed?style=for-the-badge&logo=kestra&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Next.js](https://img.shields.io/badge/Built%20with-Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)

**🏆 Submission for WeMakeDevs AI Agents Assemble Hackathon** 

Tracks - Kestra, Vercel 

</div>

---

## 💡 The Problem
We all love a bargain on eBay or Facebook Marketplace, but finding one is hard work. You have to:
1.  **Check prices** across the web to ensure you aren't being ripped off.
2.  **Inspect photos** pixel-by-pixel to find hidden damage.
3.  **Negotiate** with sellers, which is awkward, time-consuming, and emotionally draining.

## 🦅 The Solution: HaggleOS
**HaggleOS** is a multi-agent AI system that lives in your browser. It doesn't just watch listings; it **thinks, analyzes, and negotiates** for you.

Using a hybrid **Chrome Extension + Kestra + Vercel** architecture, HaggleOS deploys a team of 3 specialized AI agents to every product you view:
1.  **📉 Agent A (Market Analyst):** Scrapes real-time market data via Google Shopping API to find the *true* market value and determine if the listing is overpriced.
2.  **👁️ Agent B (Vision Inspector):** Uses Google Gemini Vision AI to spot scratches, dents, rust, and hidden defects in listing photos.
3.  **💬 Agent C (The Negotiator):** Drafts perfect, psychology-backed negotiation messages in 3 different styles based on the defects found and market analysis.

---

## 🏗️ Architecture: How It All Works Together

HaggleOS is built with three interconnected components that work seamlessly together:

### **1. 🔌 Chrome Extension** (`/extension`)
The browser extension is your interface to HaggleOS. When you're browsing eBay listings:

- **Detects eBay product pages** automatically (looks for `/itm/` in URL)
- **Scrapes listing data**: title, price, currency, condition, images, shipping details
- **Injects "Analyze Deal" button** in the bottom-left corner of the page
- **Sends payload to Vercel API** when you click the button
- **Displays results** in a clean panel: decision (NEGOTIATE/ABORT), market price, suggested offer, and ready-to-send negotiation messages
- **Saves history** of your last 5 analyses in Chrome storage

**Key Files:**
- `content.js` - Main script that scrapes eBay data and handles UI
- `background.js` - Service worker for extension lifecycle
- `dashboard_bridge.js` - Bridge between extension and dashboard
- `manifest.json` - Extension configuration

### **2. ⚡ Vercel Next.js API** (`/haggle_vercel`)
Hosted at `https://haggle-os-poc.vercel.app`, this serves two purposes:

**API Route** (`/app/api/analyse/route.ts`):
- Receives product data from the Chrome extension
- Forwards it to the Kestra workflow via webhook
- Polls the Kestra execution until completion (with timeout)
- Returns formatted results back to the extension

**Dashboard** (`/app/dashboard`):
- Beautiful web interface to view your analysis history
- Shows past decisions, market prices, and negotiation drafts
- Communicates with the Chrome extension via message bridge
- Export and clear history features

**Environment Variables Required:**
```env
KESTRA_WEBHOOK_URL=http://your-kestra-instance:8080/api/v1/executions/webhook/com.haggleos/haggle-decision-engine/TeamWaterSecretKey
KESTRA_BASE_URL=http://your-kestra-instance:8080
```

### **3. 🤖 Kestra AI Agents** (`/kestra_agents`)
Deployed on **Google Cloud** (VM instance running Kestra), this is where the magic happens.

**Multi-Agent Workflow** (`negotiator_flow.yml`):

```
📥 Webhook Trigger
    ↓
🕵️ Agent A: Market Analyst
    • Uses SerpAPI to fetch Google Shopping results
    • Uses Google Gemini to filter exact product matches
    • Calculates market price from cheapest 3 matches
    • Determines PASS/FAIL verdict based on condition
    • Outputs: verdict, market_price, suggested_offer
    ↓
🔀 Conditional Logic (only if PASS)
    ↓
👁️ Agent B: Vision Inspector
    • Downloads all product images
    • Uses Google Gemini Vision to analyze each image
    • Detects defects, damage, wear and tear
    • Outputs: visual_condition, damage_detected, description
    ↓
💬 Agent C: The Negotiator
    • Takes defects + suggested offer
    • Uses Google Gemini to generate 3 negotiation messages:
      - Polite (respectful, quick payment focus)
      - Aggressive (emphasizes defects heavily)
      - Concise (one sentence, casual)
    • Outputs: draft_messages array
    ↓
📤 Final Output
    • decision: "NEGOTIATE" or "ABORT"
    • market_price, suggested_offer
    • defects_found array
    • draft_messages array
```

**Deployment:**
- Kestra runs in Docker on Google Cloud VM
- Custom Python Docker image (`negotiator:v1`) with dependencies: `google-generativeai`, `serpapi`, `requests`, `Pillow`, `kestra`
- Secrets managed in Kestra: `SERP_API_KEY`, `GEMINI_API_KEY`, `TRIGGER_KEY`

---

## 🔄 Complete Flow Example

```
User browses eBay → Opens "iPhone 12 - $400" listing
        ↓
Chrome Extension detects /itm/ URL → Injects "Analyze Deal" button
        ↓
User clicks button → Extension scrapes: title, price, images, condition
        ↓
Extension sends payload → Vercel API (https://haggle-os-poc.vercel.app/api/analyse)
        ↓
Vercel triggers Kestra webhook → http://34.55.115.14:8080/api/v1/executions/webhook/...
        ↓
🤖 Agent A (Market Analyst) runs:
   • Searches Google Shopping for "iPhone 12"
   • Finds 15 listings, filters exact matches
   • Market price: $350 (cheapest 3 average)
   • Verdict: PASS (within acceptable range for Used)
        ↓
🤖 Agent B (Vision Inspector) runs:
   • Downloads 5 product images
   • Gemini Vision detects: "Minor scratches on screen, small dent on corner"
        ↓
🤖 Agent C (Negotiator) generates:
   • Polite: "Hi! I'm interested in your iPhone 12. I noticed some wear. Would you accept $340?"
   • Aggressive: "The screen has scratches and there's a dent. Best I can do is $320."
   • Concise: "$340 cash today, let me know!"
        ↓
Kestra returns results → Vercel API polls until completion
        ↓
Vercel formats response → Sends to Extension
        ↓
Extension displays panel:
   ✅ Decision: NEGOTIATE
   📊 Market Price: $350
   💰 Suggested Offer: $340
   💬 3 ready-to-send messages
   📸 Defects found: scratches, dent
        ↓
User copies message → Pastes in eBay → Sends offer 🎉
```

---

## 📝 Project Description

HaggleOS is an intelligent Chrome extension that transforms online shopping into a data-driven negotiation powerhouse. When browsing eBay listings, it deploys three specialized AI agents that analyze market prices, inspect photos for defects, and generate persuasive negotiation messages.

**Built with Kestra + Vercel** to showcase the power of multi-agent orchestration in real-world applications. Kestra handles the complex AI workflow execution with conditional logic and secrets management, while Vercel provides the fast API layer and beautiful dashboard interface.

**Real Impact:** Helps shoppers make informed decisions and save money by providing instant market analysis, visual defect detection, and ready-to-send negotiation messages tailored to each listing.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Chrome Browser
- API Keys: Google Gemini API, SerpAPI

### 1. Setup Kestra (Google Cloud)
```bash
cd kestra_agents
docker build -t negotiator:v1 .
docker compose up -d
```

Access Kestra UI at `http://your-vm-ip:8080`, import `negotiator_flow.yml`, and add secrets.

### 2. Deploy Vercel Dashboard
```bash
cd haggle_vercel
npm install
# Add environment variables in Vercel dashboard
vercel deploy
```

### 3. Install Chrome Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → Select `/extension` folder
4. Extension active! 

### 4. Test It
1. Go to any eBay listing (e.g., `ebay.com/itm/12345`)
2. Click "Analyze Deal" button (bottom-left)
3. Wait 10-30 seconds for AI analysis
4. Get your negotiation strategy!

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Orchestration** | Kestra (Google Cloud VM) |
| **AI Models** | Google Gemini 2.0 Flash, Gemini Vision |
| **Market Data** | SerpAPI (Google Shopping) |
| **Frontend** | Next.js 15, React, TypeScript |
| **Backend API** | Next.js API Routes (Vercel) |
| **Extension** | Chrome Extension Manifest V3 |
| **Hosting** | Vercel (Dashboard), Google Cloud (Kestra) |
| **Containerization** | Docker, Docker Compose |

---

## 📁 Project Structure

```
HaggleOs-Poc/
├── extension/              # Chrome Extension
│   ├── manifest.json
│   ├── content.js         # Main scraping & UI logic
│   ├── background.js      # Service worker
│   └── dashboard_bridge.js
├── haggle_vercel/         # Next.js Dashboard + API
│   ├── app/
│   │   ├── api/analyse/   # Webhook proxy to Kestra
│   │   └── dashboard/     # History UI
│   └── package.json
├── kestra_agents/         # Kestra Workflow
│   ├── negotiator_flow.yml  # Multi-agent pipeline
│   ├── Dockerfile         # Custom Python image
│   └── docker-compose.yml
└── README.md
```

---

## 🎯 Features

✅ **Real-time Market Analysis** - Live Google Shopping data  
✅ **AI Vision Inspection** - Detects hidden defects in photos  
✅ **Smart Negotiation** - 3 message styles (Polite, Aggressive, Concise)  
✅ **One-Click Operation** - No configuration needed  
✅ **History Tracking** - Saves last 5 analyses  
✅ **Multi-Currency Support** - USD, GBP, EUR  
✅ **Conditional Logic** - Only inspects images if deal passes market check  
✅ **Fast Response** - Results in 10-30 seconds  

---

## 🏆 Key Highlights

**Multi-Agent Orchestration** - Three specialized AI agents (Market Analyst, Vision Inspector, Negotiator) work sequentially with conditional logic powered by Kestra

**Hybrid Architecture** - Combines Chrome Extension + Vercel's edge network + Kestra on Google Cloud for optimal performance

**Real User Value** - Solves actual pain points: price research, photo inspection, and negotiation message writing—all automated

**Production Ready** - Deployed and tested on live eBay listings with webhook triggers, polling mechanisms, and error handling

---

## 📝 License

MIT License - feel free to use this for your own bargain hunting!

---

## 🙏 Acknowledgments

Built for the **WeMakeDevs AI Agents Assemble Hackathon**  
Powered by **Kestra** and **Vercel**  
AI by **Google Gemini**  
Market data by **SerpAPI**

---

<div align="center">

**Made with ❤️ by Team Water**

*Happy Haggling! 🦅*

</div>
