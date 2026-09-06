"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed";

type TaskPriority =
  | "low"
  | "medium"
  | "high";

type TaskItem = {
  id: string;
  user_id: string;
  source_conversation_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

type TaskFormState = {
  title: string;
  description: string;
  priority: TaskPriority;
  due_at: string;
};

const initialForm: TaskFormState = {
  title: "",
  description: "",
  priority: "medium",
  due_at: "",
};

const statusLabel: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

const priorityLabel: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function formatDueDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function taskStatusIcon(status: TaskStatus) {
  if (status === "completed") {
    return CheckCircle2;
  }

  if (status === "in_progress") {
    return Clock3;
  }

  return CircleDashed;
}

export default function TasksWorkspace() {
  const router = useRouter();

  const [tasks, setTasks] =
    useState<TaskItem[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [creating, setCreating] =
    useState(false);
  const [savingTaskIds, setSavingTaskIds] =
    useState<Set<string>>(new Set());
  const [error, setError] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] =
    useState<"all" | TaskPriority>("all");

  const [form, setForm] =
    useState<TaskFormState>(initialForm);

  const loadTasks = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const params =
          new URLSearchParams();

        if (statusFilter !== "all") {
          params.set(
            "status",
            statusFilter
          );
        }

        if (priorityFilter !== "all") {
          params.set(
            "priority",
            priorityFilter
          );
        }

        const response = await fetch(
          `/api/tasks${
            params.toString()
              ? `?${params.toString()}`
              : ""
          }`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data?.detail === "string"
              ? data.detail
              : "Unable to load tasks."
          );
        }

        setTasks(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load tasks."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      priorityFilter,
      router,
      statusFilter,
    ]
  );

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  function setTaskSaving(
    taskId: string,
    saving: boolean
  ) {
    setSavingTaskIds((current) => {
      const next =
        new Set(current);

      if (saving) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }

      return next;
    });
  }

  async function createTask(
    event: FormEvent
  ) {
    event.preventDefault();

    const title =
      form.title.trim();

    if (!title || creating) {
      return;
    }

    try {
      setCreating(true);
      setError("");

      const dueAt =
        form.due_at
          ? new Date(
              form.due_at
            ).toISOString()
          : null;

      const response = await fetch(
        "/api/tasks",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title,
            description:
              form.description.trim() ||
              null,
            status: "pending",
            priority:
              form.priority,
            due_at: dueAt,
            source_conversation_id:
              null,
          }),
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to create task."
        );
      }

      setForm(initialForm);

      await loadTasks(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create task."
      );
    } finally {
      setCreating(false);
    }
  }

  async function updateTaskStatus(
    task: TaskItem,
    nextStatus: TaskStatus
  ) {
    if (
      task.status === nextStatus ||
      savingTaskIds.has(task.id)
    ) {
      return;
    }

    const previous =
      task.status;

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: nextStatus,
            }
          : item
      )
    );

    setTaskSaving(task.id, true);

    try {
      const response = await fetch(
        `/api/tasks/${task.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to update task."
        );
      }

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? (data as TaskItem)
            : item
        )
      );
    } catch (caughtError) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: previous,
              }
            : item
        )
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update task."
      );
    } finally {
      setTaskSaving(task.id, false);
    }
  }

  async function deleteTask(
    taskId: string
  ) {
    if (savingTaskIds.has(taskId)) {
      return;
    }

    const previous =
      tasks;

    setTasks((current) =>
      current.filter(
        (item) =>
          item.id !== taskId
      )
    );

    setTaskSaving(taskId, true);

    try {
      const response = await fetch(
        `/api/tasks/${taskId}`,
        {
          method: "DELETE",
        }
      );

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        let detail =
          "Unable to delete task.";

        try {
          const data =
            await response.json();

          if (
            typeof data?.detail === "string"
          ) {
            detail = data.detail;
          }
        } catch {
          // Keep fallback.
        }

        throw new Error(detail);
      }
    } catch (caughtError) {
      setTasks(previous);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete task."
      );
    } finally {
      setTaskSaving(taskId, false);
    }
  }

  const stats =
    useMemo(
      () => ({
        total: tasks.length,
        pending: tasks.filter(
          (task) =>
            task.status === "pending"
        ).length,
        inProgress: tasks.filter(
          (task) =>
            task.status === "in_progress"
        ).length,
        completed: tasks.filter(
          (task) =>
            task.status === "completed"
        ).length,
      }),
      [tasks]
    );

  return (
    <section className="workspace min-w-0">
      <header className="topbar">
        <div className="conversation-title">
          <div>
            <span className="eyebrow">
              Execution layer
            </span>

            <h1>Tasks</h1>
          </div>

          <div className="ml-2 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/42">
            <Sparkles
              size={14}
              className="text-violet-300/65"
            />
            Persistent action queue
          </div>
        </div>

        <div className="topbar-actions">
          <div className="privacy-pill">
            <ShieldCheck size={15} />
            Private workspace
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1160px] px-6 py-7 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/60">
                <Clock3 size={13} />
                Real task data
              </div>

              <h2 className="text-[34px] font-medium leading-[1.1] tracking-[-0.045em] text-white/95">
                Turn intent into
                <span className="bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">
                  {" "}
                  execution.
                </span>
              </h2>

              <p className="mt-3 max-w-[720px] text-[13px] leading-6 text-white/38">
                Create, prioritize, track, and complete work in one persistent Memora queue.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadTasks(true)
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

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total",
                value: stats.total,
              },
              {
                label: "Pending",
                value: stats.pending,
              },
              {
                label: "In progress",
                value: stats.inProgress,
              },
              {
                label: "Completed",
                value: stats.completed,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.018] px-5 py-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/27">
                  {item.label}
                </div>

                <div className="mt-2 text-[27px] font-medium tracking-[-0.05em] text-white/82">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[370px_minmax(0,1fr)]">
            <form
              onSubmit={createTask}
              className="h-fit rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-violet-300/10 bg-violet-400/[0.045] text-violet-300/65">
                  <Plus size={16} />
                </div>

                <div>
                  <h3 className="text-[15px] font-medium text-white/82">
                    New task
                  </h3>

                  <p className="mt-0.5 text-[10px] text-white/29">
                    Stored in your account.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-white/27">
                    Title
                  </span>

                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title:
                          event.target.value,
                      }))
                    }
                    placeholder="What needs to get done?"
                    maxLength={255}
                    className="h-11 w-full rounded-xl border border-white/[0.07] bg-black/15 px-3.5 text-[12px] text-white/78 outline-none transition placeholder:text-white/19 focus:border-violet-300/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-white/27">
                    Description
                  </span>

                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }))
                    }
                    placeholder="Optional context or next action..."
                    rows={4}
                    maxLength={5000}
                    className="w-full resize-none rounded-xl border border-white/[0.07] bg-black/15 px-3.5 py-3 text-[12px] leading-5 text-white/72 outline-none transition placeholder:text-white/19 focus:border-violet-300/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-white/27">
                    Priority
                  </span>

                  <div className="relative">
                    <select
                      value={form.priority}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          priority:
                            event.target.value as TaskPriority,
                        }))
                      }
                      className="h-11 w-full appearance-none rounded-xl border border-white/[0.07] bg-[#0d0d12] px-3.5 pr-9 text-[12px] text-white/65 outline-none transition focus:border-violet-300/20"
                    >
                      <option value="low">
                        Low
                      </option>
                      <option value="medium">
                        Medium
                      </option>
                      <option value="high">
                        High
                      </option>
                    </select>

                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/28"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-white/27">
                    Due date
                  </span>

                  <input
                    type="datetime-local"
                    value={form.due_at}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        due_at:
                          event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-white/[0.07] bg-[#0d0d12] px-3.5 text-[11px] text-white/60 outline-none transition focus:border-violet-300/20"
                  />
                </label>

                <button
                  type="submit"
                  disabled={
                    creating ||
                    !form.title.trim()
                  }
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-300/15 bg-violet-400/[0.09] text-[11px] font-semibold text-violet-100/80 transition hover:bg-violet-400/[0.13] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {creating ? (
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={15} />
                  )}
                  Create task
                </button>
              </div>
            </form>

            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as
                          | "all"
                          | TaskStatus
                      )
                    }
                    className="h-9 appearance-none rounded-xl border border-white/[0.07] bg-[#0d0d12] pl-3 pr-8 text-[10px] font-medium text-white/52 outline-none"
                  >
                    <option value="all">
                      All statuses
                    </option>
                    <option value="pending">
                      Pending
                    </option>
                    <option value="in_progress">
                      In progress
                    </option>
                    <option value="completed">
                      Completed
                    </option>
                  </select>

                  <ChevronDown
                    size={13}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25"
                  />
                </div>

                <div className="relative">
                  <select
                    value={priorityFilter}
                    onChange={(event) =>
                      setPriorityFilter(
                        event.target.value as
                          | "all"
                          | TaskPriority
                      )
                    }
                    className="h-9 appearance-none rounded-xl border border-white/[0.07] bg-[#0d0d12] pl-3 pr-8 text-[10px] font-medium text-white/52 outline-none"
                  >
                    <option value="all">
                      All priorities
                    </option>
                    <option value="high">
                      High
                    </option>
                    <option value="medium">
                      Medium
                    </option>
                    <option value="low">
                      Low
                    </option>
                  </select>

                  <ChevronDown
                    size={13}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25"
                  />
                </div>
              </div>

              {loading ? (
                <div className="grid min-h-[360px] place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.015]">
                  <div className="flex items-center gap-3 text-[12px] text-white/35">
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                    Loading tasks...
                  </div>
                </div>
              ) : tasks.length === 0 ? (
                <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.012] p-8">
                  <div className="max-w-sm text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-violet-300/10 bg-violet-400/[0.035] text-violet-300/45">
                      <CheckCircle2
                        size={20}
                      />
                    </div>

                    <h3 className="mt-4 text-[15px] font-medium text-white/72">
                      No tasks here
                    </h3>

                    <p className="mt-2 text-[11px] leading-5 text-white/29">
                      Create a task or change the filters to see another part of your queue.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const StatusIcon =
                      taskStatusIcon(
                        task.status
                      );

                    const saving =
                      savingTaskIds.has(
                        task.id
                      );

                    return (
                      <article
                        key={task.id}
                        className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5 transition hover:border-violet-300/12 hover:bg-white/[0.024]"
                      >
                        <div className="flex items-start gap-4">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-300/10 bg-violet-400/[0.04] text-violet-300/55">
                            <StatusIcon
                              size={17}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-[14px] font-medium text-white/82">
                                  {task.title}
                                </h3>

                                {task.description && (
                                  <p className="mt-1.5 text-[11px] leading-5 text-white/32">
                                    {
                                      task.description
                                    }
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                aria-label="Delete task"
                                title="Delete task"
                                disabled={saving}
                                onClick={() =>
                                  void deleteTask(
                                    task.id
                                  )
                                }
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-transparent text-white/23 transition hover:border-rose-300/10 hover:bg-rose-300/[0.04] hover:text-rose-200/60 disabled:cursor-wait disabled:opacity-40"
                              >
                                {saving ? (
                                  <LoaderCircle
                                    size={13}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2
                                    size={13}
                                  />
                                )}
                              </button>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <div className="relative">
                                <select
                                  value={task.status}
                                  disabled={saving}
                                  onChange={(event) =>
                                    void updateTaskStatus(
                                      task,
                                      event.target.value as TaskStatus
                                    )
                                  }
                                  className="h-8 appearance-none rounded-lg border border-white/[0.06] bg-[#0d0d12] pl-3 pr-8 text-[9px] font-medium text-white/52 outline-none disabled:cursor-wait disabled:opacity-45"
                                >
                                  <option value="pending">
                                    Pending
                                  </option>
                                  <option value="in_progress">
                                    In progress
                                  </option>
                                  <option value="completed">
                                    Completed
                                  </option>
                                </select>

                                <ChevronDown
                                  size={12}
                                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/24"
                                />
                              </div>

                              <span className="rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.09em] text-white/34">
                                {
                                  priorityLabel[
                                    task.priority
                                  ]
                                }{" "}
                                priority
                              </span>

                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/10 px-2.5 py-1.5 text-[9px] text-white/31">
                                <CalendarDays
                                  size={11}
                                />
                                {formatDueDate(
                                  task.due_at
                                )}
                              </span>

                              <span className="ml-auto text-[9px] text-white/19">
                                {
                                  statusLabel[
                                    task.status
                                  ]
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
