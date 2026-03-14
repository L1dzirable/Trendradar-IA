import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/clerk-react";
import ConceptGraph from "../pages/ConceptGraph";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ─── TYPES & CONSTANTS ───────────────────────────────────────────────────────

const LIFECYCLE_CONFIG = {
  emerging:  { label: "Emerging",  color: "#4ade80", bg: "rgba(74,222,128,0.08)",  dot: "#4ade80" },
  rising:    { label: "Rising",    color: "#fb923c", bg: "rgba(251,146,60,0.08)",  dot: "#fb923c" },
  peaking:   { label: "Peaking",   color: "#f472b6", bg: "rgba(244,114,182,0.08)", dot: "#f472b6" },
  declining: { label: "Declining", color: "#94a3b8", bg: "rgba(148,163,184,0.08)", dot: "#94a3b8" },
};

const MACRO_LABELS = {
  ai_adoption:         "AI Adoption",
  regulatory_pressure: "Regulatory",
  cost_reduction:      "Cost Pressure",
  developer_tooling:   "Dev Tooling",
  remote_work:         "Remote Work",
  platform_shift:      "Platform Shift",
  unknown:             "Unknown",
};

const NAV_ITEMS = [
  { id: "feed",     label: "Opportunities", icon: IconFeed },
  { id: "rising",   label: "Rising Fast",   icon: IconTrend },
  { id: "graph",    label: "Graph",         icon: IconGraph },
  { id: "history",  label: "History",       icon: IconHistory },
  { id: "settings", label: "Settings",      icon: IconSettings },
];

// ─── ICONS ───────────────────────────────────────────────────────────────────

function IconFeed({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

function IconTrend({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <polyline points="1,12 5,7 8,9 12,4 15,2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="11,2 15,2 15,6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconHistory({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <polyline points="8,4.5 8,8 10.5,10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconSettings({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function IconArrow({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7h9M7.5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconClose({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconSignal({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
      <path d="M4 10a4.24 4.24 0 0 1 0-6M10 4a4.24 4.24 0 0 1 0 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M2 12a7 7 0 0 1 0-10M12 2a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function IconUpArrow({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M7 12V2M7 2L3 6M7 2l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconGraph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="3" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="13" cy="3" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="3" cy="13" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="13" cy="13" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="4.5" y1="3.5" x2="6.5" y2="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="11.5" y1="3.5" x2="9.5" y2="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="4.5" y1="12.5" x2="6.5" y2="9.5" stroke="currentColor" strokeWidth="1.4"/>
      <line x1="11.5" y1="12.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

// ─── SCORE RING ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 48 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 100, 1);
  const offset = circ * (1 - pct);
  const color = score >= 70 ? "#4ade80" : score >= 50 ? "#fb923c" : score >= 35 ? "#facc15" : "#64748b";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: size < 48 ? "10px" : "13px", fontWeight: 700,
        color, fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em"
      }}>
        {score}
      </span>
    </div>
  );
}

// ─── LIFECYCLE BADGE ─────────────────────────────────────────────────────────

function LifecycleBadge({ lifecycle }) {
  const cfg = LIFECYCLE_CONFIG[lifecycle] || LIFECYCLE_CONFIG.emerging;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 20,
      background: cfg.bg, border: `1px solid ${cfg.color}22`,
      fontSize: 11, fontWeight: 600, color: cfg.color,
      fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em",
      textTransform: "uppercase",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: cfg.color, flexShrink: 0,
        boxShadow: `0 0 6px ${cfg.color}`,
        animation: lifecycle === "rising" ? "pulse 1.8s ease-in-out infinite" : "none"
      }}/>
      {cfg.label}
    </span>
  );
}

// ─── OPPORTUNITY CARD ─────────────────────────────────────────────────────────

