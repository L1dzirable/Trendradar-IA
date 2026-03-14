import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Loader as Loader2, TrendingUp } from "lucide-react";

type LifecyclePhase = "emerging" | "rising" | "peaking" | "declining";
type MacroDriver = "ai_adoption" | "regulatory_pressure" | "cost_reduction" | "developer_tooling" | "remote_work" | "platform_shift" | "unknown";
type PainSignalClass = "critical" | "acute" | "moderate" | "mild";
type GapType = "capability" | "experience" | "pricing" | "integration" | "support" | null;

interface EnrichedOpportunity {
  topic: string;
  trendName: string;
  trendSlug: string;
  explanation: string;
  businessIdea: string;
  monetization: string;
  difficultyScore: number;
  createdAt: Date;
  signalCount: number;
  opportunityScore: number;
  opportunityLabel: 'High' | 'Watch' | 'Emerging' | 'Noise';
  painClass: PainSignalClass;
  velocity: number;
  lifecycle: LifecyclePhase;
  macroDriver: MacroDriver;
  gapType: GapType;
  icp: string;
  competitorGap: string;
  earlyCustomerHypothesis: string;
  signalQuality?: number;
  signalSources?: string[];
}

const LIFECYCLE_CONFIG = {
  emerging: { label: "Emerging", color: "#4ade80", bg: "rgba(74,222,128,0.08)" },
  rising: { label: "Rising", color: "#fb923c", bg: "rgba(251,146,60,0.08)" },
  peaking: { label: "Peaking", color: "#f472b6", bg: "rgba(244,114,182,0.08)" },
  declining: { label: "Declining", color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
};

const MACRO_LABELS = {
  ai_adoption: "AI Adoption",
  regulatory_pressure: "Regulatory Pressure",
  cost_reduction: "Cost Reduction",
  developer_tooling: "Developer Tooling",
  remote_work: "Remote Work",
  platform_shift: "Platform Shift",
  unknown: "Unknown",
};

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 100, 1);
  const offset = circ * (1 - pct);
  const color = score >= 70 ? "#4ade80" : score >= 50 ? "#fb923c" : score >= 35 ? "#facc15" : "#64748b";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size < 48 ? "10px" : "13px",
          fontWeight: 700,
          color,
          fontFamily: "'DM Mono', monospace",
          letterSpacing: "-0.02em",
        }}
      >
        {score}
      </span>
    </div>
  );
}

function LifecycleBadge({ lifecycle }: { lifecycle: LifecyclePhase }) {
  const cfg = LIFECYCLE_CONFIG[lifecycle] || LIFECYCLE_CONFIG.emerging;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 20,
        background: cfg.bg,
        border: `1px solid ${cfg.color}22`,
        fontSize: 11,
        fontWeight: 600,
        color: cfg.color,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: cfg.color,
          flexShrink: 0,
          boxShadow: `0 0 6px ${cfg.color}`,
        }}
      />
      {cfg.label}
    </span>
  );
}

