"use client";

import {
  Activity,
  BarChart3,
  Brain,
  FileText,
  Gauge,
  LoaderCircle,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type AnalyticsOverview = {
  total_conversations: number;
  total_messages: number;
  active_memories: number;
  total_documents: number;
  feedback_total: number;
  positive_feedback: number;
  negative_feedback: number;
  positive_feedback_rate: number;
};

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "en-IN"
  ).format(value);
}

function toPercent(
  value: number
) {
  return Math.round(
    value * 100
  );
}

export default function AnalyticsWorkspace() {
  const router = useRouter();

  const [
    overview,
    setOverview,
  ] = useState<AnalyticsOverview | null>(
    null
  );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadInitialAnalytics() {
      try {
        const response =
          await fetch(
            "/api/analytics/overview",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (
          response.status === 401
        ) {
          router.replace(
            "/login"
          );

          return;
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data?.detail ===
              "string"
              ? data.detail
              : "Unable to load analytics."
          );
        }

        if (!active) {
          return;
        }

        setOverview(
          data as AnalyticsOverview
        );
      } catch (caughtError) {
        if (!active) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load analytics."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialAnalytics();

    return () => {
      active = false;
    };
  }, [router]);

  const refreshAnalytics =
    useCallback(
      async () => {
        setRefreshing(true);
        setError("");

        try {
          const response =
            await fetch(
              "/api/analytics/overview",
              {
                method: "GET",
                cache: "no-store",
              }
            );

          if (
            response.status === 401
          ) {
            router.replace(
              "/login"
            );

            return;
          }

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              typeof data?.detail ===
                "string"
                ? data.detail
                : "Unable to load analytics."
            );
          }

          setOverview(
            data as AnalyticsOverview
          );
        } catch (caughtError) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load analytics."
          );
        } finally {
          setRefreshing(false);
        }
      },
      [router]
    );

  const derived = useMemo(
    () => {
      if (!overview) {
        return {
          messagesPerConversation: 0,
          memoriesPerConversation: 0,
          positivePercent: 0,
          negativePercent: 0,
        };
      }

      const conversations =
        overview.total_conversations;

      const feedbackTotal =
        overview.feedback_total;

      return {
        messagesPerConversation:
          conversations > 0
            ? overview.total_messages /
              conversations
            : 0,

        memoriesPerConversation:
          conversations > 0
            ? overview.active_memories /
              conversations
            : 0,

        positivePercent:
          feedbackTotal > 0
            ? (
                overview.positive_feedback /
                feedbackTotal
              ) * 100
            : 0,

        negativePercent:
          feedbackTotal > 0
            ? (
                overview.negative_feedback /
                feedbackTotal
              ) * 100
            : 0,
      };
    },
    [overview]
  );

  const metricCards =
    overview
      ? [
          {
            label:
              "Conversations",
            value:
              formatNumber(
                overview.total_conversations
              ),
            detail:
              "Persistent chat threads",
            icon:
              MessageSquareText,
          },
          {
            label:
              "Messages",
            value:
              formatNumber(
                overview.total_messages
              ),
            detail:
              "User + assistant turns",
            icon:
              Activity,
          },
          {
            label:
              "Active memories",
            value:
              formatNumber(
                overview.active_memories
              ),
            detail:
              "Usable persistent context",
            icon:
              Brain,
          },
          {
            label:
              "Documents",
            value:
              formatNumber(
                overview.total_documents
              ),
            detail:
              "Uploaded knowledge sources",
            icon:
              FileText,
          },
        ]
      : [];

  return (
    <section className="workspace min-w-0">
      <header className="topbar">
        <div className="conversation-title">
          <div>
            <span className="eyebrow">
              Intelligence telemetry
            </span>

            <h1>
              Analytics
            </h1>
          </div>

          <div className="ml-2 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/42">
            <BarChart3
              size={14}
              className="text-violet-300/65"
            />
            Live account metrics
          </div>
        </div>

        <div className="topbar-actions">
          <div className="privacy-pill">
            <ShieldCheck size={15} />
            Private analytics
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1160px] px-6 py-7 lg:px-8">
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/60">
                <Sparkles size={13} />
                Real usage data
              </div>

              <h2 className="max-w-[760px] text-[34px] font-medium leading-[1.1] tracking-[-0.045em] text-white/95">
                See how your
                <span className="bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">
                  {" "}
                  intelligence layer
                </span>
                {" "}
                is growing.
              </h2>

              <p className="mt-3 max-w-[760px] text-[13px] leading-6 text-white/38">
                Every number below comes from your authenticated Memora account.
                No demo counters and no placeholder analytics.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void refreshAnalytics()
              }
              disabled={
                loading ||
                refreshing
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 text-[11px] font-medium text-white/50 transition hover:border-violet-300/15 hover:bg-violet-400/[0.04] hover:text-white/72 disabled:cursor-wait disabled:opacity-50"
            >
              {refreshing ? (
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw
                  size={14}
                />
              )}
              Refresh
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-400/15 bg-red-400/[0.045] px-4 py-3 text-[12px] leading-5 text-red-200/75">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid min-h-[360px] place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.015]">
              <div className="flex items-center gap-3 text-[12px] text-white/35">
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
                Loading real analytics...
              </div>
            </div>
          ) : overview ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metricCards.map(
                  (metric) => {
                    const Icon =
                      metric.icon;

                    return (
                      <div
                        key={
                          metric.label
                        }
                        className="group rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5 transition hover:border-violet-300/12 hover:bg-white/[0.025]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/27">
                              {
                                metric.label
                              }
                            </p>

                            <div className="mt-2 text-[31px] font-medium tracking-[-0.055em] text-white/88">
                              {
                                metric.value
                              }
                            </div>
                          </div>

                          <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/10 bg-violet-400/[0.045] text-violet-300/55 transition group-hover:text-violet-300/75">
                            <Icon
                              size={17}
                            />
                          </div>
                        </div>

                        <p className="mt-4 text-[11px] leading-5 text-white/30">
                          {
                            metric.detail
                          }
                        </p>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5 lg:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/27">
                        Response quality
                      </span>

                      <h3 className="mt-2 text-[19px] font-medium tracking-[-0.025em] text-white/82">
                        Feedback signal
                      </h3>

                      <p className="mt-1 text-[11px] leading-5 text-white/31">
                        Direct ratings attached to assistant responses.
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] px-3 py-2 text-right">
                      <div className="text-[9px] uppercase tracking-[0.12em] text-white/27">
                        Positive rate
                      </div>

                      <div className="mt-1 text-[21px] font-medium tracking-[-0.04em] text-emerald-200/75">
                        {toPercent(
                          overview.positive_feedback_rate
                        )}
                        %
                      </div>
                    </div>
                  </div>

                  <div className="mt-7">
                    <div className="mb-2 flex items-center justify-between text-[10px] text-white/34">
                      <span>
                        Rated responses
                      </span>

                      <span>
                        {formatNumber(
                          overview.feedback_total
                        )}
                      </span>
                    </div>

                    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                      {overview.feedback_total >
                      0 ? (
                        <>
                          <span
                            className="h-full bg-emerald-300/60"
                            style={{
                              width:
                                `${derived.positivePercent}%`,
                            }}
                          />

                          <span
                            className="h-full bg-rose-300/45"
                            style={{
                              width:
                                `${derived.negativePercent}%`,
                            }}
                          />
                        </>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.11em] text-white/28">
                          <ThumbsUp
                            size={13}
                            className="text-emerald-300/60"
                          />
                          Positive
                        </div>

                        <div className="mt-2 flex items-end justify-between gap-3">
                          <strong className="text-[24px] font-medium tracking-[-0.04em] text-white/80">
                            {formatNumber(
                              overview.positive_feedback
                            )}
                          </strong>

                          <span className="text-[10px] text-white/30">
                            {Math.round(
                              derived.positivePercent
                            )}
                            %
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.11em] text-white/28">
                          <ThumbsDown
                            size={13}
                            className="text-rose-300/55"
                          />
                          Negative
                        </div>

                        <div className="mt-2 flex items-end justify-between gap-3">
                          <strong className="text-[24px] font-medium tracking-[-0.04em] text-white/80">
                            {formatNumber(
                              overview.negative_feedback
                            )}
                          </strong>

                          <span className="text-[10px] text-white/30">
                            {Math.round(
                              derived.negativePercent
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5 lg:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/27">
                        Density
                      </span>

                      <h3 className="mt-2 text-[19px] font-medium tracking-[-0.025em] text-white/82">
                        Workspace ratios
                      </h3>
                    </div>

                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-sky-300/10 bg-sky-400/[0.04] text-sky-300/55">
                      <Gauge
                        size={17}
                      />
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[11px] text-white/38">
                          Messages / conversation
                        </span>

                        <strong className="text-[17px] font-medium text-white/76">
                          {derived.messagesPerConversation.toFixed(
                            1
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[11px] text-white/38">
                          Active memories / conversation
                        </span>

                        <strong className="text-[17px] font-medium text-white/76">
                          {derived.memoriesPerConversation.toFixed(
                            2
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[11px] text-white/38">
                          Rated assistant responses
                        </span>

                        <strong className="text-[17px] font-medium text-white/76">
                          {formatNumber(
                            overview.feedback_total
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <p className="mt-5 text-[10px] leading-5 text-white/24">
                    Ratios are derived only from the live counters above.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="grid min-h-[320px] place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.015]">
              <div className="max-w-sm text-center">
                <BarChart3
                  size={22}
                  className="mx-auto text-white/25"
                />

                <p className="mt-3 text-[12px] text-white/35">
                  Analytics data is not available yet.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}