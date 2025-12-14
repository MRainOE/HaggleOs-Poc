import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function startKestra(webhookUrl: string, inputs: any) {
  const res = await fetchWithTimeout(
    webhookUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputs),
    },
    20_000
  );

  const text = await res.text();
  if (!res.ok) throw new Error(`Kestra webhook failed (${res.status}): ${text}`);

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function pollExecution(executionId: string, baseUrl: string, apiToken?: string) {
  const deadline = Date.now() + 25_000;
  const headers: Record<string, string> = {};
  if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;

  const cleanBase = baseUrl.replace(/\/$/, "");

  while (Date.now() < deadline) {
    const url = `${cleanBase}/api/v1/executions/${executionId}`;
    const res = await fetchWithTimeout(url, { headers }, 10_000);

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { id: executionId, state: { current: "UNKNOWN" }, debug: data };
    }

    const current = data?.state?.current;
    if (current && current !== "RUNNING" && current !== "CREATED") {
      return data;
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  return { id: executionId, state: { current: "TIMEOUT" } };
}

function normalizeImageUrls(body: any): string[] {
  if (Array.isArray(body?.imageUrls)) return body.imageUrls.filter(Boolean);
  if (typeof body?.imageUrl === "string" && body.imageUrl) return [body.imageUrl];
  return [];
}

function toNumber(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  console.log("Received payload at /api/analyse:", body);

  const KESTRA_WEBHOOK_URL = process.env.KESTRA_WEBHOOK_URL;
  const KESTRA_BASE_URL = process.env.KESTRA_BASE_URL;
  const KESTRA_API_TOKEN = process.env.KESTRA_API_TOKEN || "";

  if (!KESTRA_WEBHOOK_URL || !KESTRA_BASE_URL) {
    return NextResponse.json(
      { ok: false, error: "Missing KESTRA_WEBHOOK_URL or KESTRA_BASE_URL in env" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

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
      return NextResponse.json(
        { ok: true, note: "Kestra triggered but no execution id returned", started },
        { headers: CORS_HEADERS }
      );
    }

    const finished = await pollExecution(executionId, KESTRA_BASE_URL, KESTRA_API_TOKEN);
    const outputs = finished?.outputs || {};

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
          state: finished?.state?.current ?? "UNKNOWN",
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("Kestra integration error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Kestra integration failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