function DifficultyBar({ score }: { score: number }) {
  const color = score <= 30 ? "#4ade80" : score <= 60 ? "#fb923c" : "#f87171";
  const label = score <= 30 ? "Easy" : score <= 60 ? "Moderate" : "Hard";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
          Difficulty: {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "'DM Mono', monospace" }}>
          {score}/100
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: 8,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            background: color,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: 14,
        fontWeight: 700,
        color: "#94a3b8",
        fontFamily: "'DM Mono', monospace",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom: 16,
      }}
    >
      {children}
    </h2>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#475569",
          fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 650,
          color: "#e2e8f0",
          fontFamily: "'Cabinet Grotesk', sans-serif",
          textTransform: "capitalize",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function OpportunityDetail() {
  const [, params] = useRoute("/opportunity/:slug");
  const [, navigate] = useLocation();
  const [opportunity, setOpportunity] = useState<EnrichedOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpportunity = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/opportunities");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list: EnrichedOpportunity[] = Array.isArray(json) ? json : json.data || [];
        const found = list.find((opp) => opp.trendSlug === params?.slug);
        if (!found) {
          setError("Opportunity not found");
        } else {
          setOpportunity(found);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load opportunity");
      } finally {
        setLoading(false);
      }
    };

    if (params?.slug) {
      fetchOpportunity();
    }
  }, [params?.slug]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribeStatus("loading");
    setSubscribeError(null);

    try {
      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          trend_slug: opportunity?.trendSlug,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to subscribe");
      }

      setSubscribeStatus("success");
      setEmail("");
    } catch (e: any) {
      setSubscribeStatus("error");
      setSubscribeError(e.message || "Failed to subscribe");
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0a0f1a",
          color: "#94a3b8",
          gap: 12,
        }}
      >
        <Loader2 className="animate-spin" size={24} />
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14 }}>Loading opportunity...</span>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0a0f1a",
          color: "#f87171",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontFamily: "'DM Mono', monospace",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.2)",
            padding: "12px 18px",
            borderRadius: 10,
          }}
        >
          {error || "Opportunity not found"}
        </div>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            fontSize: 13,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8",
            cursor: "pointer",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1a",
        color: "#e2e8f0",
        fontFamily: "'Cabinet Grotesk', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');
        @font-face {
          font-family: 'Cabinet Grotesk';
          src: url('https://fonts.cdnfonts.com/css/cabinet-grotesk') format('woff2');
        }
      `}</style>

      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "40px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94a3b8",
              fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>

          <button
            onClick={() => {
              localStorage.setItem("trendRadar_historySlug", opportunity?.trendSlug || "");
              localStorage.setItem("trendRadar_historyPage", "true");
              navigate("/");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 8,
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)",
              color: "#4ade80",
              fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(74,222,128,0.15)";
              e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(74,222,128,0.08)";
              e.currentTarget.style.borderColor = "rgba(74,222,128,0.2)";
            }}
          >
            <TrendingUp size={16} />
            View History
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {/* Section 1: Header */}
          <section>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 20 }}>
              <ScoreRing score={opportunity.opportunityScore || 0} size={80} />
              <div style={{ flex: 1 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 32,
                    fontWeight: 750,
                    color: "#f1f5f9",
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    letterSpacing: "-0.03em",
                    lineHeight: 1.2,
                    textTransform: "capitalize",
                    marginBottom: 12,
                  }}
                >
                  {opportunity.trendName}
                </h1>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <LifecycleBadge lifecycle={opportunity.lifecycle} />
                  <span
                    style={{
                      fontSize: 13,
                      color: "#64748b",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {MACRO_LABELS[opportunity.macroDriver] || "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: The Opportunity */}
          <section>
            <SectionHeader>The Opportunity</SectionHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#475569",
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Analysis
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    color: "#cbd5e1",
                    lineHeight: 1.75,
                    fontFamily: "'Lora', serif",
                    padding: "16px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {opportunity.explanation}
                </p>
              </div>

              {opportunity.businessIdea && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Business Idea
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      color: "#cbd5e1",
                      lineHeight: 1.75,
                      fontFamily: "'Lora', serif",
                      padding: "16px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {opportunity.businessIdea}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Section 3: Market */}
          <section>
            <SectionHeader>Market</SectionHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {opportunity.icp && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Ideal Customer Profile
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "#cbd5e1",
                      lineHeight: 1.65,
                      fontFamily: "'Lora', serif",
                      padding: "14px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {opportunity.icp}
                  </p>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {opportunity.gapType && (
                  <MetricCard label="Gap Type" value={opportunity.gapType.replace("_", " ")} />
                )}
                {opportunity.competitorGap && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#475569",
                        fontFamily: "'DM Mono', monospace",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      Competitor Gap
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        color: "#cbd5e1",
                        lineHeight: 1.65,
                        fontFamily: "'Lora', serif",
                        padding: "14px",
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {opportunity.competitorGap}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 4: Economics */}
          <section>
            <SectionHeader>Economics</SectionHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {opportunity.monetization && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Monetization Strategy
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "#cbd5e1",
                      lineHeight: 1.65,
                      fontFamily: "'Lora', serif",
                      padding: "14px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {opportunity.monetization}
                  </p>
                </div>
              )}

              <div
                style={{
                  padding: "18px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <DifficultyBar score={opportunity.difficultyScore || 0} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <MetricCard label="Opportunity Score" value={`${opportunity.opportunityScore}/100`} />
                <MetricCard label="Label" value={opportunity.opportunityLabel} />
              </div>
            </div>
          </section>

          {/* Section 5: Signals */}
          <section>
            <SectionHeader>Signals & Metrics</SectionHeader>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <MetricCard label="Signal Count" value={opportunity.signalCount || 0} />
              <MetricCard label="Pain Class" value={opportunity.painClass || "—"} />
              <MetricCard label="Velocity" value={opportunity.velocity?.toFixed(2) || "—"} />
              <MetricCard label="Topic" value={opportunity.topic || "—"} />
            </div>
          </section>

          {/* Section 5.5: Signal Evidence Quality */}
          {opportunity.signalQuality && (
            <section>
              <SectionHeader>Signal Evidence Quality</SectionHeader>
              <div style={{
                padding: "24px",
                background: opportunity.signalQuality >= 7
                  ? "rgba(74,222,128,0.05)"
                  : opportunity.signalQuality >= 5
                  ? "rgba(251,146,60,0.05)"
                  : "rgba(239,68,68,0.05)",
                border: `1px solid ${
                  opportunity.signalQuality >= 7
                    ? "rgba(74,222,128,0.2)"
                    : opportunity.signalQuality >= 5
                    ? "rgba(251,146,60,0.2)"
                    : "rgba(239,68,68,0.2)"
                }`,
                borderRadius: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: opportunity.signalQuality >= 7
                      ? "rgba(74,222,128,0.2)"
                      : opportunity.signalQuality >= 5
                      ? "rgba(251,146,60,0.2)"
                      : "rgba(239,68,68,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    fontWeight: 700,
                    color: opportunity.signalQuality >= 7
                      ? "#4ade80"
                      : opportunity.signalQuality >= 5
                      ? "#fb923c"
                      : "#ef4444",
                    fontFamily: "'DM Mono', monospace",
                  }}>
                    {opportunity.signalQuality}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: 16,
                      fontWeight: 650,
                      color: "#f1f5f9",
                      fontFamily: "'Cabinet Grotesk', sans-serif",
                      marginBottom: 4,
                    }}>
                      {opportunity.signalQuality >= 7
                        ? "High Quality Evidence"
                        : opportunity.signalQuality >= 5
                        ? "Moderate Quality Evidence"
                        : "Mixed Quality Evidence"}
                    </h4>
                    <p style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#94a3b8",
                      fontFamily: "'DM Mono', monospace",
                      lineHeight: 1.5,
                    }}>
                      This opportunity is supported by {opportunity.signalCount || 0} market signals
                      with an average quality score of {opportunity.signalQuality}/10
                    </p>
                  </div>
                </div>

                {opportunity.signalSources && opportunity.signalSources.length > 0 && (
                  <div>
                    <p style={{
                      margin: "0 0 12px",
                      fontSize: 12,
                      color: "#64748b",
                      fontFamily: "'DM Mono', monospace",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 600,
                    }}>
                      Signal Sources
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {opportunity.signalSources.map((source: string) => (
                        <span
                          key={source}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#cbd5e1",
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: "'DM Mono', monospace",
                            textTransform: "capitalize",
                          }}
                        >
                          {source === "stackoverflow" ? "Stack Overflow" :
                           source === "hackernews" ? "Hacker News" :
                           source === "producthunt" ? "Product Hunt" :
                           source === "github" ? "GitHub" : source}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#64748b",
                    fontFamily: "'DM Mono', monospace",
                    lineHeight: 1.6,
                    fontStyle: "italic",
                  }}>
                    Signal quality reflects engagement depth, source credibility, and problem specificity.
                    Higher scores indicate stronger market validation.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Section 6: Subscribe */}
          <section>
            <SectionHeader>Get Alerts</SectionHeader>
            <div
              style={{
                padding: "24px",
                background: "rgba(74,222,128,0.03)",
                border: "1px solid rgba(74,222,128,0.15)",
                borderRadius: 12,
              }}
            >
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 14,
                  color: "#94a3b8",
                  fontFamily: "'DM Mono', monospace",
                  lineHeight: 1.6,
                }}
              >
                Get notified when this trend changes lifecycle stage
              </p>
              {subscribeStatus === "success" ? (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "rgba(74,222,128,0.1)",
                    border: "1px solid rgba(74,222,128,0.3)",
                    borderRadius: 8,
                    fontSize: 14,
                    color: "#4ade80",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  ✓ Subscribed! Check your email for confirmation.
                </div>
              ) : (
                <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={subscribeStatus === "loading"}
                    style={{
                      flex: "1 1 200px",
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#e2e8f0",
                      fontSize: 14,
                      fontFamily: "'DM Mono', monospace",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={subscribeStatus === "loading"}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      background: subscribeStatus === "loading" ? "rgba(74,222,128,0.2)" : "rgba(74,222,128,0.15)",
                      border: "1px solid rgba(74,222,128,0.3)",
                      color: "#4ade80",
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "'DM Mono', monospace",
                      cursor: subscribeStatus === "loading" ? "not-allowed" : "pointer",
                      opacity: subscribeStatus === "loading" ? 0.6 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    {subscribeStatus === "loading" ? "Subscribing..." : "Alert me when this changes"}
                  </button>
                </form>
              )}
              {subscribeStatus === "error" && subscribeError && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 16px",
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "#f87171",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {subscribeError}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