function OpportunityCard({ opp, onClick, index }) {
  const [hovered, setHovered] = useState(false);
  const [, navigate] = useLocation();

  const title = opp.trendName || opp.trendSlug?.replace(/-/g, " ") || "Unknown Trend";
  const macro = MACRO_LABELS[opp.macroDriver] || "—";

  return (
    <article
      onClick={() => onClick(opp)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? "rgba(255,255,255,0.045)"
          : "rgba(255,255,255,0.025)",
        border: hovered
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: "20px 22px",
        cursor: "pointer",
        transition: "all 0.18s ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 12px 40px rgba(0,0,0,0.35)"
          : "0 2px 8px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: `fadeUp 0.4s ease both`,
        animationDelay: `${index * 0.06}s`,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <ScoreRing score={opp.opportunityScore || 0} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 650,
            color: "#f1f5f9", fontFamily: "'Cabinet Grotesk', sans-serif",
            letterSpacing: "-0.02em", lineHeight: 1.3,
            textTransform: "capitalize",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {title}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <LifecycleBadge lifecycle={opp.lifecycle || "emerging"} />
            {opp.macroDriver && opp.macroDriver !== "unknown" && (
              <span style={{
                fontSize: 11, color: "#64748b", fontFamily: "'DM Mono', monospace",
                letterSpacing: "0.03em",
              }}>
                · {macro}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Explanation */}
      {opp.explanation && (
        <p style={{
          margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.65,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
          fontFamily: "'Lora', serif",
        }}>
          {opp.explanation}
        </p>
      )}

      {/* Footer row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12,
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <IconSignal size={13} />
            <span style={{ fontFamily: "'DM Mono', monospace" }}>
              {opp.signalCount || 0} signal{opp.signalCount !== 1 ? "s" : ""}
            </span>
          </div>
          {opp.signalQuality && (
            <div
              title={`Signal quality: ${opp.signalQuality}/10`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "help",
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: opp.signalQuality >= 7 ? "#4ade80" : opp.signalQuality >= 5 ? "#fb923c" : "#ef4444",
                boxShadow: `0 0 8px ${opp.signalQuality >= 7 ? "rgba(74,222,128,0.4)" : opp.signalQuality >= 5 ? "rgba(251,146,60,0.4)" : "rgba(239,68,68,0.4)"}`,
              }} />
            </div>
          )}
          {opp.signalSources && opp.signalSources.includes("stackoverflow") && (
            <div
              title="Includes Stack Overflow unsolved pain signals"
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(244,128,36,0.15)",
                border: "1px solid rgba(244,128,36,0.3)",
                color: "#f48024",
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "0.03em",
                cursor: "help",
              }}
            >
              SO
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/opportunity/${opp.trendSlug}`);
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: "rgba(74,222,128,0.1)",
            border: "1px solid rgba(74,222,128,0.2)",
            color: "#4ade80",
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.02em",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(74,222,128,0.15)";
            e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(74,222,128,0.1)";
            e.currentTarget.style.borderColor = "rgba(74,222,128,0.2)";
          }}
        >
          View Full Analysis
        </button>
      </div>
    </article>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────

function DetailPanel({ opp, onClose }) {
  const [, navigate] = useLocation();
  const title = opp.trendName || opp.trendSlug?.replace(/-/g, " ") || "Unknown";
  const macro = MACRO_LABELS[opp.macroDriver] || "—";
  const cfg = LIFECYCLE_CONFIG[opp.lifecycle] || LIFECYCLE_CONFIG.emerging;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
      pointerEvents: "none",
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          pointerEvents: "all", animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Panel */}
      <aside style={{
        position: "relative", zIndex: 1,
        width: "min(480px, 100vw)", height: "100vh",
        background: "#0d1117",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        overflowY: "auto", pointerEvents: "all",
        animation: "slideIn 0.28s cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Panel header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "#0d1117", zIndex: 2,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#475569",
            fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            Opportunity Detail
          </span>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)", border: "none",
              borderRadius: 8, width: 30, height: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#94a3b8",
            }}
          >
            <IconClose />
          </button>
        </div>

        <div style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Score + Title */}
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <ScoreRing score={opp.opportunityScore || 0} size={64} />
            <div>
              <h2 style={{
                margin: 0, fontSize: 20, fontWeight: 700,
                color: "#f1f5f9", fontFamily: "'Cabinet Grotesk', sans-serif",
                letterSpacing: "-0.03em", lineHeight: 1.2, textTransform: "capitalize",
              }}>
                {title}
              </h2>
              <div style={{ marginTop: 8 }}>
                <LifecycleBadge lifecycle={opp.lifecycle || "emerging"} />
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
          }}>
            {[
              { label: "Score",       value: `${opp.opportunityScore || 0}/100` },
              { label: "Signals",     value: opp.signalCount || 0 },
              { label: "Lifecycle",   value: opp.lifecycle || "—" },
              { label: "Macro Driver", value: macro },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{
                  fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5,
                }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 650, color: "#e2e8f0",
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  textTransform: "capitalize",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {value}
                  {label === "Signals" && opp.signalSources && opp.signalSources.includes("stackoverflow") && (
                    <div
                      title="Includes Stack Overflow unsolved pain signals"
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(244,128,36,0.15)",
                        border: "1px solid rgba(244,128,36,0.3)",
                        color: "#f48024",
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: "'DM Mono', monospace",
                        letterSpacing: "0.03em",
                        cursor: "help",
                      }}
                    >
                      SO
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Explanation */}
          {opp.explanation && (
            <section>
              <SectionLabel>Analysis</SectionLabel>
              <p style={{
                margin: 0, fontSize: 14, color: "#94a3b8",
                lineHeight: 1.75, fontFamily: "'Lora', serif",
                padding: "16px", background: "rgba(255,255,255,0.03)",
                borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
              }}>
                {opp.explanation}
              </p>
            </section>
          )}

          {/* Window estimate */}
          {opp.windowEstimate && (
            <section>
              <SectionLabel>Opportunity Window</SectionLabel>
              <div style={{
                padding: "16px",
                background: opp.windowEstimate.status === "open"
                  ? "rgba(74,222,128,0.05)"
                  : "rgba(251,146,60,0.05)",
                border: `1px solid ${opp.windowEstimate.status === "open" ? "rgba(74,222,128,0.15)" : "rgba(251,146,60,0.15)"}`,
                borderRadius: 10,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: opp.windowEstimate.estimatedWeeksRemaining ? 8 : 0,
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: 650, color: "#e2e8f0",
                    fontFamily: "'Cabinet Grotesk', sans-serif", textTransform: "capitalize",
                  }}>
                    {opp.windowEstimate.status}
                  </span>
                  <span style={{
                    fontSize: 11, color: "#64748b",
                    fontFamily: "'DM Mono', monospace",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>
                    {opp.windowEstimate.confidence} confidence
                  </span>
                </div>
                {opp.windowEstimate.estimatedWeeksRemaining && (
                  <p style={{
                    margin: 0, fontSize: 12, color: "#64748b",
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    ~{opp.windowEstimate.estimatedWeeksRemaining} weeks remaining
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Sources */}
          {opp.sources && opp.sources.length > 0 && (
            <section>
              <SectionLabel>Sources</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {opp.sources.map((src, i) => (
                  <span key={i} style={{
                    padding: "4px 10px", borderRadius: 20,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 11, color: "#64748b",
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    {src}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Slug */}
          <div style={{
            padding: "10px 14px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{
              fontSize: 11, color: "#334155",
              fontFamily: "'DM Mono', monospace",
            }}>
              slug
            </span>
            <span style={{
              fontSize: 11, color: "#475569",
              fontFamily: "'DM Mono', monospace",
            }}>
              {opp.trendSlug}
            </span>
          </div>

          {/* View Full Analysis Button */}
          <button
            onClick={() => navigate(`/opportunity/${opp.trendSlug}`)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.2)",
              color: "#4ade80",
              cursor: "pointer",
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.02em",
              transition: "all 0.15s",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(74,222,128,0.15)";
              e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(74,222,128,0.1)";
              e.currentTarget.style.borderColor = "rgba(74,222,128,0.2)";
            }}
          >
            View Full Analysis
          </button>
        </div>
      </aside>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "#475569",
      fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

// ─── EMPTY / LOADING / ERROR STATES ──────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", gap: 16,
      animation: "fadeUp 0.4s ease",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#334155",
      }}>
        <IconFeed size={22} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{
          margin: 0, fontSize: 15, fontWeight: 600, color: "#475569",
          fontFamily: "'Cabinet Grotesk', sans-serif",
        }}>
          No opportunities yet
        </p>
        <p style={{
          margin: "6px 0 0", fontSize: 13, color: "#334155",
          fontFamily: "'Lora', serif",
        }}>
          Signals are being processed. Check back shortly.
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
      gap: 14,
    }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          height: 160, borderRadius: 14,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
          animation: `shimmer 1.8s ease-in-out ${i * 0.15}s infinite`,
        }} />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", gap: 16,
      animation: "fadeUp 0.4s ease",
    }}>
      <div style={{
        fontSize: 13, color: "#f87171", fontFamily: "'DM Mono', monospace",
        background: "rgba(248,113,113,0.08)",
        border: "1px solid rgba(248,113,113,0.2)",
        padding: "12px 18px", borderRadius: 10,
      }}>
        {message || "Failed to load opportunities"}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: "8px 18px", borderRadius: 8, fontSize: 13,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#94a3b8", cursor: "pointer", fontFamily: "'DM Mono', monospace",
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ─── RISING FAST PAGE ─────────────────────────────────────────────────────────

function RisingFastPage({ data, status, error, load }) {
  const [selected, setSelected] = useState(null);

  const risingOpportunities = data
    .filter(opp => opp.lifecycle === "emerging" || opp.lifecycle === "rising")
    .sort((a, b) => {
      const velA = a.velocity ?? 0;
      const velB = b.velocity ?? 0;
      if (velB !== velA) return velB - velA;
      return (b.opportunityScore || 0) - (a.opportunityScore || 0);
    });

  if (status === "loading") return <RadarLoading />;
  if (status === "error") return <ErrorState message={error} onRetry={load} />;

  if (risingOpportunities.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", gap: 12,
        animation: "fadeUp 0.3s ease",
      }}>
        <p style={{
          margin: 0, fontSize: 16, fontWeight: 650, color: "#475569",
          fontFamily: "'Cabinet Grotesk', sans-serif",
        }}>
          No rising opportunities
        </p>
        <p style={{
          margin: 0, fontSize: 13, color: "#334155",
          fontFamily: "'DM Mono', monospace",
        }}>
          Check back soon as trends emerge
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%" }}>
      {/* Page header */}
      <div>
        <h1 style={{
          margin: 0, fontSize: 22, fontWeight: 750,
          color: "#f1f5f9", fontFamily: "'Cabinet Grotesk', sans-serif",
          letterSpacing: "-0.03em",
        }}>
          Rising Fast
        </h1>
        <p style={{
          margin: "3px 0 0", fontSize: 13, color: "#475569",
          fontFamily: "'DM Mono', monospace",
        }}>
          {risingOpportunities.length} trend{risingOpportunities.length !== 1 ? "s" : ""} accelerating
        </p>
      </div>

      {/* Ranked list */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 10,
        animation: "fadeUp 0.3s ease",
      }}>
        {risingOpportunities.map((opp, index) => {
          const rank = index + 1;
          const velocity = opp.velocity ?? 0;
          const macro = MACRO_LABELS[opp.macroDriver] || "—";

          return (
            <div
              key={opp.trendSlug || index}
              onClick={() => setSelected(opp)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 18px",
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.18s ease",
                animation: `fadeUp 0.4s ease both`,
                animationDelay: `${index * 0.04}s`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.045)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Rank */}
              <div style={{
                minWidth: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: rank <= 3 ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)",
                border: rank <= 3 ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                color: rank <= 3 ? "#4ade80" : "#64748b",
                fontFamily: "'DM Mono', monospace",
              }}>
                {rank}
              </div>

              {/* Main content */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h3 style={{
                    margin: 0, fontSize: 15, fontWeight: 650,
                    color: "#f1f5f9", fontFamily: "'Cabinet Grotesk', sans-serif",
                    letterSpacing: "-0.02em", textTransform: "capitalize",
                  }}>
                    {opp.trendName}
                  </h3>
                  <LifecycleBadge lifecycle={opp.lifecycle || "emerging"} />
                </div>

                <div style={{
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                  fontSize: 12, color: "#64748b", fontFamily: "'DM Mono', monospace",
                }}>
                  <span>{macro}</span>
                  <span>·</span>
                  <span>{opp.signalCount || 0} signals</span>
                </div>
              </div>

              {/* Velocity */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.15)",
                borderRadius: 8,
              }}>
                <IconUpArrow size={13} />
                <span style={{
                  fontSize: 13,
                  fontWeight: 650,
                  color: "#4ade80",
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {velocity.toFixed(2)}
                </span>
              </div>

              {/* Score */}
              <ScoreRing score={opp.opportunityScore || 0} size={42} />
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel opp={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── OPPORTUNITIES FEED PAGE ──────────────────────────────────────────────────

function OpportunitiesFeed({ data, status, error, load, meta, setActivePage }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? data
    : data.filter(o => o.lifecycle === filter);

  const lifecycles = ["all", ...Object.keys(LIFECYCLE_CONFIG)];

  const showUpgradePrompt = meta && meta.total_available > data.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%" }}>
      {/* Page header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 750,
            color: "#f1f5f9", fontFamily: "'Cabinet Grotesk', sans-serif",
            letterSpacing: "-0.03em",
          }}>
            Opportunities
          </h1>
          {status === "ready" && (
            <p style={{
              margin: "3px 0 0", fontSize: 13, color: "#475569",
              fontFamily: "'DM Mono', monospace",
            }}>
              {showUpgradePrompt
                ? `Showing ${data.length} of ${meta.total_available} opportunities`
                : `${filtered.length} trend${filtered.length !== 1 ? "s" : ""} detected`
              }
            </p>
          )}
        </div>

        {/* Lifecycle filter tabs */}
        <div style={{
          display: "flex", gap: 4, padding: 4,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {lifecycles.map(lc => {
            const cfg = LIFECYCLE_CONFIG[lc];
            const active = filter === lc;
            return (
              <button
                key={lc}
                onClick={() => setFilter(lc)}
                style={{
                  padding: "5px 12px", borderRadius: 7, border: "none",
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  color: active ? "#e2e8f0" : "#475569",
                  fontSize: 11, fontWeight: active ? 600 : 400,
                  fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em",
                  textTransform: "uppercase", cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {cfg && (
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: active ? cfg.color : "#334155", flexShrink: 0,
                  }} />
                )}
                {lc}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {status === "loading" && <LoadingState />}
        {status === "error" && <ErrorState message={error} onRetry={load} />}
        {status === "ready" && filtered.length === 0 && <EmptyState />}
        {status === "ready" && filtered.length > 0 && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 14,
            }}>
              {filtered.map((opp, i) => (
                <OpportunityCard
                  key={opp.trendSlug || i}
                  opp={opp}
                  index={i}
                  onClick={setSelected}
                />
              ))}
            </div>

            {showUpgradePrompt && (
              <div style={{
                marginTop: 24,
                padding: "24px",
                background: "rgba(251,146,60,0.06)",
                border: "1px solid rgba(251,146,60,0.2)",
                borderRadius: 12,
                textAlign: "center",
              }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 650,
                  color: "#fb923c",
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                  marginBottom: 8,
                }}>
                  You are seeing {data.length} of {meta.total_available} opportunities
                </div>
                <p style={{
                  margin: "0 0 16px",
                  fontSize: 13,
                  color: "#94a3b8",
                  fontFamily: "'DM Mono', monospace",
                  lineHeight: 1.6,
                }}>
                  Upgrade to Pro to unlock all opportunities, alerts, history, and more.
                </p>
                <button
                  onClick={() => setActivePage("pricing")}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 8,
                    background: "rgba(251,146,60,0.15)",
                    border: "1px solid rgba(251,146,60,0.3)",
                    color: "#fb923c",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(251,146,60,0.25)";
                    e.currentTarget.style.borderColor = "rgba(251,146,60,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(251,146,60,0.15)";
                    e.currentTarget.style.borderColor = "rgba(251,146,60,0.3)";
                  }}
                >
                  Upgrade to Pro
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <DetailPanel opp={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

function HistoryPage({ selectedTrendSlug = null }) {
  const [slugs, setSlugs] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(selectedTrendSlug);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchSlugs() {
      try {
        const res = await fetch("/api/history");
        if (!res.ok) throw new Error("Failed to fetch trend slugs");
        const data = await res.json();
        setSlugs(data.slugs || []);
        if (data.slugs?.length > 0 && !selectedSlug) {
          setSelectedSlug(data.slugs[0]);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchSlugs();
  }, []);

  useEffect(() => {
    if (selectedTrendSlug && selectedTrendSlug !== selectedSlug) {
      setSelectedSlug(selectedTrendSlug);
    }
  }, [selectedTrendSlug]);

  useEffect(() => {
    if (!selectedSlug) return;

    async function fetchHistory() {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/history/${encodeURIComponent(selectedSlug)}`);
        if (!res.ok) throw new Error("Failed to fetch history");
        const data = await res.json();
        setHistoryData(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingHistory(false);
      }
    }
    fetchHistory();
  }, [selectedSlug]);

  const filteredSlugs = slugs.filter(slug =>
    slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function getLifecycleChanges() {
    if (!historyData?.history?.length) return [];
    const changes = [];
    let prevLifecycle = null;

    historyData.history.forEach((record, i) => {
      if (record.lifecycle !== prevLifecycle && prevLifecycle !== null) {
        changes.push({
          date: new Date(record.recordedAt),
          from: prevLifecycle,
          to: record.lifecycle,
        });
      }
      prevLifecycle = record.lifecycle;
    });

    return changes;
  }

  const lifecycleChanges = getLifecycleChanges();

  const chartData = historyData?.history?.map(record => ({
    date: new Date(record.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: record.score,
    signals: record.signalCount,
    lifecycle: record.lifecycle,
  })) || [];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{
          width: 40, height: 40, border: "3px solid rgba(74,222,128,0.2)",
          borderTopColor: "#4ade80", borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: "#ef4444" }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", gap: 20 }}>
      <div style={{
        width: 280,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        paddingRight: 20,
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 650,
            color: "#f1f5f9",
            fontFamily: "'Cabinet Grotesk', sans-serif",
            marginBottom: 8,
          }}>
            Trend History
          </h2>
          <p style={{
            margin: 0,
            fontSize: 12,
            color: "#64748b",
            fontFamily: "'DM Mono', monospace",
          }}>
            {slugs.length} trends tracked
          </p>
        </div>

        <input
          type="text"
          placeholder="Search trends..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            color: "#e2e8f0",
            fontSize: 13,
            fontFamily: "'DM Mono', monospace",
            outline: "none",
          }}
        />

        <div style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}>
          {filteredSlugs.map(slug => (
            <button
              key={slug}
              onClick={() => setSelectedSlug(slug)}
              style={{
                padding: "10px 12px",
                background: selectedSlug === slug ? "rgba(74,222,128,0.1)" : "transparent",
                border: selectedSlug === slug ? "1px solid rgba(74,222,128,0.3)" : "1px solid transparent",
                borderRadius: 8,
                color: selectedSlug === slug ? "#4ade80" : "#94a3b8",
                fontSize: 13,
                fontFamily: "'DM Mono', monospace",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s",
                fontWeight: selectedSlug === slug ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (selectedSlug !== slug) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedSlug !== slug) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {slug}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, overflow: "auto" }}>
        {loadingHistory ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{
              width: 40, height: 40, border: "3px solid rgba(74,222,128,0.2)",
              borderTopColor: "#4ade80", borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
          </div>
        ) : historyData ? (
          <>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 750,
                color: "#f1f5f9",
                fontFamily: "'Cabinet Grotesk', sans-serif",
                letterSpacing: "-0.03em",
              }}>
                {selectedSlug}
              </h1>
              <p style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: "#64748b",
                fontFamily: "'DM Mono', monospace",
              }}>
                Last 90 days • {chartData.length} data points
              </p>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 24,
            }}>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#4ade80"
                    style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}
                    label={{ value: "Score", angle: -90, position: "insideLeft", style: { fill: "#4ade80", fontSize: 12 } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#fb923c"
                    style={{ fontSize: 11, fontFamily: "'DM Mono', monospace" }}
                    label={{ value: "Signals", angle: 90, position: "insideRight", style: { fill: "#fb923c", fontSize: 12 } }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,15,26,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "'DM Mono', monospace",
                    }}
                    labelStyle={{ color: "#f1f5f9", fontWeight: 600 }}
                    itemStyle={{ color: "#e2e8f0" }}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: 12,
                      fontFamily: "'DM Mono', monospace",
                      paddingTop: 20,
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="score"
                    stroke="#4ade80"
                    strokeWidth={2.5}
                    dot={{ fill: "#4ade80", r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Opportunity Score"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="signals"
                    stroke="#fb923c"
                    strokeWidth={2.5}
                    dot={{ fill: "#fb923c", r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Signal Count"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {lifecycleChanges.length > 0 && (
              <div style={{
                background: "rgba(255,255,255,0.015)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: 20,
              }}>
                <h3 style={{
                  margin: "0 0 16px 0",
                  fontSize: 16,
                  fontWeight: 650,
                  color: "#f1f5f9",
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                }}>
                  Lifecycle Changes
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {lifecycleChanges.map((change, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        background: "rgba(255,255,255,0.02)",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <span style={{
                        fontSize: 12,
                        color: "#64748b",
                        fontFamily: "'DM Mono', monospace",
                        minWidth: 90,
                      }}>
                        {change.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: LIFECYCLE_CONFIG[change.from]?.color || "#94a3b8",
                          fontFamily: "'DM Mono', monospace",
                        }}>
                          {LIFECYCLE_CONFIG[change.from]?.label || change.from}
                        </span>
                        <span style={{ color: "#475569", fontSize: 14 }}>→</span>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: LIFECYCLE_CONFIG[change.to]?.color || "#94a3b8",
                          fontFamily: "'DM Mono', monospace",
                        }}>
                          {LIFECYCLE_CONFIG[change.to]?.label || change.to}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 24, color: "#64748b" }}>
            Select a trend to view its history
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

function Sidebar({ activePage, setActivePage, collapsed }) {
  const [showDigestForm, setShowDigestForm] = useState(false);
  const [digestEmail, setDigestEmail] = useState("");
  const [digestStatus, setDigestStatus] = useState("idle");

  const handleDigestSubscribe = async (e) => {
    e.preventDefault();
    setDigestStatus("loading");

    try {
      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: digestEmail }),
      });

      if (!res.ok) {
        throw new Error("Failed to subscribe");
      }

      setDigestStatus("success");
      setDigestEmail("");
      setTimeout(() => {
        setShowDigestForm(false);
        setDigestStatus("idle");
      }, 2000);
    } catch (error) {
      setDigestStatus("error");
      setTimeout(() => setDigestStatus("idle"), 2000);
    }
  };

  return (
    <nav style={{
      width: collapsed ? 56 : 220,
      background: "#080c12",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column",
      padding: "0", flexShrink: 0,
      transition: "width 0.25s ease",
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? "20px 0" : "20px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 10, height: 60,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: "linear-gradient(135deg, #4ade80, #22d3ee)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <polyline points="1,11 4,6 7,8 10,3 13,1" stroke="#0a0f1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {!collapsed && (
          <span style={{
            fontSize: 15, fontWeight: 750, color: "#f1f5f9",
            fontFamily: "'Cabinet Grotesk', sans-serif",
            letterSpacing: "-0.03em", whiteSpace: "nowrap",
          }}>
            TrendRadar
          </span>
        )}
      </div>

      {/* Nav items */}
      <div style={{ padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => setActivePage(id)}
              title={collapsed ? label : undefined}
              style={{
                display: "flex", alignItems: "center",
                gap: 10, padding: collapsed ? "9px 0" : "9px 12px",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: 8, border: "none",
                background: active ? "rgba(255,255,255,0.08)" : "transparent",
                color: active ? "#e2e8f0" : "#475569",
                fontSize: 13, fontWeight: active ? 600 : 400,
                fontFamily: "'Cabinet Grotesk', sans-serif",
                cursor: "pointer", transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={16} />
              {!collapsed && label}
            </button>
          );
        })}
      </div>

      {/* Weekly Digest Subscription */}
      {!collapsed && (
        <div style={{ marginTop: "auto", padding: "0 12px 12px" }}>
          {!showDigestForm ? (
            <button
              onClick={() => setShowDigestForm(true)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(251,146,60,0.06)",
                border: "1px solid rgba(251,146,60,0.15)",
                color: "#fb923c",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "'DM Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(251,146,60,0.1)";
                e.currentTarget.style.borderColor = "rgba(251,146,60,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(251,146,60,0.06)";
                e.currentTarget.style.borderColor = "rgba(251,146,60,0.15)";
              }}
            >
              📬 Weekly Digest
            </button>
          ) : (
            <div style={{
              padding: "12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              {digestStatus === "success" ? (
                <div style={{
                  fontSize: 11,
                  color: "#4ade80",
                  fontFamily: "'DM Mono', monospace",
                  textAlign: "center",
                }}>
                  ✓ Subscribed!
                </div>
              ) : digestStatus === "error" ? (
                <div style={{
                  fontSize: 11,
                  color: "#f87171",
                  fontFamily: "'DM Mono', monospace",
                  textAlign: "center",
                }}>
                  Failed
                </div>
              ) : (
                <form onSubmit={handleDigestSubscribe} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    type="email"
                    value={digestEmail}
                    onChange={(e) => setDigestEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={digestStatus === "loading"}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#e2e8f0",
                      fontSize: 11,
                      fontFamily: "'DM Mono', monospace",
                      outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="submit"
                      disabled={digestStatus === "loading"}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(74,222,128,0.15)",
                        border: "1px solid rgba(74,222,128,0.3)",
                        color: "#4ade80",
                        fontSize: 10,
                        fontWeight: 600,
                        fontFamily: "'DM Mono', monospace",
                        cursor: digestStatus === "loading" ? "not-allowed" : "pointer",
                        opacity: digestStatus === "loading" ? 0.6 : 1,
                      }}
                    >
                      {digestStatus === "loading" ? "..." : "Subscribe"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDigestForm(false);
                        setDigestEmail("");
                        setDigestStatus("idle");
                      }}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#64748b",
                        fontSize: 10,
                        fontFamily: "'DM Mono', monospace",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom indicator */}
      <div style={{ padding: "16px 12px" }}>
        <div style={{
          padding: collapsed ? "8px 0" : "8px 10px",
          borderRadius: 8,
          background: "rgba(74,222,128,0.06)",
          border: "1px solid rgba(74,222,128,0.12)",
          display: "flex", alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#4ade80", flexShrink: 0,
            boxShadow: "0 0 8px #4ade80",
            animation: "pulse 2s ease-in-out infinite",
          }} />
          {!collapsed && (
            <span style={{
              fontSize: 10, color: "#4ade80",
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
            }}>
              Live
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────

function Topbar({ activePage, onToggleSidebar }) {
  const { isSignedIn, user } = useUser();
  const [userPlan, setUserPlan] = React.useState(null);

  React.useEffect(() => {
    if (isSignedIn) {
      fetch("/api/auth/me")
        .then(res => res.json())
        .then(data => setUserPlan(data.plan))
        .catch(err => console.error("Failed to fetch user plan:", err));
    }
  }, [isSignedIn]);

  const handleManageSubscription = async () => {
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to create portal session");
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      console.error("Failed to open billing portal:", err);
      alert("Failed to open billing portal. Please try again.");
    }
  };

  const pageLabels = {
    feed: "Opportunities",
    rising: "Rising Fast",
    graph: "Graph",
    history: "History",
    settings: "Settings",
    pricing: "Pricing",
  };

  return (
    <header style={{
      height: 60, flexShrink: 0,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      background: "#080c12",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#475569", padding: 4, borderRadius: 6,
            display: "flex", alignItems: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <span style={{
          fontSize: 13, color: "#334155",
          fontFamily: "'DM Mono', monospace",
        }}>
          /
        </span>
        <span style={{
          fontSize: 13, fontWeight: 600, color: "#94a3b8",
          fontFamily: "'Cabinet Grotesk', sans-serif",
        }}>
          {pageLabels[activePage] || activePage}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          fontSize: 10, color: "#334155",
          fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          v0.1
        </span>

        {isSignedIn ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {userPlan === "pro" && (
              <button
                onClick={handleManageSubscription}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: "rgba(251,146,60,0.1)",
                  border: "1px solid rgba(251,146,60,0.3)",
                  color: "#fb923c",
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "'DM Mono', monospace",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(251,146,60,0.15)";
                  e.currentTarget.style.borderColor = "rgba(251,146,60,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(251,146,60,0.1)";
                  e.currentTarget.style.borderColor = "rgba(251,146,60,0.3)";
                }}>
                Manage Plan
              </button>
            )}
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SignInButton mode="modal">
              <button style={{
                padding: "6px 12px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8",
                fontSize: 12,
                fontWeight: 500,
                fontFamily: "'DM Mono', monospace",
                cursor: "pointer",
                transition: "all 0.15s",
              }}>
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button style={{
                padding: "6px 12px",
                borderRadius: 6,
                background: "rgba(74,222,128,0.15)",
                border: "1px solid rgba(74,222,128,0.3)",
                color: "#4ade80",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'DM Mono', monospace",
                cursor: "pointer",
                transition: "all 0.15s",
              }}>
                Sign Up
              </button>
            </SignUpButton>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── PRICING PAGE ─────────────────────────────────────────────────────────────

function PricingPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleGetPro = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: 900,
      margin: "0 auto",
      padding: "40px 24px",
      animation: "fadeUp 0.3s ease",
    }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{
          margin: "0 0 12px",
          fontSize: 32,
          fontWeight: 750,
          color: "#f1f5f9",
          fontFamily: "'Cabinet Grotesk', sans-serif",
          letterSpacing: "-0.03em",
        }}>
          Simple, Transparent Pricing
        </h1>
        <p style={{
          margin: 0,
          fontSize: 14,
          color: "#94a3b8",
          fontFamily: "'DM Mono', monospace",
        }}>
          Choose the plan that fits your needs
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 24,
      }}>
        {/* Free Tier */}
        <div style={{
          padding: 32,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#64748b",
            fontFamily: "'DM Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}>
            Free
          </div>
          <div style={{
            fontSize: 40,
            fontWeight: 750,
            color: "#f1f5f9",
            fontFamily: "'Cabinet Grotesk', sans-serif",
            marginBottom: 8,
          }}>
            €0
            <span style={{
              fontSize: 14,
              fontWeight: 400,
              color: "#64748b",
              marginLeft: 6,
            }}>
              /month
            </span>
          </div>
          <p style={{
            margin: "0 0 24px",
            fontSize: 13,
            color: "#94a3b8",
            fontFamily: "'DM Mono', monospace",
            lineHeight: 1.6,
          }}>
            Perfect for exploring trends
          </p>

          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 24,
          }}>
            <div style={{
              fontSize: 13,
              color: "#cbd5e1",
              fontFamily: "'DM Mono', monospace",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ color: "#4ade80" }}>✓</span>
              5 opportunities
            </div>
            <div style={{
              fontSize: 13,
              color: "#cbd5e1",
              fontFamily: "'DM Mono', monospace",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ color: "#64748b" }}>✗</span>
              <span style={{ color: "#64748b" }}>No alerts</span>
            </div>
            <div style={{
              fontSize: 13,
              color: "#cbd5e1",
              fontFamily: "'DM Mono', monospace",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ color: "#64748b" }}>✗</span>
              <span style={{ color: "#64748b" }}>No history</span>
            </div>
          </div>

          <button style={{
            width: "100%",
            padding: "10px 20px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Cabinet Grotesk', sans-serif",
            cursor: "default",
          }}>
            Current Plan
          </button>
        </div>

        {/* Pro Tier */}
        <div style={{
          padding: 32,
          background: "rgba(251,146,60,0.06)",
          border: "2px solid rgba(251,146,60,0.3)",
          borderRadius: 16,
          position: "relative",
        }}>
          <div style={{
            position: "absolute",
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 12px",
            background: "rgba(251,146,60,0.2)",
            border: "1px solid rgba(251,146,60,0.4)",
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 700,
            color: "#fb923c",
            fontFamily: "'DM Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>
            Recommended
          </div>

          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#fb923c",
            fontFamily: "'DM Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}>
            Pro
          </div>
          <div style={{
            fontSize: 40,
            fontWeight: 750,
            color: "#f1f5f9",
            fontFamily: "'Cabinet Grotesk', sans-serif",
            marginBottom: 8,
          }}>
            €29
            <span style={{
              fontSize: 14,
              fontWeight: 400,
              color: "#64748b",
              marginLeft: 6,
            }}>
              /month
            </span>
          </div>
          <p style={{
            margin: "0 0 24px",
            fontSize: 13,
            color: "#94a3b8",
            fontFamily: "'DM Mono', monospace",
            lineHeight: 1.6,
          }}>
            For serious opportunity hunters
          </p>

          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 24,
          }}>
            <div style={{
              fontSize: 13,
              color: "#cbd5e1",
              fontFamily: "'DM Mono', monospace",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ color: "#4ade80" }}>✓</span>
              All opportunities (unlimited)
            </div>
            <div style={{
              fontSize: 13,
              color: "#cbd5e1",
              fontFamily: "'DM Mono', monospace",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ color: "#4ade80" }}>✓</span>
              Email alerts
            </div>
            <div style={{
              fontSize: 13,
              color: "#cbd5e1",
              fontFamily: "'DM Mono', monospace",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ color: "#4ade80" }}>✓</span>
              Trend history
            </div>
            <div style={{
              fontSize: 13,
              color: "#cbd5e1",
              fontFamily: "'DM Mono', monospace",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ color: "#4ade80" }}>✓</span>
              Concept graph
            </div>
            <div style={{
              fontSize: 13,
              color: "#cbd5e1",
              fontFamily: "'DM Mono', monospace",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ color: "#4ade80" }}>✓</span>
              Predictions
            </div>
          </div>

          <button
            onClick={handleGetPro}
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 20px",
              borderRadius: 8,
              background: loading ? "rgba(251,146,60,0.1)" : "rgba(251,146,60,0.2)",
              border: "1px solid rgba(251,146,60,0.4)",
              color: loading ? "#94a3b8" : "#fb923c",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Cabinet Grotesk', sans-serif",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "rgba(251,146,60,0.3)";
                e.currentTarget.style.borderColor = "rgba(251,146,60,0.5)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "rgba(251,146,60,0.2)";
                e.currentTarget.style.borderColor = "rgba(251,146,60,0.4)";
              }
            }}>
            {loading ? "Redirecting to Stripe..." : "Get Pro"}
          </button>
          {error && (
            <div style={{
              marginTop: 12,
              padding: "8px 12px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 6,
              color: "#ef4444",
              fontSize: 12,
              fontFamily: "'DM Mono', monospace",
              textAlign: "center",
            }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <div style={{
        marginTop: 48,
        padding: 24,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        textAlign: "center",
      }}>
        <p style={{
          margin: 0,
          fontSize: 13,
          color: "#94a3b8",
          fontFamily: "'DM Mono', monospace",
          lineHeight: 1.6,
        }}>
          Stripe integration coming soon. Get ready to unlock unlimited opportunities.
        </p>
      </div>
    </div>
  );
}

// ─── PLACEHOLDER PAGES ────────────────────────────────────────────────────────

function PlaceholderPage({ title, description }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", gap: 12,
      animation: "fadeUp 0.3s ease",
    }}>
      <p style={{
        margin: 0, fontSize: 16, fontWeight: 650, color: "#475569",
        fontFamily: "'Cabinet Grotesk', sans-serif",
      }}>
        {title}
      </p>
      <p style={{
        margin: 0, fontSize: 13, color: "#334155",
        fontFamily: "'Lora', serif",
      }}>
        {description}
      </p>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activePage, setActivePage] = useState("feed");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [selectedTrendSlug, setSelectedTrendSlug] = useState(null);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/opportunities");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data || [];
      setData(list);
      setMeta(json.meta || null);
      setStatus("ready");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("upgraded") === "true") {
      setShowUpgradeBanner(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setShowUpgradeBanner(false), 5000);
    }

    const shouldShowHistory = localStorage.getItem("trendRadar_historyPage");
    const historySlug = localStorage.getItem("trendRadar_historySlug");

    if (shouldShowHistory === "true") {
      localStorage.removeItem("trendRadar_historyPage");
      if (historySlug) {
        setSelectedTrendSlug(historySlug);
        localStorage.removeItem("trendRadar_historySlug");
      }
      setActivePage("history");
    }
  }, []);

  const navigateToHistory = useCallback((trendSlug) => {
    setSelectedTrendSlug(trendSlug);
    setActivePage("history");
  }, []);

  const renderPage = () => {
    const sharedProps = { data, status, error, load, meta };
    switch (activePage) {
      case "feed":    return <OpportunitiesFeed {...sharedProps} setActivePage={setActivePage} />;
      case "rising":  return <RisingFastPage {...sharedProps} />;
      case "graph":   return <ConceptGraph />;
      case "history": return <HistoryPage selectedTrendSlug={selectedTrendSlug} />;
      case "settings":return <PlaceholderPage title="Settings" description="Configure sources and alerts." />;
      case "pricing": return <PricingPage />;
      default:        return <OpportunitiesFeed {...sharedProps} setActivePage={setActivePage} />;
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');

        * { box-sizing: border-box; }

        body {
          margin: 0; padding: 0;
          background: #0a0f1a;
          color: #e2e8f0;
          font-family: 'Cabinet Grotesk', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        @font-face {
          font-family: 'Cabinet Grotesk';
          src: url('https://fonts.cdnfonts.com/css/cabinet-grotesk') format('woff2');
        }

        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.85); }
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.7; }
        }

        button:hover { opacity: 0.85; }
      `}</style>

      <div style={{
        display: "flex", height: "100vh", overflow: "hidden",
        background: "#0a0f1a",
      }}>
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          collapsed={sidebarCollapsed}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Topbar
            activePage={activePage}
            onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          />
          {showUpgradeBanner && (
            <div style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(251,146,60,0.15) 100%)",
              border: "1px solid rgba(251,146,60,0.3)",
              borderLeft: "none",
              borderRight: "none",
              color: "#f1f5f9",
              fontSize: 14,
              fontFamily: "'DM Mono', monospace",
              textAlign: "center",
              animation: "fadeUp 0.3s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}>
              <span style={{ color: "#4ade80", fontSize: 16 }}>✓</span>
              Welcome to Pro. All opportunities unlocked.
              <button
                onClick={() => setShowUpgradeBanner(false)}
                style={{
                  marginLeft: 12,
                  padding: "2px 8px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 4,
                  color: "#cbd5e1",
                  fontSize: 11,
                  cursor: "pointer",
                }}>
                Dismiss
              </button>
            </div>
          )}
          <main style={{
            flex: 1, overflowY: "auto",
            padding: "28px 28px",
          }}>
            {renderPage()}
          </main>
        </div>
      </div>
    </>
  );
}
