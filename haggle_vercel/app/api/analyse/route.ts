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

function toNumber(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeImageUrls(body: any): string[] {
  if (Array.isArray(body?.imageUrls)) return body.imageUrls.filter(Boolean);
  if (typeof body?.imageUrl === "string" && body.imageUrl) return [body.imageUrl];
  return [];
}

async function startKestra(webhookUrl: string, inputs: any) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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

// ⚠️ CRITICAL: Handle both possible Kestra response structures
async function getExecutionStatus(executionId: string, baseUrl: string, apiToken?: string) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const url = `${cleanBase}/api/v1/executions/${executionId}`;

  const headers: Record<string, string> = {};
  if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    
    if (!res.ok) {
      console.log(`Kestra API returned ${res.status} for execution ${executionId}`);
      return { 
        state: { current: "UNKNOWN" },
        outputs: {} 
      };
    }
    
    const data = await res.json();
    
    // 🔍 DEBUG: Log the actual structure we received
    console.log('Kestra API Response Structure:', JSON.stringify({
      hasState: !!data.state,
      stateType: typeof data.state,
      stateValue: data.state,
      hasStateCurrent: !!data?.state?.current,
      stateCurrentValue: data?.state?.current,
      keys: Object.keys(data)
    }, null, 2));
    
    return data;
    
  } catch (err) {
    console.error("Status check failed:", err);
    return { 
      state: { current: "UNKNOWN" },
      outputs: {} 
    };
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
  // CHECK STATUS (Polling Request)
  // ==========================================
  if (body.action === "check_status" && body.executionId) {
    try {
      const data = await getExecutionStatus(body.executionId, KESTRA_BASE_URL, KESTRA_API_TOKEN);
      
      // ✅ FIX: Handle BOTH possible structures
      // Structure 1: { state: { current: "SUCCESS" } }  ← nested
      // Structure 2: { state: "SUCCESS" }                ← flat
      
      let current: string | undefined;
      
      if (typeof data?.state === 'string') {
        // Flat structure
        current = data.state;
        console.log(`Kestra state (flat): ${current}`);
      } else if (typeof data?.state?.current === 'string') {
        // Nested structure
        current = data.state.current;
        console.log(`Kestra state (nested): ${current}`);
      } else {
        console.warn('Unknown state structure:', data?.state);
        current = "UNKNOWN";
      }

      console.log(`Status check for ${body.executionId}: ${current}`);

      // Define state categories
      const runningStates = ["RUNNING", "CREATED", "QUEUED", "UNKNOWN", "PAUSED"];
      const completeStates = ["SUCCESS", "FAILED", "WARNING", "KILLED"];
      
      // Check if still running
      if (!current || runningStates.includes(current)) {
        return NextResponse.json(
          { complete: false, state: current || "UNKNOWN" },
          { headers: CORS_HEADERS }
        );
      }

      // Check if completed
      if (completeStates.includes(current)) {
        console.log(`✅ Execution ${body.executionId} completed with state: ${current}`);
        
        // Parse outputs
        const outputs = data?.outputs || {};
        
        // 🔍 DEBUG: Log what outputs we got
        console.log('Kestra outputs:', JSON.stringify({
          hasDecision: !!outputs.decision,
          decision: outputs.decision,
          hasMarketPrice: !!outputs.market_price,
          marketPrice: outputs.market_price,
          hasDraftMessages: !!outputs.draft_messages,
          outputKeys: Object.keys(outputs)
        }, null, 2));
        
        const draftMessages = Array.isArray(outputs?.draft_messages) 
          ? outputs.draft_messages 
          : [];
        
        const draftMessage =
          draftMessages.find((m: any) => m?.style === "Polite")?.message ||
          draftMessages[0]?.message ||
          "";

        return NextResponse.json({
          complete: true,
          state: current,
          decision: outputs?.decision ?? "ABORT",
          market_price: outputs?.market_price ?? 0,
          suggested_offer: outputs?.suggested_offer ?? 0,
          defects_found: outputs?.defects_found ?? [],
          draft_messages: draftMessages,
          draft_message: draftMessage,
        }, { headers: CORS_HEADERS });
      }

      // Unknown state - treat as still running
      console.warn(`⚠️ Unexpected state: ${current}, treating as running`);
      return NextResponse.json(
        { complete: false, state: current },
        { headers: CORS_HEADERS }
      );

    } catch (err: any) {
      console.error("Unexpected error in status check:", err);
      return NextResponse.json(
        { complete: false, state: "ERROR", error: err?.message },
        { headers: CORS_HEADERS }
      );
    }
  }

  // ==========================================
  // START NEW ANALYSIS
  // ==========================================
  
  const kestraInputs = {
    title: body?.title ?? "",
    price_value: toNumber(body?.price_value ?? body?.listing_price) ?? 0,
    currency: body?.currency ?? "USD",
    imageUrls: normalizeImageUrls(body),
    condition: body?.condition ?? "Used",
  };

  try {
    const started = await startKestra(KESTRA_WEBHOOK_URL, kestraInputs);
    const executionId = started?.id || started?.executionId || started?.execution?.id;

    if (!executionId) {
      throw new Error("Kestra started but returned no Execution ID");
    }

    console.log(`🚀 Started execution: ${executionId}`);

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