"use client";

import {
  ArrowUp,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  PanelRight,
  Paperclip,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wrench,
  X,
} from "lucide-react";
import {
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import type { SessionUser } from "./authenticated-dashboard";
import AnalyticsWorkspace from "./analytics-workspace";
import DocumentsWorkspace from "./documents-workspace";
import MemoryWorkspace from "./memory-workspace";
import SettingsWorkspace from "./settings-workspace";
import TasksWorkspace from "./tasks-workspace";
import ToolsWorkspace from "./tools-workspace";

type DashboardShellProps = {
  user: SessionUser;
};

type FeedbackRating =
  | "positive"
  | "negative";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback: FeedbackRating | null;
};

type FeedbackRecord = {
  message_id: string;
  rating: FeedbackRating;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type BackendMessage = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

const navigation = [
  {
    label: "Chats",
    icon: MessageSquareText,
    active: true,
  },
  {
    label: "Documents",
    icon: FileText,
  },
  {
    label: "Memory",
    icon: Brain,
  },
  {
    label: "Tools",
    icon: Wrench,
  },
  {
    label: "Tasks",
    icon: Clock3,
  },
  {
    label: "Analytics",
    icon: BarChart3,
  },
];

const suggestions = [
  {
    icon: Brain,
    title: "Use my memory",
    description:
      "Continue from what you already know about me.",
    prompt:
      "What do you remember about my preferences?",
  },
  {
    icon: FileText,
    title: "Ask my documents",
    description:
      "Search PDFs, notes, and scanned files with citations.",
    prompt:
      "What is the aim of experiment 1?",
  },
  {
    icon: Sparkles,
    title: "Plan something",
    description:
      "Break a goal into intelligent, actionable steps.",
    prompt:
      "Help me plan what I should work on next.",
  },
];

function makeMessageId() {
  return `${Date.now()}-${Math.random()}`;
}

export default function DashboardShell({
  user,
}: DashboardShellProps) {
  const router = useRouter();

  const chatThreadRef =
    useRef<HTMLDivElement | null>(null);

  const composerRef =
    useRef<HTMLTextAreaElement | null>(null);

  const [contextOpen, setContextOpen] =
    useState(true);

  const [activeView, setActiveView] =
    useState<
      "Chats" |
      "Documents" |
      "Memory" |
      "Tools" |
      "Tasks" |
      "Analytics" |
      "Settings"
    >("Chats");

  const [message, setMessage] =
    useState("");

  const [
    conversationId,
    setConversationId,
  ] = useState<string | null>(null);

  const [
    conversationTitle,
    setConversationTitle,
  ] = useState("New conversation");

  const [
    conversations,
    setConversations,
  ] = useState<Conversation[]>([]);

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [
    feedbackSavingIds,
    setFeedbackSavingIds,
  ] = useState<Set<string>>(
    new Set()
  );

  const [sending, setSending] =
    useState(false);

  const [
    loadingConversations,
    setLoadingConversations,
  ] = useState(true);

  const [
    loadingHistory,
    setLoadingHistory,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const displayName =
    user.display_name ||
    user.email.split("@")[0];

  const firstLetter =
    displayName
      .charAt(0)
      .toUpperCase();

  useEffect(() => {
    let active = true;

    async function loadConversations() {
      try {
        setLoadingConversations(true);

        const response = await fetch(
          "/api/conversations",
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
            "Unable to load conversations."
          );
        }

        if (active) {
          setConversations(
            Array.isArray(data)
              ? data
              : []
          );
        }
      } catch (caughtError) {
        console.error(
          "CONVERSATION LOAD ERROR:",
          caughtError
        );
      } finally {
        if (active) {
          setLoadingConversations(false);
        }
      }
    }

    void loadConversations();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const chatThread =
      chatThreadRef.current;

    if (!chatThread) {
      return;
    }

    const frame = requestAnimationFrame(
      () => {
        chatThread.scrollTo({
          top: chatThread.scrollHeight,
          behavior: sending
            ? "smooth"
            : "auto",
        });
      }
    );

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [messages, sending]);

  async function logout() {
    try {
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        }
      );
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  function startNewConversation() {
    if (sending) {
      return;
    }

    setActiveView("Chats");
    setConversationId(null);
    setConversationTitle(
      "New conversation"
    );
    setMessages([]);
    setFeedbackSavingIds(
      new Set()
    );
    setMessage("");
    setError("");
    setLoadingHistory(false);

    window.setTimeout(
      () => {
        composerRef.current?.focus();
      },
      0
    );
  }

  async function openConversation(
    conversation: Conversation
  ) {
    if (
      sending ||
      loadingHistory
    ) {
      return;
    }

    try {
      setError("");
      setLoadingHistory(true);
      setActiveView("Chats");

      setConversationId(
        conversation.id
      );

      setConversationTitle(
        conversation.title
      );

      setMessages([]);

      const response = await fetch(
        `/api/conversations/${conversation.id}/messages`,
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
          typeof data?.detail ===
            "string"
            ? data.detail
            : "Unable to open conversation."
        );
      }

      const backendMessages =
        (
          data as BackendMessage[]
        )
          .filter(
            (item) =>
              item.role === "user" ||
              item.role === "assistant"
          );

      const feedbackByMessageId =
        new Map<
          string,
          FeedbackRating
        >();

      try {
        const feedbackResponse =
          await fetch(
            `/api/feedback/conversation/${conversation.id}`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (
          feedbackResponse.status ===
          401
        ) {
          router.replace(
            "/login"
          );

          return;
        }

        if (
          feedbackResponse.ok
        ) {
          const feedbackData =
            await feedbackResponse.json();

          if (
            Array.isArray(
              feedbackData
            )
          ) {
            (
              feedbackData as
                FeedbackRecord[]
            ).forEach(
              (feedback) => {
                feedbackByMessageId.set(
                  feedback.message_id,
                  feedback.rating
                );
              }
            );
          }
        }
      } catch (feedbackError) {
        console.error(
          "FEEDBACK HISTORY LOAD ERROR:",
          feedbackError
        );
      }

      const restoredMessages =
        backendMessages.map(
          (item): ChatMessage => ({
            id: item.id,
            role:
              item.role as
                | "user"
                | "assistant",
            content: item.content,
            feedback:
              item.role ===
              "assistant"
                ? feedbackByMessageId.get(
                    item.id
                  ) ?? null
                : null,
          })
        );

      setMessages(
        restoredMessages
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to open conversation."
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  async function createConversation(
    firstMessage: string
  ) {
    const title =
      firstMessage.length > 55
        ? `${firstMessage.slice(
            0,
            55
          )}...`
        : firstMessage;

    const response = await fetch(
      "/api/conversations",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          title:
            title ||
            "New conversation",
        }),
      }
    );

    if (response.status === 401) {
      router.replace("/login");

      throw new Error(
        "Session expired."
      );
    }

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data?.detail ===
          "string"
          ? data.detail
          : "Unable to create conversation."
      );
    }

    const newConversation =
      data as Conversation;

    setConversations(
      (current) => [
        newConversation,
        ...current.filter(
          (item) =>
            item.id !==
            newConversation.id
        ),
      ]
    );

    setConversationTitle(
      newConversation.title
    );

    return newConversation.id;
  }

  async function sendMessage(
    suppliedMessage?: string
  ) {
    const content = (
      suppliedMessage ??
      message
    ).trim();

    if (
      !content ||
      sending ||
      loadingHistory
    ) {
      return;
    }

    setError("");
    setMessage("");

    const optimisticMessage: ChatMessage =
      {
        id: makeMessageId(),
        role: "user",
        content,
        feedback: null,
      };

    setMessages((current) => [
      ...current,
      optimisticMessage,
    ]);

    setSending(true);

    try {
      let activeConversationId =
        conversationId;

      if (!activeConversationId) {
        activeConversationId =
          await createConversation(
            content
          );

        setConversationId(
          activeConversationId
        );
      }

      const response = await fetch(
        "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            conversation_id:
              activeConversationId,
            message: content,
          }),
        }
      );

      if (response.status === 401) {
        router.replace("/login");

        throw new Error(
          "Session expired."
        );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.detail ===
            "string"
            ? data.detail
            : "Memora could not generate a response."
        );
      }

      const assistantMessage: ChatMessage =
        {
          id:
            data.assistant_message_id,
          role: "assistant",
          content:
            data.assistant_message,
          feedback: null,
        };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);

      setConversations(
        (current) => {
          const selected =
            current.find(
              (item) =>
                item.id ===
                activeConversationId
            );

          if (!selected) {
            return current;
          }

          return [
            selected,
            ...current.filter(
              (item) =>
                item.id !==
                activeConversationId
            ),
          ];
        }
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong."
      );
    } finally {
      setSending(false);
    }
  }

  function setFeedbackSaving(
    messageId: string,
    saving: boolean
  ) {
    setFeedbackSavingIds(
      (current) => {
        const next =
          new Set(current);

        if (saving) {
          next.add(
            messageId
          );
        } else {
          next.delete(
            messageId
          );
        }

        return next;
      }
    );
  }

  async function submitFeedback(
    messageId: string,
    rating: FeedbackRating
  ) {
    if (
      feedbackSavingIds.has(
        messageId
      )
    ) {
      return;
    }

    const targetMessage =
      messages.find(
        (item) =>
          item.id ===
          messageId
      );

    if (
      !targetMessage ||
      targetMessage.role !==
        "assistant"
    ) {
      return;
    }

    const previousRating =
      targetMessage.feedback;

    const nextRating =
      previousRating === rating
        ? null
        : rating;

    setError("");

    setMessages(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            messageId
              ? {
                  ...item,
                  feedback:
                    nextRating,
                }
              : item
        )
    );

    setFeedbackSaving(
      messageId,
      true
    );

    try {
      const response =
        await fetch(
          `/api/feedback/${messageId}`,
          nextRating
            ? {
                method: "PUT",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    rating:
                      nextRating,
                  }),
              }
            : {
                method:
                  "DELETE",
              }
        );

      if (
        response.status === 401
      ) {
        router.replace(
          "/login"
        );

        throw new Error(
          "Session expired."
        );
      }

      if (!response.ok) {
        let detail =
          "Unable to save feedback.";

        try {
          const data =
            await response.json();

          if (
            typeof data?.detail ===
            "string"
          ) {
            detail =
              data.detail;
          }
        } catch {
          // Keep the fallback message.
        }

        throw new Error(
          detail
        );
      }
    } catch (caughtError) {
      setMessages(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              messageId
                ? {
                    ...item,
                    feedback:
                      previousRating,
                  }
                : item
          )
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save feedback."
      );
    } finally {
      setFeedbackSaving(
        messageId,
        false
      );
    }
  }

  function handleComposerKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      void sendMessage();
    }
  }

  const hasConversation =
    messages.length > 0;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <aside className="sidebar">
        <div className="sidebar-top">
          <button
            className="brand"
            onClick={
              startNewConversation
            }
          >
            <span className="brand-mark">
              <Sparkles
                size={18}
                strokeWidth={2.2}
              />
            </span>

            <span className="brand-copy">
              <strong>Memora</strong>

              <small>
                Adaptive Intelligence
              </small>
            </span>
          </button>

          <button
            className="new-chat-button"
            onClick={
              startNewConversation
            }
          >
            <Plus size={17} />

            <span>
              New conversation
            </span>

            <kbd>âŒ˜ K</kbd>
          </button>

          <nav className="nav-list">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isInteractive =
                item.label === "Chats" ||
                item.label === "Documents" ||
                item.label === "Memory" ||
                item.label === "Tools" ||
                item.label === "Tasks" ||
                item.label === "Analytics";
              const isActive =
                activeView === item.label;

              return (
                <button
                  key={item.label}
                  className={`nav-item ${
                    isActive
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    if (item.label === "Chats") {
                      setActiveView("Chats");
                    }

                    if (item.label === "Documents") {
                      setActiveView("Documents");
                    }

                    if (item.label === "Memory") {
                      setActiveView("Memory");
                    }

                    if (item.label === "Tools") {
                      setActiveView("Tools");
                    }

                    if (item.label === "Tasks") {
                      setActiveView("Tasks");
                    }

                    if (item.label === "Analytics") {
                      setActiveView("Analytics");
                    }
                  }}
                  disabled={!isInteractive}
                  title={
                    isInteractive
                      ? item.label
                      : `${item.label} coming next`
                  }
                >
                  <Icon
                    size={18}
                    strokeWidth={1.9}
                  />

                  <span>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-middle">
          <div className="section-label">
            <span>Recent</span>

            <button
              aria-label="Search conversations"
            >
              <Search size={15} />
            </button>
          </div>

          <div className="recent-list">
            {loadingConversations ? (
              <div className="recent-loading">
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />

                <span>
                  Loading chats
                </span>
              </div>
            ) : conversations.length ===
              0 ? (
              <div className="recent-empty">
                No conversations yet
              </div>
            ) : (
              conversations
                .slice(0, 10)
                .map(
                  (conversation) => (
                    <button
                      key={
                        conversation.id
                      }
                      className={`recent-item ${
                        conversationId ===
                        conversation.id
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        void openConversation(
                          conversation
                        )
                      }
                    >
                      <span>
                        {
                          conversation.title
                        }
                      </span>

                      {conversationId ===
                      conversation.id ? (
                        <span className="active-chat-dot" />
                      ) : (
                        <MoreHorizontal
                          size={15}
                        />
                      )}
                    </button>
                  )
                )
            )}
          </div>
        </div>

        <div className="sidebar-bottom">
          <button
            className="settings-button"
            onClick={() =>
              setActiveView("Settings")
            }
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <button
            className="settings-button"
            onClick={logout}
          >
            <LogOut size={18} />
            <span>Log out</span>
          </button>

          <div className="profile">
            <div className="avatar">
              {firstLetter}
            </div>

            <div className="profile-copy">
              <strong>
                {displayName}
              </strong>

              <span>
                <span className="online-dot" />
                Memora online
              </span>
            </div>

            <ChevronDown size={16} />
          </div>
        </div>
      </aside>

      {activeView === "Documents" ? (
        <DocumentsWorkspace />
      ) : activeView === "Memory" ? (
        <MemoryWorkspace />
      ) : activeView === "Tools" ? (
        <ToolsWorkspace />
      ) : activeView === "Tasks" ? (
        <TasksWorkspace />
      ) : activeView === "Analytics" ? (
        <AnalyticsWorkspace />
      ) : activeView === "Settings" ? (
        <SettingsWorkspace />
      ) : (
      <section className="workspace">
        <header className="topbar">
          <div className="conversation-title">
            <div>
              <span className="eyebrow">
                Conversation
              </span>

              <h1>
                {conversationTitle}
              </h1>
            </div>

            <button className="model-switcher">
              <span className="model-status" />
              Memora Core
              <ChevronDown size={14} />
            </button>
          </div>

          <div className="topbar-actions">
            <button
              className="topbar-new-chat"
              onClick={
                startNewConversation
              }
              disabled={sending}
              title="Start a new chat"
            >
              <Plus size={15} />
              <span>New chat</span>
            </button>

            <div className="privacy-pill">
              <ShieldCheck size={15} />
              Private
            </div>

            <button
              className={`icon-button ${
                contextOpen
                  ? "selected"
                  : ""
              }`}
              onClick={() =>
                setContextOpen(
                  (current) =>
                    !current
                )
              }
              aria-label="Toggle context panel"
            >
              <PanelRight size={18} />
            </button>

            <button className="icon-button">
              <MoreHorizontal
                size={18}
              />
            </button>
          </div>
        </header>

        <div className="conversation-area">
          {loadingHistory ? (
            <div className="history-loading">
              <LoaderCircle
                size={22}
                className="animate-spin"
              />

              <span>
                Restoring conversation...
              </span>
            </div>
          ) : !hasConversation ? (
            <div className="hero-content">
              <div className="hero-symbol">
                <div className="hero-symbol-inner">
                  <Sparkles
                    size={26}
                    strokeWidth={1.8}
                  />
                </div>

                <span className="hero-orbit orbit-one" />
                <span className="hero-orbit orbit-two" />
              </div>

              <div className="hero-copy">
                <span className="hero-kicker">
                  Persistent intelligence
                </span>

                <h2>
                  What should we
                  <br />

                  <span>
                    remember and build?
                  </span>
                </h2>

                <p>
                  Memora understands your
                  context, recalls what
                  matters, searches your
                  documents, and brings the
                  right knowledge into every
                  conversation.
                </p>
              </div>

              <div className="suggestion-grid">
                {suggestions.map(
                  (suggestion) => {
                    const Icon =
                      suggestion.icon;

                    return (
                      <button
                        key={
                          suggestion.title
                        }
                        className="suggestion-card"
                        onClick={() =>
                          void sendMessage(
                            suggestion.prompt
                          )
                        }
                      >
                        <div className="suggestion-icon">
                          <Icon size={18} />
                        </div>

                        <div>
                          <strong>
                            {
                              suggestion.title
                            }
                          </strong>

                          <span>
                            {
                              suggestion.description
                            }
                          </span>
                        </div>

                        <ArrowUp
                          size={15}
                          className="suggestion-arrow"
                        />
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          ) : (
            <div
              className="chat-thread"
              ref={chatThreadRef}
            >
              <div className="chat-thread-inner">
                {messages.map(
                  (chatMessage) => {
                    const isAssistant =
                      chatMessage.role ===
                      "assistant";

                    const feedbackSaving =
                      feedbackSavingIds.has(
                        chatMessage.id
                      );

                    return (
                      <div
                        key={
                          chatMessage.id
                        }
                        className={`chat-message-row ${
                          chatMessage.role
                        }`}
                      >
                        {isAssistant && (
                          <div className="assistant-avatar">
                            <Sparkles
                              size={15}
                            />
                          </div>
                        )}

                        {isAssistant ? (
                          <div className="assistant-message-stack">
                            <div className="chat-bubble assistant">
                              <div className="whitespace-pre-wrap">
                                {
                                  chatMessage.content
                                }
                              </div>
                            </div>

                            <div
                              className="message-feedback-actions"
                              aria-label="Rate this response"
                            >
                              <button
                                type="button"
                                className={`feedback-button ${
                                  chatMessage.feedback ===
                                  "positive"
                                    ? "selected"
                                    : ""
                                }`}
                                aria-label="Helpful response"
                                aria-pressed={
                                  chatMessage.feedback ===
                                  "positive"
                                }
                                title="Helpful"
                                disabled={
                                  feedbackSaving
                                }
                                onClick={() =>
                                  void submitFeedback(
                                    chatMessage.id,
                                    "positive"
                                  )
                                }
                              >
                                <ThumbsUp
                                  size={14}
                                />
                              </button>

                              <button
                                type="button"
                                className={`feedback-button ${
                                  chatMessage.feedback ===
                                  "negative"
                                    ? "selected"
                                    : ""
                                }`}
                                aria-label="Unhelpful response"
                                aria-pressed={
                                  chatMessage.feedback ===
                                  "negative"
                                }
                                title="Not helpful"
                                disabled={
                                  feedbackSaving
                                }
                                onClick={() =>
                                  void submitFeedback(
                                    chatMessage.id,
                                    "negative"
                                  )
                                }
                              >
                                <ThumbsDown
                                  size={14}
                                />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="chat-bubble user">
                            <div className="whitespace-pre-wrap">
                              {
                                chatMessage.content
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}

                {sending && (
                  <div className="chat-message-row assistant">
                    <div className="assistant-avatar">
                      <Sparkles
                        size={15}
                      />
                    </div>

                    <div className="chat-bubble assistant typing-bubble">
                      <LoaderCircle
                        size={15}
                        className="animate-spin"
                      />

                      <span>
                        Memora is thinking
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="chat-error">
                    {error}
                  </div>
                )}

                <div
                  aria-hidden="true"
                  className="chat-thread-end"
                />
              </div>
            </div>
          )}

          <div className="composer-wrap">
            <div className="composer-glow" />

            <div className="composer">
              <textarea
                ref={composerRef}
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleComposerKeyDown
                }
                placeholder="Message Memora..."
                rows={1}
                disabled={
                  sending ||
                  loadingHistory
                }
              />

              <div className="composer-footer">
                <div className="composer-tools">
                  <button className="composer-tool">
                    <Plus size={17} />
                  </button>

                  <button className="composer-tool">
                    <Paperclip
                      size={17}
                    />
                  </button>

                  <button className="memory-enabled">
                    <Brain size={14} />
                    Memory on
                  </button>
                </div>

                <div className="composer-actions">
                  <button className="composer-tool">
                    <Mic size={17} />
                  </button>

                  <button
                    className={`send-button ${
                      message.trim()
                        ? "ready"
                        : ""
                    }`}
                    aria-label="Send message"
                    disabled={
                      sending ||
                      loadingHistory ||
                      !message.trim()
                    }
                    onClick={() =>
                      void sendMessage()
                    }
                  >
                    {sending ? (
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <ArrowUp
                        size={18}
                        strokeWidth={2.4}
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <p className="composer-note">
              Memora can make mistakes.
              Important information should
              be verified.
            </p>
          </div>
        </div>
      </section>
      )}



      {activeView === "Chats" && contextOpen && (
        <aside className="context-panel">
          <div className="context-header">
            <div>
              <span className="eyebrow">
                Live context
              </span>

              <h3>
                Intelligence layer
              </h3>
            </div>

            <button
              className="icon-button compact"
              onClick={() =>
                setContextOpen(false)
              }
            >
              <X size={17} />
            </button>
          </div>

          <div className="context-status">
            <span className="pulse-dot">
              <span />
            </span>

            <div>
              <strong>
                Context engine ready
              </strong>

              <p>
                Memory and document
                intelligence are available.
              </p>
            </div>
          </div>

          <div className="context-section">
            <div className="context-section-heading">
              <span>
                Persistent memory
              </span>

              <span className="context-count">
                Active
              </span>
            </div>

            <div className="memory-card">
              <div className="memory-card-top">
                <div className="mini-icon violet">
                  <Brain size={15} />
                </div>

                <span>
                  Memory engine
                </span>

                <CheckCircle2
                  size={14}
                />
              </div>

              <p>
                Relevant personal context
                can be recalled automatically
                when it improves the answer.
              </p>

              <div className="confidence-row">
                <span>Status</span>
                <strong>Ready</strong>
              </div>

              <div className="confidence-track">
                <span
                  style={{
                    width: "100%",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="context-section">
            <div className="context-section-heading">
              <span>
                Knowledge retrieval
              </span>

              <span className="context-count">
                RAG ready
              </span>
            </div>

            <div className="document-row">
              <div className="document-icon">
                <FileText size={16} />
              </div>

              <div>
                <strong>
                  Document intelligence
                </strong>

                <span>
                  PDF + OCR retrieval
                </span>
              </div>

              <span className="ready-dot" />
            </div>
          </div>

          <div className="context-section trace-section">
            <div className="context-section-heading">
              <span>
                Answer trace
              </span>

              <span className="context-count">
                {sending
                  ? "Processing"
                  : hasConversation
                    ? "Updated"
                    : "Idle"}
              </span>
            </div>

            <div className="trace-empty">
              <div className="trace-ring">
                {sending ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Sparkles
                    size={17}
                  />
                )}
              </div>

              <p>
                {hasConversation
                  ? "Memora processed persistent context and available knowledge for this conversation."
                  : "Ask something to activate memory and document intelligence."}
              </p>
            </div>
          </div>

          <div className="context-footer">
            <span>
              <ShieldCheck size={14} />
              Private workspace
            </span>

            <span>v0.1</span>
          </div>
        </aside>
      )}
    </main>
  );
}
