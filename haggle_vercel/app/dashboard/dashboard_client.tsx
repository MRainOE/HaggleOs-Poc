"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type Settings = {
  max_overpay_percent?: number;
  negotiation_style?: string;
  timeout_seconds?: number;
  api_base_url?: string;
};

type HistoryItem = {
  title?: string;
  listing_price?: number;
  currency?: string;
  decision?: string;
  market_price?: number;
  suggested_offer?: number;
  listing_url?: string | null;
  timestamp?: number;

  negotiation_draft?: string | null; // ✅ draft field
};

const DEFAULT_SETTINGS: Required<
  Pick<Settings, "max_overpay_percent" | "negotiation_style" | "timeout_seconds">
> = {
  max_overpay_percent: 20,
  negotiation_style: "normal",
  timeout_seconds: 120,
};

function fmtMoney(currency: string | undefined, value: number | undefined) {
  if (typeof value !== "number") return "N/A";
  if (currency === "GBP") return `£${value.toFixed(2)}`;
  if (currency === "USD") return `$${value.toFixed(2)}`;
  if (currency === "EUR") return `€${value.toFixed(2)}`;
  return value.toFixed(2);
}

function fmtTime(ts: number | undefined) {
  if (typeof ts !== "number") return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sendBridgeMessage<T = unknown>(type: string, payload?: unknown, timeoutMs = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Bridge unavailable (window not ready)"));
      return;
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      // @ts-ignore
      if (data.type !== "RESPONSE" || data.requestId !== requestId) return;

      window.removeEventListener("message", handler);
      clearTimeout(timer);
      // @ts-ignore
      if (data.success) {
        // @ts-ignore
        resolve(data.data as T);
      } else {
        // @ts-ignore
        reject(new Error(data.error || "Bridge error"));
      }
    };

    const timer = window.setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Bridge timeout"));
    }, timeoutMs);

    window.addEventListener("message", handler);

    try {
      window.postMessage({ type, requestId, payload }, window.origin);
    } catch (err) {
      window.removeEventListener("message", handler);
      clearTimeout(timer);
      reject(err as Error);
    }
  });
}

/**
 * ✅ Retry wrapper with longer timeout
 * - waits a bit and retries if bridge isn't ready yet
 */
