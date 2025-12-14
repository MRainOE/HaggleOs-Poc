import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const executionId = url.searchParams.get("executionId");

  if (!executionId) {
    return NextResponse.json(
      { ok: false, error: "Missing executionId query param" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const KESTRA_BASE_URL = process.env.KESTRA_BASE_URL;
  const KESTRA_API_TOKEN = process.env.KESTRA_API_TOKEN || "";

  if (!KESTRA_BASE_URL) {
    return NextResponse.json(
      { ok: false, error: "Missing KESTRA_BASE_URL in env" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const headers: Record<string, string> = {};
  if (KESTRA_API_TOKEN) headers["Authorization"] = `Bearer ${KESTRA_API_TOKEN}`;

  const cleanBase = KESTRA_BASE_URL.replace(/\/$/, "");
  const targetUrl = `${cleanBase}/api/v1/main/executions/${executionId}`;

  try {
    const res = await fetchWithTimeout(targetUrl, { headers }, 15_000);
    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      return NextResponse.json(
        { ok: false, error: `Kestra status fetch failed (${res.status})` },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const state = data?.state?.current || "UNKNOWN";

    if (state === "RUNNING" || state === "CREATED") {
      return NextResponse.json({ ok: true, state }, { headers: CORS_HEADERS });
    }

    const outputs = data?.outputs || {};
    const draftMessages = Array.isArray(outputs?.draft_messages) ? outputs.draft_messages : [];
    const draftMessage =
      draftMessages.find((m: any) => m?.style === "Polite")?.message ||
      draftMessages[0]?.message ||
      "";

    return NextResponse.json(
      {
        decision: outputs?.decision ?? "ABORT",
        market_price: outputs?.market_price ?? 0,
        suggested_offer: outputs?.suggested_offer ?? 0,
        defects_found: outputs?.defects_found ?? [],
        draft_messages: draftMessages,
        draft_message: draftMessage,
        _kestra: {
          execution_id: executionId,
          state,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("Kestra status error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Kestra status fetch failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
