"use client";

import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSearch,
  LoaderCircle,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wrench,
  X,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  WORLD_TIMEZONES,
  type TimezoneOption,
} from "./timezone-data";

type ToolDefinition = {
  name: string;
  description: string;
  arguments: Record<string, string>;
};

type ToolExecution = {
  status: string;
  tool: string;
  result: unknown;
  executed_at: string;
};

type CalculatorResult = {
  expression?: string;
  result?: number | string;
};

type DateTimeResult = {
  timezone?: string;
  iso?: string;
  date?: string;
  time?: string;
  weekday?: string;
};

type DocumentMatch = {
  document_id: string;
  filename: string;
  chunk_id: string;
  chunk_index: number;
  page_number: number | null;
  content: string;
  semantic_similarity: number;
  lexical_score: number;
  retrieval_score: number;
  similarity: number;
};

type DocumentSearchResult = {
  query: string;
  matches: DocumentMatch[];
  match_count: number;
};

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

function formatExecutionTime(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  ).format(date);
}

function isDocumentSearchResult(
  value: unknown
): value is DocumentSearchResult {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  return (
    "query" in value &&
    "matches" in value &&
    Array.isArray(
      (
        value as {
          matches?: unknown;
        }
      ).matches
    )
  );
}

function isCalculatorResult(
  value: unknown
): value is CalculatorResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "result" in value
  );
}

function isDateTimeResult(
  value: unknown
): value is DateTimeResult {
  return (
    typeof value === "object" &&
    value !== null &&
    (
      "timezone" in value ||
      "date" in value ||
      "time" in value
    )
  );
}