async function sendBridgeMessageRetry<T = unknown>(
  type: string,
  payload?: unknown,
  opts?: { tries?: number; timeoutMs?: number }
): Promise<T> {
  const tries = opts?.tries ?? 3;
  const timeoutMs = opts?.timeoutMs ?? 5000;

  let lastErr: unknown = null;

  for (let i = 0; i < tries; i++) {
    try {
      return await sendBridgeMessage<T>(type, payload, timeoutMs);
    } catch (e) {
      lastErr = e;
      // small backoff: 150ms, 350ms, 550ms...
      await new Promise((r) => setTimeout(r, 150 + i * 200));
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("Bridge unavailable");
}

export default function DashboardClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  // ✅ copy → tick
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ✅ collapsible state per history card
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function CopyIcon() {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 21h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  function TickIcon() {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20 6L9 17l-5-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  function ChevronDownIcon() {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  function ChevronUpIcon() {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M18 15l-6-6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  function decisionBadgeStyle(decision: string): CSSProperties {
    const d = (decision || "").toUpperCase();
    if (d === "NEGOTIATE") {
      return {
        background: "rgba(34,197,94,.15)",
        color: "rgba(34,197,94,1)",
        border: "1px solid rgba(34,197,94,.35)",
      };
    }
    if (d === "ABORT") {
      return {
        background: "rgba(248,113,113,.12)",
        color: "rgba(248,113,113,1)",
        border: "1px solid rgba(248,113,113,.35)",
      };
    }
    return {
      background: "rgba(148,163,184,.12)",
      color: "rgba(148,163,184,1)",
      border: "1px solid rgba(148,163,184,.35)",
    };
  }

  async function copyDraft(draft: string, key: string) {
    try {
      await navigator.clipboard.writeText(draft);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((k) => (k === key ? null : k));
      }, 1200);
    } catch {
      alert("Copy failed — please select the draft text and press Ctrl+C.");
    }
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [settingsData, historyData] = await Promise.all([
          sendBridgeMessageRetry<Settings>("GET_SETTINGS", undefined, { tries: 3, timeoutMs: 5000 }),
          sendBridgeMessageRetry<HistoryItem[]>("GET_HISTORY", undefined, { tries: 3, timeoutMs: 5000 }),
        ]);
        if (cancelled) return;
        setSettings(settingsData || {});
        setHistory(Array.isArray(historyData) ? historyData : []);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message || "Bridge unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayedSettings = useMemo(() => {
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
    };
    return merged;
  }, [settings]);

  async function handleClear() {
    setClearing(true);
    setError(null);
    try {
      await sendBridgeMessageRetry("CLEAR_HISTORY", undefined, { tries: 3, timeoutMs: 5000 });
      const newHistory = await sendBridgeMessageRetry<HistoryItem[]>("GET_HISTORY", undefined, { tries: 3, timeoutMs: 5000 });
      setHistory(Array.isArray(newHistory) ? newHistory : []);
      setExpanded({}); // reset collapses
    } catch (err) {
      setError((err as Error).message || "Failed to clear history");
    } finally {
      setClearing(false);
    }
  }

  function handleExport() {
    downloadJson("haggleos-history.json", history || []);
  }

  function handleOpenEbay() {
    window.open("https://www.ebay.com/", "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <header className="topbar">
        <div className="container topbar__inner">
          <div className="brand">
            <div className="brand__logo">H</div>
            <div>
              <h1 className="brand__title">HaggleOS</h1>
              <p className="brand__subtitle">Deal analysis + negotiation coach for eBay listings.</p>
            </div>
          </div>

          <div className="actions">
            <button className="btn btn--soft" id="btnOpenEbay" onClick={handleOpenEbay}>
              Open eBay
            </button>
            <button className="btn btn--soft" id="btnExport" onClick={handleExport} disabled={history.length === 0}>
              Export History
            </button>
            <button
              className="btn btn--danger"
              id="btnClear"
              onClick={handleClear}
              disabled={clearing || history.length === 0}
            >
              {clearing ? "Clearing..." : "Clear History"}
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        {error && (
          <div className="card" style={{ marginTop: 12, color: "#fecdd3", borderColor: "rgba(248,113,113,.35)" }}>
            Unable to reach the extension bridge. Make sure the Chrome extension is installed and enabled, then reload
            this page. ({error})
          </div>
        )}

        <section className="hero card">
          <div className="hero__left">
            <h2 className="hero__title">Quick start</h2>
            <ol className="steps">
              <li>
                Open an eBay item listing with <code>/itm/</code> in the URL.
              </li>
              <li>
                Look at the <b>bottom-left</b> for <b>Analyze Deal</b>.
              </li>
              <li>Click it to get market price, suggested offer, and a ready-to-send message.</li>
            </ol>

            <div className="pills">
              <span className="pill">Works on: ebay.com / ebay.co.uk</span>
              <span className="pill">Item pages: /itm/</span>
              <span className="pill">History: last 5</span>
            </div>
          </div>

          <div className="hero__right">
            <div className="stat">
              <div className="stat__label">Current settings</div>
              <div id="settingsBox" className="stat__box">
                {loading ? (
                  "Loading..."
                ) : (
                  <div>
                    <div>
                      Max overpay: <b>{displayedSettings.max_overpay_percent}%</b>
                    </div>
                    <div>
                      Style: <b>{displayedSettings.negotiation_style}</b>
                    </div>
                    <div>
                      Timeout: <b>{displayedSettings.timeout_seconds}s</b>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="stat stat--hint">
              <div className="stat__label">Tip</div>
              <div className="stat__box">
                If the button doesn't show, refresh the page and confirm the URL contains <code>/itm/</code>.
              </div>
            </div>
          </div>
        </section>

        <section className="grid">
          <section className="card">
            <div className="card__head">
              <h3 className="card__title">Recent analyses</h3>
              <p className="card__sub">Your latest results saved from the on-page panel.</p>
            </div>

            {/* ✅ collapsible history list (only header shows until expanded) */}
            <div id="historyBox" className="muted">
              {loading && <div>Loading...</div>}

              {!loading && error && <div>{`Failed to load: ${error}`}</div>}

              {!loading && !error && (!history || history.length === 0) && <div>No previous analyses yet.</div>}

              {!loading && !error && Array.isArray(history) && history.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {history.map((h, idx) => {
                    const key = `${h.timestamp ?? "t"}-${idx}`;
                    const isOpen = !!expanded[key];

                    const decision = (h.decision || "UNKNOWN").toUpperCase();
                    const title = h.title || "(no title)";
                    const listing = fmtMoney(h.currency, h.listing_price);
                    const market = fmtMoney(h.currency, h.market_price);
                    const offer =
                      typeof h.suggested_offer === "number" ? fmtMoney(h.currency, h.suggested_offer) : "N/A";
                    const time = fmtTime(h.timestamp);

                    let diffPart: string | null = null;
                    if (
                      typeof h.listing_price === "number" &&
                      typeof h.market_price === "number" &&
                      h.market_price > 0
                    ) {
                      const percent = ((h.listing_price - h.market_price) / h.market_price) * 100;
                      diffPart = `${percent.toFixed(0)}% vs market`;
                    }

                    const draft = typeof h.negotiation_draft === "string" ? h.negotiation_draft : "";

                    return (
                      <div
                        key={key}
                        className="historyItem"
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          border: "1px solid rgba(148,163,184,.22)",
                          background: "rgba(255,255,255,.02)",
                        }}
                      >
                        {/* Header button (collapsed view) */}
                        <button
                          type="button"
                          onClick={() => toggleExpanded(key)}
                          aria-expanded={isOpen}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            color: "inherit",
                            textAlign: "left",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                ...decisionBadgeStyle(decision),
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 999,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {decision}
                            </span>

                            <div
                              style={{
                                fontWeight: 700,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                minWidth: 0,
                              }}
                              title={title}
                            >
                              {title}
                            </div>
                          </div>

                          <span style={{ opacity: 0.9, display: "inline-flex", alignItems: "center" }}>
                            {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                          </span>
                        </button>

                        {/* Expanded content */}
                        {isOpen && (
                          <div style={{ marginTop: 10 }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                gap: 10,
                              }}
                            >
                              <div style={{ borderRadius: 12, padding: 10, background: "rgba(148,163,184,.08)" }}>
                                <div className="small" style={{ opacity: 0.9 }}>
                                  Listing
                                </div>
                                <div style={{ fontWeight: 800 }}>{listing}</div>
                              </div>

                              <div style={{ borderRadius: 12, padding: 10, background: "rgba(148,163,184,.08)" }}>
                                <div className="small" style={{ opacity: 0.9 }}>
                                  Market
                                </div>
                                <div style={{ fontWeight: 800 }}>{market}</div>
                                {diffPart && (
                                  <div className="small" style={{ marginTop: 4, opacity: 0.85 }}>
                                    {diffPart}
                                  </div>
                                )}
                              </div>

                              <div style={{ borderRadius: 12, padding: 10, background: "rgba(148,163,184,.08)" }}>
                                <div className="small" style={{ opacity: 0.9 }}>
                                  Suggested offer
                                </div>
                                <div style={{ fontWeight: 800 }}>{offer}</div>
                              </div>
                            </div>

                            <div className="small mono" style={{ marginTop: 10, opacity: 0.9 }}>
                              {time}
                            </div>

                            {h.listing_url && (
                              <div className="small" style={{ marginTop: 8 }}>
                                <a href={h.listing_url} target="_blank" rel="noreferrer">
                                  Open listing ↗
                                </a>
                              </div>
                            )}

                            {/* Draft message (colors only here) */}
                            {draft && (
                              <div
                                style={{
                                  marginTop: 12,
                                  padding: 12,
                                  borderRadius: 14,
                                  background: "#052e16",
                                  color: "#d1fae5",
                                  border: "1px solid rgba(16,185,129,.35)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ fontWeight: 800 }}>Draft message</div>

                                  <button
                                    type="button"
                                    onClick={() => copyDraft(draft, key)}
                                    aria-label="Copy draft"
                                    title={copiedKey === key ? "Copied!" : "Copy draft"}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      width: 36,
                                      height: 30,
                                      borderRadius: 10,
                                      border: "1px solid rgba(209,250,229,.35)",
                                      background: copiedKey === key ? "rgba(34,197,94,.18)" : "rgba(209,250,229,.08)",
                                      color: "#d1fae5",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {copiedKey === key ? <TickIcon /> : <CopyIcon />}
                                  </button>
                                </div>

                                <div
                                  className="mono"
                                  style={{
                                    marginTop: 10,
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    lineHeight: 1.35,
                                    color: "#d1fae5",
                                  }}
                                >
                                  {draft}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h3 className="card__title">Help & transparency</h3>
              <p className="card__sub">Short, clear, and useful.</p>
            </div>

            <details className="details" open>
              <summary>Why it runs automatically on eBay pages</summary>
              <div className="details__body">
                HaggleOS uses a <code>content_scripts</code> rule that injects <code>content.js</code> on matching eBay
                pages. That injection creates the bottom-left button. Analysis runs when you click <b>Analyze Deal</b>.
              </div>
            </details>

            <details className="details">
              <summary>What data is used</summary>
              <div className="details__body">
                HaggleOS extracts listing details (e.g., title, price, images, fees/returns if available) from the
                current listing page, then sends the extracted payload to your backend for analysis.
              </div>
            </details>

            <details className="details">
              <summary>Troubleshooting</summary>
              <div className="details__body">
                <ul className="bullets">
                  <li>
                    <b>No button?</b> Make sure the URL contains <code>/itm/</code>, then refresh.
                  </li>
                  <li>
                    <b>Panel shows API error?</b> Backend may be down or blocked by network.
                  </li>
                  <li>
                    <b>Nothing saves to history?</b> Check extension storage permission and reload extension.
                  </li>
                </ul>
              </div>
            </details>

            <div className="note">
              Chrome Web Store guidance also recommends clear onboarding and privacy messaging for a better user
              experience.
            </div>
          </section>
        </section>

        <footer className="footer">
          <span className="muted">HaggleOS Dashboard </span>
        </footer>
      </main>
    </div>
  );
}
