import { NextResponse } from "next/server";

// Standard CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// --- HELPERS ---

// Helper: Safely convert input to number
function toNumber(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Helper: Normalize images to array
function normalizeImageUrls(body: any): string[] {
  if (Array.isArray(body?.imageUrls)) return body.imageUrls.filter(Boolean);
  if (typeof body?.imageUrl === "string" && body.imageUrl) return [body.imageUrl];
  return [];
}

// Helper: Start the Kestra Flow (Webhook)
async function startKestra(webhookUrl: string, inputs: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout to start

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputs),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`Kestra webhook failed (${res.status}): ${text}`);

    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper: Check status of an existing execution (One-time check, no loop)
async function getExecutionStatus(executionId: string, baseUrl: string, apiToken?: string) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const url = `${cleanBase}/api/v1/executions/${executionId}`;

  const headers: Record<string, string> = {};
  if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for check

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
       // If 404, it might still be initializing, so we treat as RUNNING/UNKNOWN
       return { state: "UNKNOWN", outputs: {} };
    }
    return await res.json();
  } catch (err) {
    console.error("Status check failed:", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- MAIN HANDLER ---

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  console.log("API received:", body?.action || "New Analysis", body?.title || body?.executionId);

  const KESTRA_WEBHOOK_URL = process.env.KESTRA_WEBHOOK_URL;
  const KESTRA_BASE_URL = process.env.KESTRA_BASE_URL;
  const KESTRA_API_TOKEN = process.env.KESTRA_API_TOKEN || "";

  if (!KESTRA_WEBHOOK_URL || !KESTRA_BASE_URL) {
    return NextResponse.json(
      { ok: false, error: "Missing Server Env Config" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // ==========================================
  // SCENARIO A: CHECK STATUS (Polling)
  // ==========================================
  if (body.action === "check_status" && body.executionId) {
    try {
      const data = await getExecutionStatus(body.executionId, KESTRA_BASE_URL, KESTRA_API_TOKEN);
      const current = data?.state?.current;

      if (current === "RUNNING" || current === "CREATED" || current === "QUEUED" || current === "UNKNOWN") {
        return NextResponse.json(
          { complete: false, state: current },
          { headers: CORS_HEADERS }
        );
      }

      // If finished (SUCCESS, FAILED, WARNING), parse results
      const outputs = data?.outputs || {};
      
      // Parse messages (Agent C logic)
      const draftMessages = Array.isArray(outputs?.draft_messages) ? outputs.draft_messages : [];
      const draftMessage =
        draftMessages.find((m: any) => m?.style === "Polite")?.message ||
        draftMessages[0]?.message ||
        "";

      return NextResponse.json({
        complete: true,
        state: current,
        // The frontend expects these exact fields:
        decision: outputs?.decision ?? "ABORT",
        market_price: outputs?.market_price ?? 0,
        suggested_offer: outputs?.suggested_offer ?? 0,
        defects_found: outputs?.defects_found ?? [],
        draft_messages: draftMessages,
        draft_message: draftMessage,
      }, { headers: CORS_HEADERS });

    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: "Failed to check status" },
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ==========================================
  // SCENARIO B: START NEW ANALYSIS
  // ==========================================
  
  // Prepare Kestra inputs
  const kestraInputs = {
    title: body?.title ?? "",
    price_value: toNumber(body?.price_value ?? body?.listing_price) ?? 0,
    currency: body?.currency ?? "USD",
    imageUrls: normalizeImageUrls(body),
    condition: body?.condition ?? "Used",
  };

  try {
    const started = await startKestra(KESTRA_WEBHOOK_URL, kestraInputs);
    
    // Get the ID depending on how Kestra returns it
    const executionId = started?.id || started?.executionId || started?.execution?.id;

    if (!executionId) {
      throw new Error("Kestra started but returned no Execution ID");
    }

    // Return the ID immediately so frontend can poll
    return NextResponse.json(
      { ok: true, executionId: executionId },
      { headers: CORS_HEADERS }
    );

  } catch (err: any) {
    console.error("Kestra start error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to start workflow" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}