function optionLabel(
  option: TimezoneOption
) {
  if (option.timezone === "UTC") {
    return "Global — UTC";
  }

  return (
    `${option.country} — ` +
    option.timezone
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("/", " ")
    .trim();
}

export default function ToolsWorkspace() {
  const router = useRouter();

  const timezoneBoxRef =
    useRef<HTMLDivElement | null>(null);

  const [tools, setTools] =
    useState<ToolDefinition[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [runningTool, setRunningTool] =
    useState<string | null>(null);

  const [activeTool, setActiveTool] =
    useState<
      "calculator" |
      "date_time" |
      "document_search"
    >("calculator");

  const [expression, setExpression] =
    useState("8+91");

  const [
    timezoneInput,
    setTimezoneInput,
  ] = useState(
    "India — Asia/Kolkata"
  );

  const [
    selectedTimezone,
    setSelectedTimezone,
  ] = useState("Asia/Kolkata");

  const [
    timezoneOpen,
    setTimezoneOpen,
  ] = useState(false);

  const [documentQuery, setDocumentQuery] =
    useState(
      "What is the aim of experiment 1?"
    );

  const [documentLimit, setDocumentLimit] =
    useState(3);

  const [execution, setExecution] =
    useState<ToolExecution | null>(
      null
    );

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadTools() {
      try {
        const response = await fetch(
          "/api/tools",
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
              "Unable to load tools."
            )
          );
        }

        if (active) {
          setTools(
            Array.isArray(data.tools)
              ? data.tools
              : []
          );
        }
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load tools."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTools();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent
    ) {
      if (
        timezoneBoxRef.current &&
        !timezoneBoxRef.current.contains(
          event.target as Node
        )
      ) {
        setTimezoneOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, []);

  const filteredTimezones =
    useMemo(() => {
      const query =
        normalize(timezoneInput);

      if (!query) {
        return WORLD_TIMEZONES.slice(
          0,
          80
        );
      }

      return WORLD_TIMEZONES.filter(
        (option: TimezoneOption) => {
          const searchable = normalize(
            `${option.country} ` +
              `${option.countryCode} ` +
              `${option.timezone}`
          );

          return searchable.includes(
            query
          );
        }
      ).slice(0, 80);
    }, [timezoneInput]);

  async function executeTool(
    toolName: string,
    argumentsValue: Record<
      string,
      unknown
    >
  ) {
    setError("");
    setExecution(null);

    try {
      setRunningTool(toolName);

      const response = await fetch(
        "/api/tools",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            tool_name: toolName,
            arguments: argumentsValue,
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
            "Tool execution failed."
          )
        );
      }

      setExecution(
        data as ToolExecution
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Tool execution failed."
      );
    } finally {
      setRunningTool(null);
    }
  }

  function submitCalculator(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    void executeTool(
      "calculator",
      {
        expression:
          expression.trim(),
      }
    );
  }

  function resolveTimezone() {
    const typed =
      timezoneInput.trim();

    const exactByZone =
      WORLD_TIMEZONES.find(
        (option: TimezoneOption) =>
          option.timezone.toLowerCase() ===
          typed.toLowerCase()
      );

    if (exactByZone) {
      return exactByZone.timezone;
    }

    const exactByLabel =
      WORLD_TIMEZONES.find(
        (option: TimezoneOption) =>
          optionLabel(option)
            .toLowerCase() ===
          typed.toLowerCase()
      );

    if (exactByLabel) {
      return exactByLabel.timezone;
    }

    if (
      typed ===
      optionLabel(
        WORLD_TIMEZONES.find(
          (option: TimezoneOption) =>
            option.timezone ===
            selectedTimezone
        ) ?? WORLD_TIMEZONES[0]
      )
    ) {
      return selectedTimezone;
    }

    const exactCountryMatches =
      WORLD_TIMEZONES.filter(
        (option: TimezoneOption) =>
          option.country.toLowerCase() ===
          typed.toLowerCase()
      );

    const uniqueCountryZones =
      [
        ...new Set(
          exactCountryMatches.map(
            (option: TimezoneOption) =>
              option.timezone
          )
        ),
      ];

    if (
      uniqueCountryZones.length === 1
    ) {
      return uniqueCountryZones[0];
    }

    if (
      typed.includes("/") ||
      typed.toUpperCase() === "UTC"
    ) {
      return typed;
    }

    return null;
  }

  function submitDateTime(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const resolved =
      resolveTimezone();

    if (!resolved) {
      setError(
        "Select a timezone from the dropdown, " +
          "or enter a valid IANA timezone such as Asia/Kolkata."
      );
      return;
    }

    void executeTool(
      "date_time",
      {
        timezone: resolved,
      }
    );
  }

  function submitDocumentSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    void executeTool(
      "document_search",
      {
        query:
          documentQuery.trim(),
        limit: documentLimit,
      }
    );
  }

  const discoveredToolNames =
    new Set(
      tools.map((tool) => tool.name)
    );

  const currentDefinition =
    tools.find(
      (tool) =>
        tool.name === activeTool
    );

  const latestResult =
    execution?.result;

  return (
    <section className="workspace min-w-0">
      <header className="topbar">
        <div className="conversation-title">
          <div>
            <span className="eyebrow">
              Execution layer
            </span>

            <h1>
              Tool intelligence
            </h1>
          </div>

          <div className="ml-2 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/42">
            <TerminalSquare
              size={14}
              className="text-violet-300/65"
            />
            Backend connected
          </div>
        </div>

        <div className="topbar-actions">
          <div className="privacy-pill">
            <ShieldCheck size={15} />
            Authenticated
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1160px] px-6 py-7 lg:px-8">
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/60">
                <Sparkles size={13} />
                Real tool execution
              </div>

              <h2 className="max-w-[760px] text-[34px] font-medium leading-[1.1] tracking-[-0.045em] text-white/95">
                Give Memora actions,
                not just
                <span className="bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">
                  {" "}
                  language.
                </span>
              </h2>

              <p className="mt-3 max-w-[760px] text-[13px] leading-6 text-white/38">
                Run authenticated backend tools for clean calculations,
                worldwide timezone-aware date and time,
                and hybrid document retrieval.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
              <div className="text-[9px] uppercase tracking-[0.12em] text-white/28">
                Discovered tools
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[24px] font-medium tracking-[-0.04em] text-white/82">
                  {loading
                    ? "—"
                    : tools.length}
                </span>

                {!loading &&
                  tools.length > 0 && (
                    <span className="h-2 w-2 rounded-full bg-emerald-300/70" />
                  )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-400/15 bg-red-400/[0.045] px-4 py-3 text-[12px] leading-5 text-red-200/75">
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

          <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTool(
                    "calculator"
                  );
                  setExecution(null);
                  setError("");
                }}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  activeTool ===
                  "calculator"
                    ? "border-violet-300/18 bg-violet-400/[0.06]"
                    : "border-white/[0.07] bg-white/[0.018] hover:border-white/[0.11]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-violet-300/10 bg-violet-400/[0.05] text-violet-300/60">
                    <Calculator
                      size={19}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[14px] font-medium text-white/78">
                        Calculator
                      </h3>

                      <span
                        className={`h-2 w-2 rounded-full ${
                          discoveredToolNames.has(
                            "calculator"
                          )
                            ? "bg-emerald-300/65"
                            : "bg-white/15"
                        }`}
                      />
                    </div>

                    <p className="mt-1.5 text-[11px] leading-5 text-white/34">
                      Safe arithmetic without Python eval.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTool(
                    "date_time"
                  );
                  setExecution(null);
                  setError("");
                }}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  activeTool ===
                  "date_time"
                    ? "border-sky-300/18 bg-sky-400/[0.05]"
                    : "border-white/[0.07] bg-white/[0.018] hover:border-white/[0.11]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-sky-300/10 bg-sky-400/[0.045] text-sky-300/60">
                    <Clock3 size={19} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[14px] font-medium text-white/78">
                        Date & time
                      </h3>

                      <span
                        className={`h-2 w-2 rounded-full ${
                          discoveredToolNames.has(
                            "date_time"
                          )
                            ? "bg-emerald-300/65"
                            : "bg-white/15"
                        }`}
                      />
                    </div>

                    <p className="mt-1.5 text-[11px] leading-5 text-white/34">
                      Search countries and global IANA timezones.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTool(
                    "document_search"
                  );
                  setExecution(null);
                  setError("");
                }}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  activeTool ===
                  "document_search"
                    ? "border-emerald-300/16 bg-emerald-400/[0.04]"
                    : "border-white/[0.07] bg-white/[0.018] hover:border-white/[0.11]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-300/10 bg-emerald-400/[0.04] text-emerald-300/55">
                    <FileSearch size={19} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[14px] font-medium text-white/78">
                        Document search
                      </h3>

                      <span
                        className={`h-2 w-2 rounded-full ${
                          discoveredToolNames.has(
                            "document_search"
                          )
                            ? "bg-emerald-300/65"
                            : "bg-white/15"
                        }`}
                      />
                    </div>

                    <p className="mt-1.5 text-[11px] leading-5 text-white/34">
                      Hybrid semantic + lexical retrieval.
                    </p>
                  </div>
                </div>
              </button>
            </aside>

            <main className="min-w-0 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.026] to-white/[0.01] p-5">
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Wrench
                      size={14}
                      className="text-violet-300/50"
                    />

                    <span className="text-[9px] uppercase tracking-[0.12em] text-white/28">
                      Tool console
                    </span>
                  </div>

                  <h3 className="mt-2 text-[19px] font-medium text-white/84">
                    {activeTool ===
                    "calculator"
                      ? "Calculator"
                      : activeTool ===
                        "date_time"
                      ? "Date & time"
                      : "Document search"}
                  </h3>

                  <p className="mt-1.5 max-w-[650px] text-[12px] leading-5 text-white/34">
                    {currentDefinition?.description ??
                      "Execute a backend tool with validated arguments."}
                  </p>
                </div>

                {runningTool && (
                  <div className="flex items-center gap-2 rounded-lg border border-violet-300/10 bg-violet-400/[0.04] px-3 py-2 text-[10px] text-violet-200/60">
                    <LoaderCircle
                      size={13}
                      className="animate-spin"
                    />
                    Running
                  </div>
                )}
              </div>

              {activeTool ===
                "calculator" && (
                <form
                  onSubmit={
                    submitCalculator
                  }
                  className="mt-5"
                >
                  <label className="block">
                    <span className="mb-2 block text-[10px] uppercase tracking-[0.11em] text-white/30">
                      Expression
                    </span>

                    <input
                      value={expression}
                      onChange={(event) =>
                        setExpression(
                          event.target.value
                        )
                      }
                      placeholder="(25 * 4) + 17"
                      className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/10 px-4 font-mono text-[14px] text-white/72 outline-none placeholder:text-white/18 focus:border-violet-300/20"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={
                      runningTool !==
                        null ||
                      !expression.trim()
                    }
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-sky-300 px-5 text-[13px] font-semibold text-[#111018] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play size={13} />
                    Execute
                  </button>
                </form>
              )}

              {activeTool ===
                "date_time" && (
                <form
                  onSubmit={
                    submitDateTime
                  }
                  className="mt-5"
                >
                  <div
                    ref={timezoneBoxRef}
                    className="relative"
                  >
                    <label className="block">
                      <span className="mb-2 block text-[10px] uppercase tracking-[0.11em] text-white/30">
                        Country / timezone
                      </span>

                      <div className="relative">
                        <Search
                          size={14}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20"
                        />

                        <input
                          value={
                            timezoneInput
                          }
                          onFocus={() =>
                            setTimezoneOpen(
                              true
                            )
                          }
                          onChange={(event) => {
                            setTimezoneInput(
                              event.target.value
                            );
                            setTimezoneOpen(
                              true
                            );
                          }}
                          placeholder="Search India, Japan, London, New York..."
                          autoComplete="off"
                          className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/10 pl-10 pr-10 text-[13px] text-white/72 outline-none placeholder:text-white/18 focus:border-sky-300/20"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setTimezoneOpen(
                              (current) =>
                                !current
                            )
                          }
                          className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-white/25 hover:bg-white/[0.04] hover:text-white/50"
                        >
                          <ChevronDown
                            size={14}
                          />
                        </button>
                      </div>
                    </label>

                    {timezoneOpen && (
                      <div className="absolute z-50 mt-2 max-h-[260px] w-full overflow-y-auto rounded-xl border border-white/[0.09] bg-[#0d0f14] p-1.5 shadow-2xl shadow-black/50">
                        {filteredTimezones.length ===
                        0 ? (
                          <div className="px-3 py-4 text-[11px] text-white/28">
                            No matching timezone.
                            You can still enter a valid
                            IANA timezone manually.
                          </div>
                        ) : (
                          filteredTimezones.map(
                            (
                              option: TimezoneOption,
                              index: number
                            ) => (
                              <button
                                key={`${option.countryCode}-${option.timezone}-${index}`}
                                type="button"
                                onClick={() => {
                                  setSelectedTimezone(
                                    option.timezone
                                  );
                                  setTimezoneInput(
                                    optionLabel(
                                      option
                                    )
                                  );
                                  setTimezoneOpen(
                                    false
                                  );
                                  setError(
                                    ""
                                  );
                                }}
                                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/[0.045]"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-[12px] font-medium text-white/68">
                                    {
                                      option.country
                                    }
                                  </div>

                                  <div className="mt-0.5 truncate font-mono text-[10px] text-white/30">
                                    {
                                      option.timezone
                                    }
                                  </div>
                                </div>

                                <span className="shrink-0 text-[9px] uppercase tracking-[0.08em] text-white/20">
                                  {
                                    option.countryCode
                                  }
                                </span>
                              </button>
                            )
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 text-[11px] leading-5 text-white/28">
                    Search by country, region, city, country code,
                    or enter any valid IANA timezone manually.
                  </div>

                  <button
                    type="submit"
                    disabled={
                      runningTool !== null ||
                      !timezoneInput.trim()
                    }
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-sky-300 px-5 text-[13px] font-semibold text-[#111018] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play size={13} />
                    Execute
                  </button>
                </form>
              )}

              {activeTool ===
                "document_search" && (
                <form
                  onSubmit={
                    submitDocumentSearch
                  }
                  className="mt-5"
                >
                  <label className="block">
                    <span className="mb-2 block text-[10px] uppercase tracking-[0.11em] text-white/30">
                      Search query
                    </span>

                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20"
                      />

                      <input
                        value={
                          documentQuery
                        }
                        onChange={(event) =>
                          setDocumentQuery(
                            event.target.value
                          )
                        }
                        placeholder="Search indexed documents..."
                        className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/10 pl-10 pr-4 text-[13px] text-white/72 outline-none placeholder:text-white/18 focus:border-emerald-300/18"
                      />
                    </div>
                  </label>

                  <label className="mt-3 block max-w-[180px]">
                    <span className="mb-2 block text-[10px] uppercase tracking-[0.11em] text-white/30">
                      Result limit
                    </span>

                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={
                        documentLimit
                      }
                      onChange={(event) =>
                        setDocumentLimit(
                          Math.max(
                            1,
                            Math.min(
                              10,
                              Number(
                                event
                                  .target
                                  .value
                              ) || 1
                            )
                          )
                        )
                      }
                      className="h-10 w-full rounded-xl border border-white/[0.08] bg-black/10 px-4 text-[13px] text-white/68 outline-none focus:border-emerald-300/18"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={
                      runningTool !==
                        null ||
                      !documentQuery.trim()
                    }
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-sky-300 px-5 text-[13px] font-semibold text-[#111018] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play size={13} />
                    Execute
                  </button>
                </form>
              )}

              <div className="mt-5 border-t border-white/[0.05] pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-white/28">
                    Latest result
                  </span>

                  {execution && (
                    <span className="flex items-center gap-1.5 text-[10px] text-emerald-300/55">
                      <CheckCircle2
                        size={12}
                      />
                      {formatExecutionTime(
                        execution.executed_at
                      )}
                    </span>
                  )}
                </div>

                {!execution ? (
                  <div className="grid min-h-[130px] place-items-center rounded-xl border border-white/[0.05] bg-black/10 px-5 text-center">
                    <div>
                      <TerminalSquare
                        size={20}
                        className="mx-auto text-white/18"
                      />

                      <p className="mt-2 text-[11px] text-white/28">
                        Execute a tool to see its result here.
                      </p>
                    </div>
                  </div>
                ) : execution.tool ===
                    "calculator" &&
                  isCalculatorResult(
                    latestResult
                  ) ? (
                  <div className="rounded-xl border border-violet-300/12 bg-violet-400/[0.045] px-5 py-4">
                    <div className="text-[9px] uppercase tracking-[0.12em] text-white/28">
                      Result
                    </div>

                    <div className="mt-1.5 break-all text-[30px] font-semibold tracking-[-0.04em] text-white/92">
                      {String(
                        latestResult.result ??
                          ""
                      )}
                    </div>
                  </div>
                ) : execution.tool ===
                    "date_time" &&
                  isDateTimeResult(
                    latestResult
                  ) ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-sky-300/10 bg-sky-400/[0.04] p-4">
                      <div className="text-[9px] uppercase tracking-[0.12em] text-white/28">
                        Time
                      </div>

                      <div className="mt-1.5 text-[22px] font-semibold text-white/88">
                        {latestResult.time ??
                          "—"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-sky-300/10 bg-sky-400/[0.04] p-4">
                      <div className="text-[9px] uppercase tracking-[0.12em] text-white/28">
                        Date
                      </div>

                      <div className="mt-1.5 text-[16px] font-semibold text-white/88">
                        {latestResult.date ??
                          "—"}
                      </div>

                      <div className="mt-1 text-[11px] text-white/36">
                        {latestResult.weekday ??
                          ""}
                      </div>
                    </div>

                    <div className="rounded-xl border border-sky-300/10 bg-sky-400/[0.04] p-4">
                      <div className="text-[9px] uppercase tracking-[0.12em] text-white/28">
                        Timezone
                      </div>

                      <div className="mt-1.5 break-words text-[14px] font-semibold text-white/88">
                        {latestResult.timezone ??
                          "—"}
                      </div>
                    </div>
                  </div>
                ) : isDocumentSearchResult(
                    latestResult
                  ) ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-white/[0.06] bg-black/10 px-4 py-3">
                      <div className="text-[9px] uppercase tracking-[0.1em] text-white/24">
                        Query
                      </div>

                      <div className="mt-1.5 text-[12px] text-white/62">
                        {
                          latestResult.query
                        }
                      </div>
                    </div>

                    {latestResult.matches.map(
                      (match) => (
                        <article
                          key={
                            match.chunk_id
                          }
                          className="rounded-xl border border-white/[0.06] bg-black/10 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileSearch
                                size={14}
                                className="text-emerald-300/45"
                              />

                              <span className="text-[12px] font-medium text-white/60">
                                {
                                  match.filename
                                }
                              </span>

                              {match.page_number !==
                                null && (
                                <span className="text-[10px] text-white/28">
                                  page{" "}
                                  {
                                    match.page_number
                                  }
                                </span>
                              )}
                            </div>

                            <span className="rounded-md border border-violet-300/10 bg-violet-400/[0.04] px-2 py-1 text-[9px] text-violet-200/50">
                              score{" "}
                              {match.retrieval_score.toFixed(
                                4
                              )}
                            </span>
                          </div>

                          <p className="mt-2.5 line-clamp-4 text-[11px] leading-5 text-white/40">
                            {
                              match.content
                            }
                          </p>
                        </article>
                      )
                    )}
                  </div>
                ) : (
                  <pre className="max-h-[300px] overflow-auto rounded-xl border border-white/[0.06] bg-black/15 p-4 text-[11px] leading-5 text-white/46">
                    {JSON.stringify(
                      latestResult,
                      null,
                      2
                    )}
                  </pre>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </section>
  );
}
