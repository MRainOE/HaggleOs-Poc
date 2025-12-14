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

function extractTenantFromWebhook(webhookUrl?: string | null): string | null {
  if (!webhookUrl) return null;
  const match = webhookUrl.match(/\/api\/v\d+\/([^/]+)\/executions\/webhook/i);
  return match?.[1] || null;
}

function buildTenantSegment(rawTenant?: string | null): string {
  if (!rawTenant) return "";
  const cleaned = rawTenant.replace(/^\/+|\/+$/g, "");
  return cleaned ? `/${cleaned}` : "";
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

// ⚠️ ENHANCED: Better debugging for Kestra response structures
async function getExecutionStatus(executionId: string, baseUrl: string, apiToken?: string, tenant?: string) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const tenantSegment = buildTenantSegment(tenant);
  const url = `${cleanBase}/api/v1${tenantSegment}/executions/${executionId}`;

  console.log('🔍 DEBUG: Fetching status from URL:', url);

  const headers: Record<string, string> = {};
  if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    
    console.log('🔍 DEBUG: HTTP Status:', res.status);
    
    if (!res.ok) {
      console.log(`❌ Kestra API returned ${res.status} for execution ${executionId}`);
      const errorText = await res.text();
      console.log('❌ Error response body:', errorText);
      return { 
        state: { current: "UNKNOWN" },
        outputs: {},
        _debug_error: `HTTP ${res.status}: ${errorText}`
      };
    }
    
    const data = await res.json();
    
    // 🔍 COMPREHENSIVE DEBUG LOGGING
    console.log('='.repeat(80));
    console.log('🔍 FULL KESTRA API RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(80));
    
    console.log('🔍 STRUCTURE ANALYSIS:', {
      hasState: !!data.state,
      stateType: typeof data.state,
      stateValue: data.state,
      hasStateCurrent: !!data?.state?.current,
      stateCurrentValue: data?.state?.current,
      topLevelKeys: Object.keys(data),
      hasOutputs: !!data.outputs,
      outputsKeys: data.outputs ? Object.keys(data.outputs) : []
    });
    
    return data;
    
  } catch (err: any) {
    console.error("❌ Status check failed:", err);
    console.error("❌ Error details:", {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    return { 
      state: { current: "UNKNOWN" },
      outputs: {},
      _debug_error: err.message
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- MAIN HANDLER ---

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  console.log("📥 API received:", body?.action || "New Analysis", body?.title || body?.executionId);

  const KESTRA_WEBHOOK_URL = process.env.KESTRA_WEBHOOK_URL;
  const KESTRA_BASE_URL = process.env.KESTRA_BASE_URL;
  const KESTRA_API_TOKEN = process.env.KESTRA_API_TOKEN || "";
  const KESTRA_TENANT =
    process.env.KESTRA_TENANT || extractTenantFromWebhook(KESTRA_WEBHOOK_URL) || undefined;

  console.log('🔧 Environment config:', {
    hasWebhookUrl: !!KESTRA_WEBHOOK_URL,
    hasBaseUrl: !!KESTRA_BASE_URL,
    hasApiToken: !!KESTRA_API_TOKEN,
    tenant: KESTRA_TENANT,
    baseUrl: KESTRA_BASE_URL
  });

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
    console.log('🔄 STATUS CHECK for execution:', body.executionId);
    
    try {
      const data = await getExecutionStatus(
        body.executionId,
        KESTRA_BASE_URL,
        KESTRA_API_TOKEN,
        KESTRA_TENANT
      );
      
      // ✅ ENHANCED: Handle BOTH possible structures + more logging
      let current: string | undefined;
      
      console.log('🔍 Parsing state from response...');
      
      if (typeof data?.state === 'string') {
        // Flat structure: { state: "SUCCESS" }
        current = data.state;
        console.log(`✅ Found FLAT state structure: ${current}`);
      } else if (typeof data?.state?.current === 'string') {
        // Nested structure: { state: { current: "SUCCESS" } }
        current = data.state.current;
        console.log(`✅ Found NESTED state structure: ${current}`);
      } else {
        console.warn('⚠️ Unknown state structure:', {
          stateType: typeof data?.state,
          stateValue: data?.state,
          fullData: data
        });
        current = "UNKNOWN";
      }

      console.log(`📊 Final parsed state for ${body.executionId}: ${current}`);

      // Define state categories
      const runningStates = ["RUNNING", "CREATED", "QUEUED", "UNKNOWN", "PAUSED"];
      const completeStates = ["SUCCESS", "FAILED", "WARNING", "KILLED"];
      
      console.log('🔍 State classification:', {
        current,
        isRunning: runningStates.includes(current || ''),
        isComplete: completeStates.includes(current || ''),
        runningStates,
        completeStates
      });
      
      // Check if still running
      if (!current || runningStates.includes(current)) {
        console.log(`⏳ Execution ${body.executionId} is still RUNNING (state: ${current || "UNKNOWN"})`);
        return NextResponse.json(
          { complete: false, state: current || "UNKNOWN" },
          { headers: CORS_HEADERS }
        );
      }

      // Check if completed
      if (completeStates.includes(current)) {
        console.log(`✅ Execution ${body.executionId} COMPLETED with state: ${current}`);
        
        // Parse outputs
        const outputs = data?.outputs || {};
        
        console.log('📦 Processing outputs:', {
          hasOutputs: !!data.outputs,
          outputKeys: Object.keys(outputs),
          hasDecision: !!outputs.decision,
          decision: outputs.decision,
          hasMarketPrice: !!outputs.market_price,
          marketPrice: outputs.market_price,
          hasDraftMessages: !!outputs.draft_messages,
          fullOutputs: outputs
        });
        
        const draftMessages = Array.isArray(outputs?.draft_messages) 
          ? outputs.draft_messages 
          : [];
        
        const draftMessage =
          draftMessages.find((m: any) => m?.style === "Polite")?.message ||
          draftMessages[0]?.message ||
          "";

        const response = {
          complete: true,
          state: current,
          decision: outputs?.decision ?? "ABORT",
          market_price: outputs?.market_price ?? 0,
          suggested_offer: outputs?.suggested_offer ?? 0,
          defects_found: outputs?.defects_found ?? [],
          draft_messages: draftMessages,
          draft_message: draftMessage,
        };
        
        console.log('📤 Sending complete response:', response);

        return NextResponse.json(response, { headers: CORS_HEADERS });
      }

      // Unknown state - treat as still running
      console.warn(`⚠️ Unexpected state: ${current}, treating as running`);
      return NextResponse.json(
        { complete: false, state: current },
        { headers: CORS_HEADERS }
      );

    } catch (err: any) {
      console.error("❌ Unexpected error in status check:", err);
      console.error("❌ Error stack:", err.stack);
      return NextResponse.json(
        { complete: false, state: "ERROR", error: err?.message },
        { headers: CORS_HEADERS }
      );
    }
  }

  // ==========================================
  // START NEW ANALYSIS
  // ==========================================
  
  console.log('🚀 Starting new analysis...');
  
  const kestraInputs = {
    title: body?.title ?? "",
    price_value: toNumber(body?.price_value ?? body?.listing_price) ?? 0,
    currency: body?.currency ?? "USD",
    imageUrls: normalizeImageUrls(body),
    condition: body?.condition ?? "Used",
  };

  console.log('📦 Kestra inputs:', kestraInputs);

  try {
    const started = await startKestra(KESTRA_WEBHOOK_URL, kestraInputs);
    console.log('📥 Kestra start response:', started);
    
    const executionId = started?.id || started?.executionId || started?.execution?.id;

    if (!executionId) {
      console.error('❌ No execution ID found in response:', started);
      throw new Error("Kestra started but returned no Execution ID");
    }

    console.log(`✅ Started execution: ${executionId}`);

    return NextResponse.json(
      { ok: true, executionId: executionId },
      { headers: CORS_HEADERS }
    );

  } catch (err: any) {
    console.error("❌ Kestra start error:", err);
    console.error("❌ Error details:", {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to start workflow" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}