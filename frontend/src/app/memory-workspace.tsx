"use client";

import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type MemoryType =
  | "semantic"
  | "episodic"
  | "preference"
  | "goal"
  | "procedural";

type MemoryRecord = {
  id: string;
  memory_type: MemoryType;
  content: string;
  importance_score: number;
  confidence_score: number;
  access_count: number;
  is_active: boolean;
  created_at: string;
};

type CleanupResult = {
  status: string;
  deactivated: number;
  merged: number;
};

const MEMORY_TYPES: {
  value: MemoryType;
  label: string;
  description: string;
}[] = [
  {
    value: "semantic",
    label: "Semantic",
    description: "Facts and stable background knowledge",
  },
  {
    value: "preference",
    label: "Preference",
    description: "Likes, dislikes, and personal choices",
  },
  {
    value: "goal",
    label: "Goal",
    description: "Objectives and things you want to achieve",
  },
  {
    value: "procedural",
    label: "Procedural",
    description: "Preferred workflows and ways of working",
  },
  {
    value: "episodic",
    label: "Episodic",
    description: "Specific events or experiences",
  },
];

function getErrorMessage(
  data: unknown,
  fallback: string
) {
  if (
    typeof data === "object" &&
    data !== null &&
    "detail" in data
  ) {
    const detail = (
      data as {
        detail?: unknown;
      }
    ).detail;

    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function percentage(value: number) {
  return `${Math.round(
    Math.max(0, Math.min(1, value)) * 100
  )}%`;
}

function typeLabel(type: MemoryType) {
  return (
    MEMORY_TYPES.find(
      (item) => item.value === type
    )?.label ?? type
  );
}

export default function MemoryWorkspace() {
  const router = useRouter();

  const [memories, setMemories] =
    useState<MemoryRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [cleaning, setCleaning] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [composerOpen, setComposerOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const [filter, setFilter] =
    useState<"all" | MemoryType>("all");

  const [content, setContent] =
    useState("");

  const [memoryType, setMemoryType] =
    useState<MemoryType>("semantic");

  const [importance, setImportance] =
    useState(0.5);

  const [confidence, setConfidence] =
    useState(0.8);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadInitialMemories() {
      try {
        const response = await fetch(
          "/api/memories",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              data,
              "Unable to load memories."
            )
          );
        }

        if (active) {
          setMemories(
            Array.isArray(data)
              ? data
              : []
          );
        }
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load memories."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialMemories();

    return () => {
      active = false;
    };
  }, [router]);

  async function refreshMemories() {
    try {
      const response = await fetch(
        "/api/memories",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to refresh memories."
          )
        );
      }

      setMemories(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to refresh memories."
      );
    }
  }

  async function createMemory(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedContent =
      content.trim();

    if (!trimmedContent) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      setCreating(true);

      const response = await fetch(
        "/api/memories",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            content: trimmedContent,
            memory_type: memoryType,
            importance_score: importance,
            confidence_score: confidence,
          }),
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to create memory."
          )
        );
      }

      setContent("");
      setMemoryType("semantic");
      setImportance(0.5);
      setConfidence(0.8);
      setComposerOpen(false);
      setSuccess(
        "Memory added to your persistent context."
      );

      await refreshMemories();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create memory."
      );
    } finally {
      setCreating(false);
    }
  }

  async function forgetMemory(
    memory: MemoryRecord
  ) {
    const shouldForget =
      window.confirm(
        `Forget this memory?\n\n"${memory.content}"`
      );

    if (!shouldForget) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      setDeletingId(memory.id);

      const response = await fetch(
        `/api/memories/${memory.id}`,
        {
          method: "DELETE",
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to forget memory."
          )
        );
      }

      setMemories((current) =>
        current.filter(
          (item) =>
            item.id !== memory.id
        )
      );

      setSuccess(
        "Memory removed from active context."
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to forget memory."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function cleanupMemories() {
    setError("");
    setSuccess("");

    try {
      setCleaning(true);

      const response = await fetch(
        "/api/memories/cleanup",
        {
          method: "POST",
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to clean up memories."
          )
        );
      }

      const result =
        data as CleanupResult;

      setSuccess(
        `Memory cleanup complete · ${result.deactivated} deactivated · ${result.merged} merged`
      );

      await refreshMemories();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to clean up memories."
      );
    } finally {
      setCleaning(false);
    }
  }

  const filteredMemories =
    memories.filter((memory) => {
      const matchesQuery =
        memory.content
          .toLowerCase()
          .includes(
            query.trim().toLowerCase()
          );

      const matchesType =
        filter === "all" ||
        memory.memory_type === filter;

      return (
        matchesQuery &&
        matchesType
      );
    });

  const averageConfidence =
    memories.length === 0
      ? 0
      : memories.reduce(
          (total, memory) =>
            total +
            memory.confidence_score,
          0
        ) / memories.length;

  const totalAccesses =
    memories.reduce(
      (total, memory) =>
        total +
        memory.access_count,
      0
    );

  return (
    <section className="workspace min-w-0">
      <header className="topbar">
        <div className="conversation-title">
          <div>
            <span className="eyebrow">
              Persistent context
            </span>

            <h1>
              Memory intelligence
            </h1>
          </div>

          <div className="ml-2 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[9px] text-white/35">
            <Brain
              size={13}
              className="text-violet-300/65"
            />
            Lifecycle active
          </div>
        </div>

        <div className="topbar-actions">
          <div className="privacy-pill">
            <ShieldCheck size={15} />
            User isolated
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1120px] px-6 py-8 lg:px-8">
          <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/60">
                <Sparkles size={13} />
                Adaptive memory
              </div>

              <h2 className="max-w-[700px] text-[30px] font-medium leading-[1.12] tracking-[-0.045em] text-white/95">
                Inspect what Memora
                <span className="bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">
                  {" "}
                  carries forward.
                </span>
              </h2>

              <p className="mt-3 max-w-[650px] text-[11px] leading-6 text-white/35">
                Active memories are available to retrieval when
                relevant. You can add explicit context, inspect
                confidence and importance, run lifecycle cleanup,
                or make Memora forget an item.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={cleaning}
                onClick={() =>
                  void cleanupMemories()
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 text-[9px] text-white/45 transition hover:border-violet-300/15 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cleaning ? (
                  <LoaderCircle
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <RefreshCcw
                    size={13}
                  />
                )}
                Clean up
              </button>

              <button
                type="button"
                onClick={() =>
                  setComposerOpen(
                    (current) =>
                      !current
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-300/15 bg-violet-400/[0.08] px-3 text-[9px] font-medium text-violet-100/75 transition hover:border-violet-300/25 hover:bg-violet-400/[0.12]"
              >
                <Plus size={14} />
                Add memory
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[8px] uppercase tracking-[0.12em] text-white/25">
                  Active memories
                </span>

                <Brain
                  size={14}
                  className="text-violet-300/45"
                />
              </div>

              <div className="mt-3 text-[23px] font-medium tracking-[-0.05em] text-white/82">
                {memories.length}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[8px] uppercase tracking-[0.12em] text-white/25">
                  Avg. confidence
                </span>

                <Gauge
                  size={14}
                  className="text-sky-300/45"
                />
              </div>

              <div className="mt-3 text-[23px] font-medium tracking-[-0.05em] text-white/82">
                {percentage(
                  averageConfidence
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[8px] uppercase tracking-[0.12em] text-white/25">
                  Retrieval accesses
                </span>

                <Clock3
                  size={14}
                  className="text-emerald-300/45"
                />
              </div>

              <div className="mt-3 text-[23px] font-medium tracking-[-0.05em] text-white/82">
                {totalAccesses}
              </div>
            </div>
          </div>

          {composerOpen && (
            <form
              onSubmit={createMemory}
              className="mb-6 rounded-2xl border border-violet-300/10 bg-[radial-gradient(circle_at_20%_0%,rgba(139,116,232,0.08),transparent_45%),rgba(255,255,255,0.018)] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[12px] font-medium text-white/75">
                    Add explicit memory
                  </h3>

                  <p className="mt-1 text-[9px] leading-5 text-white/27">
                    Use this for stable context that should be available
                    beyond the current conversation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setComposerOpen(false)
                  }
                  className="grid h-8 w-8 place-items-center rounded-lg text-white/25 hover:bg-white/[0.04] hover:text-white/55"
                >
                  <X size={14} />
                </button>
              </div>

              <textarea
                value={content}
                onChange={(event) =>
                  setContent(
                    event.target.value
                  )
                }
                required
                placeholder="Example: I prefer concise, step-by-step explanations for coding tasks."
                className="mt-4 min-h-[88px] w-full resize-none rounded-xl border border-white/[0.08] bg-black/10 px-4 py-3 text-[10px] leading-5 text-white/70 outline-none placeholder:text-white/18 focus:border-violet-300/20"
              />

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
                <label className="block">
                  <span className="mb-2 block text-[8px] uppercase tracking-[0.11em] text-white/25">
                    Memory type
                  </span>

                  <select
                    value={memoryType}
                    onChange={(event) =>
                      setMemoryType(
                        event.target.value as MemoryType
                      )
                    }
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#0d0f14] px-3 text-[9px] text-white/60 outline-none focus:border-violet-300/20"
                  >
                    {MEMORY_TYPES.map(
                      (item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-[8px] uppercase tracking-[0.11em] text-white/25">
                    <span>
                      Importance
                    </span>

                    <span className="text-white/45">
                      {percentage(
                        importance
                      )}
                    </span>
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={importance}
                    onChange={(event) =>
                      setImportance(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className="w-full accent-violet-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center justify-between text-[8px] uppercase tracking-[0.11em] text-white/25">
                    <span>
                      Confidence
                    </span>

                    <span className="text-white/45">
                      {percentage(
                        confidence
                      )}
                    </span>
                  </span>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={confidence}
                    onChange={(event) =>
                      setConfidence(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className="w-full accent-sky-400"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={
                    creating ||
                    !content.trim()
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-violet-300 to-sky-300 px-4 text-[9px] font-semibold text-[#111018] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    <LoaderCircle
                      size={13}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={13} />
                  )}
                  Save memory
                </button>
              </div>
            </form>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-400/15 bg-red-400/[0.045] px-4 py-3 text-[10px] leading-5 text-red-200/70">
              <AlertCircle
                size={15}
                className="mt-0.5 shrink-0"
              />

              <span className="flex-1">
                {error}
              </span>

              <button
                type="button"
                onClick={() =>
                  setError("")
                }
                className="text-red-200/35 hover:text-red-200/70"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-400/12 bg-emerald-400/[0.035] px-4 py-3 text-[10px] leading-5 text-emerald-200/65">
              <CheckCircle2
                size={15}
                className="mt-0.5 shrink-0"
              />

              <span className="flex-1">
                {success}
              </span>

              <button
                type="button"
                onClick={() =>
                  setSuccess("")
                }
                className="text-emerald-200/30 hover:text-emerald-200/70"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() =>
                  setFilter("all")
                }
                className={`shrink-0 rounded-lg border px-3 py-2 text-[8px] transition ${
                  filter === "all"
                    ? "border-violet-300/15 bg-violet-400/[0.07] text-violet-100/70"
                    : "border-white/[0.06] bg-white/[0.018] text-white/30 hover:text-white/50"
                }`}
              >
                All
              </button>

              {MEMORY_TYPES.map(
                (item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      setFilter(
                        item.value
                      )
                    }
                    className={`shrink-0 rounded-lg border px-3 py-2 text-[8px] transition ${
                      filter ===
                      item.value
                        ? "border-violet-300/15 bg-violet-400/[0.07] text-violet-100/70"
                        : "border-white/[0.06] bg-white/[0.018] text-white/30 hover:text-white/50"
                    }`}
                  >
                    {item.label}
                  </button>
                )
              )}
            </div>

            <div className="relative w-full lg:w-[260px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20"
              />

              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder="Search memory..."
                className="h-9 w-full rounded-lg border border-white/[0.07] bg-white/[0.025] pl-9 pr-3 text-[10px] text-white/70 outline-none placeholder:text-white/20 focus:border-violet-300/20"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid min-h-[250px] place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.012]">
              <div className="flex items-center gap-2 text-[10px] text-white/28">
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
                Loading persistent context...
              </div>
            </div>
          ) : filteredMemories.length ===
            0 ? (
            <div className="grid min-h-[250px] place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.012] px-6 text-center">
              <div>
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-violet-300/10 bg-violet-400/[0.04] text-violet-300/45">
                  <Brain size={18} />
                </div>

                <p className="mt-3 text-[11px] font-medium text-white/50">
                  {memories.length === 0
                    ? "No active memories yet"
                    : "No matching memories"}
                </p>

                <p className="mt-1 text-[9px] text-white/24">
                  {memories.length === 0
                    ? "Memora can learn useful context from conversations or from explicit memories you add."
                    : "Try a different search or memory type."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredMemories.map(
                (memory) => (
                  <article
                    key={memory.id}
                    className="group rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.028] to-white/[0.012] p-4 transition hover:border-violet-300/15"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-violet-300/10 bg-violet-400/[0.05] text-violet-300/60">
                        <Brain size={16} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-violet-300/10 bg-violet-400/[0.045] px-2 py-1 text-[7px] font-medium uppercase tracking-[0.08em] text-violet-200/55">
                            {typeLabel(
                              memory.memory_type
                            )}
                          </span>

                          <span className="text-[8px] text-white/20">
                            {formatDate(
                              memory.created_at
                            )}
                          </span>
                        </div>

                        <p className="mt-3 text-[10px] leading-5 text-white/62">
                          {memory.content}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={
                          deletingId ===
                          memory.id
                        }
                        onClick={() =>
                          void forgetMemory(
                            memory
                          )
                        }
                        aria-label="Forget memory"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/18 opacity-60 transition hover:bg-red-400/[0.06] hover:text-red-300/65 group-hover:opacity-100 disabled:cursor-not-allowed"
                      >
                        {deletingId ===
                        memory.id ? (
                          <LoaderCircle
                            size={14}
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.045] pt-3">
                      <div>
                        <div className="flex items-center justify-between text-[7px] uppercase tracking-[0.08em] text-white/20">
                          <span>
                            Importance
                          </span>

                          <span className="text-white/35">
                            {percentage(
                              memory.importance_score
                            )}
                          </span>
                        </div>

                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.045]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-400/60 to-violet-300/75"
                            style={{
                              width:
                                percentage(
                                  memory.importance_score
                                ),
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[7px] uppercase tracking-[0.08em] text-white/20">
                          <span>
                            Confidence
                          </span>

                          <span className="text-white/35">
                            {percentage(
                              memory.confidence_score
                            )}
                          </span>
                        </div>

                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.045]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400/55 to-emerald-300/65"
                            style={{
                              width:
                                percentage(
                                  memory.confidence_score
                                ),
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[8px] text-white/22">
                      <span>
                        Retrieved {memory.access_count}{" "}
                        {memory.access_count === 1
                          ? "time"
                          : "times"}
                      </span>

                      <span className="flex items-center gap-1.5 text-emerald-300/45">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/60" />
                        Active
                      </span>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
