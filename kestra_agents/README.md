# 🤖 AI Negotiator Agents (Kestra Workflow)

This project contains the **Kestra orchestration logic** for an AI-powered eBay negotiation assistant. It uses a multi-agent system to analyze market prices, visually inspect item conditions, and generate strategic negotiation messages.

## 🧠 System Architecture

The workflow is split into three distinct "Agents" managed by a single Kestra Flow:

1.  **🕵️ Agent A: Market Analyst**
    * **Goal:** Determine if the item is a "good deal" compared to the live market.
    * **Tools:** SerpApi (Google Shopping), Google Gemini.
    * **Output:** A `Verdict` (PASS/ABORT), `Market Price`, and `Suggested Offer`.

2.  **👁️ Agent B: Vision Inspector**
    * **Trigger:** Only runs if Agent A returns `PASS`.
    * **Goal:** Detect hidden damage or wear in the product images.
    * **Tools:** Google Gemini (Vision capabilities).
    * **Output:** List of visual defects and condition assessment.

3.  **💬 Agent C: The Negotiator**
    * **Goal:** Draft 3 distinct negotiation messages based on the defects found and the calculated offer price.
    * **Strategies:** *Polite*, *Aggressive* (focusing on defects), and *Concise*.
    * **Output:** JSON list of message drafts.

---

## 🛠️ Prerequisites

* **Docker & Docker Compose** (Installed on Local Machine or Google Cloud VM).
* **API Keys:**
    * **Google Gemini API Key** (AI Models).
    * **SerpApi Key** (Real-time Market Data).

---

## 🐳 Building the Custom Image

Since these agents require specific Python libraries (`google-generativeai`, `serpapi`, `requests`, `Pillow`), you must build the custom Docker image before running the flow.

1.  **Inspect the `Dockerfile`:**
    Ensure your `Dockerfile` in the root folder looks similar to this:
    ```dockerfile
    FROM python:3.11-slim
    RUN pip install google-generativeai serpapi requests Pillow kestra
    CMD ["python3"]
    ```

2.  **Build the Image:**
    Run this command in the same folder as your Dockerfile:
    ```bash
    docker build -t negotiator:v1 .
    ```

*Note: The Kestra flow is configured to look for `containerImage: negotiator:v1`.*

---

## **Run with Docker Compose**

Ensure your `docker-compose.yml` is configured to read the `.env` file. Example:

```yaml
version: "3"
services:
    kestra:
        image: kestra/kestra:latest
        restart: always
        ports:
            - "8080:8080"
        env_file:
            - .env
        volumes:
            - /var/run/docker.sock:/var/run/docker.sock
            - ./kestra-data:/app/storage
```

Start the server:

```bash
docker compose up -d
```

## **Importing the Flow**

1. Open the Kestra UI: `http://localhost:8080` (or your Cloud IP).
2. Navigate to `Flows` > `Create`.
3. Copy the content of your flow file (for example `negotiator_flow.yaml`) into the editor.
4. Save the Flow.

Alternatively, you can import the flow directly from the repository file:

1. In the Kestra UI go to `Flows` > `Import`.
2. Choose the file `kestra_agents/negotiator_flow.yml` from this repository and upload it.
3. Save the imported flow.

Note: The included flow in `kestra_agents/negotiator_flow.yml` defines a webhook trigger. After importing, you can trigger the flow via the webhook endpoint:

```
POST http://localhost:8080/api/v1/executions/webhook/com.haggleos/haggle-decision-engine/haggle-key
```

This webhook URL is built from the `namespace` (`com.haggleos`), the flow `id` (`haggle-decision-engine`), and the trigger `key` defined in `negotiator_flow.yml`.

## **API Usage (Chrome Extension Integration)**

To trigger this flow from an external app (like a Chrome Extension), send a POST request to the trigger endpoint.

- Endpoint (example): `POST /api/v1/executions/trigger/my.namespace/negotiator-flow`
- Headers: Content-Type: `multipart/form-data`

Body (Form Data):

Key | Type | Description
:---|:----:|:-----------
`title` | String | The eBay product title.
`price_value` | Float | The current list price (e.g., `150.00`).
`condition` | String | `New`, `Used`, or `Refurbished`.
`imageUrls` | JSON String | A list of image URLs: `["http://...", "http://..."]`.

Example (JavaScript / Fetch):

```javascript
const formData = new FormData();
formData.append("title", "Sony XM4 Headphones");
formData.append("price_value", "200");
formData.append("condition", "Used");
formData.append("imageUrls", JSON.stringify(["https://img.ebay.com/1.jpg", "https://img.ebay.com/2.jpg"]));

fetch("http://<YOUR_IP_OR_HOST>:8080/api/v1/executions/trigger/my.namespace/negotiator-flow", {
        method: "POST",
        body: formData
});
```

> Note: If your flow expects API keys as inputs (`SERPAPI_KEY`, `GEMINI_API_KEY`) you can either:

- Include them in the form data (not recommended for public clients), or
- Configure them as secrets in Kestra and reference them via `SECRET_*` environment variables (preferred).

## **Outputs**

The flow returns a JSON object similar to the following:

```json
{
    "decision": "NEGOTIATE",
    "market_price": 180.50,
    "suggested_offer": 160.00,
    "defects_found": [
        {"visual_condition": "Used", "damage_detected": true, "description": "Scratch on ear cup"}
    ],
    "draft_messages": [
        {"style": "Polite", "message": "Hi, would you take $160?"},
        {"style": "Aggressive", "message": "I see scratches on the ear cup. $160 is fair."}
    ]
}
```

## **Troubleshooting**

- Error: `Cannot find secret for key...`

    - Make sure your variables in `.env` start with `SECRET_` (Kestra uses the `SECRET_` prefix for secrets).
    - After editing `.env`, restart the Docker Compose stack:

        ```bash
        docker compose down
        docker compose up -d
        ```

- Gemini / SerpApi Errors:

    - Check if your Base64 encoding is correct for secrets expected by Kestra. Verify by decoding:

        ```bash
        echo "YOUR_BASE64" | base64 -d
        ```

- Agent Script Failure (Module Not Found):

    - Ensure you built the custom image referenced by the flow:

        ```bash
        docker build -t negotiator:v1 .
        ```

    - Ensure the Kestra flow YAML references `containerImage: negotiator:v1`.
