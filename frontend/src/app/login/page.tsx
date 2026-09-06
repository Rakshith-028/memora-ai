"use client";

import {
  ArrowRight,
  Brain,
  Eye,
  EyeOff,
  FileSearch,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccounts = {
  id: {
    initialize: (options: {
      client_id: string;
      callback: (
        response: GoogleCredentialResponse
      ) => void;
    }) => void;

    renderButton: (
      element: HTMLElement,
      options: {
        theme: "outline";
        size: "large";
        width: number;
        text: "continue_with";
        shape: "rectangular";
      }
    ) => void;
  };
};

declare global {
  interface Window {
    google?: {
      accounts: GoogleAccounts;
    };
  }
}

const GOOGLE_CLIENT_ID =
  process.env
    .NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
  "";

export default function LoginPage() {
  const router = useRouter();

  const googleButtonRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    googleReady,
    setGoogleReady,
  ] = useState(false);

  const [
    googleLoading,
    setGoogleLoading,
  ] = useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleGoogleCredential =
    useCallback(
      async (
        response: GoogleCredentialResponse
      ) => {
        const credential =
          response.credential;

        if (!credential) {
          setError(
            "Google did not return a valid credential."
          );

          return;
        }

        setGoogleLoading(true);
        setError("");

        try {
          const authResponse =
            await fetch(
              "/api/auth/google",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  credential,
                }),
              }
            );

          const data =
            await authResponse.json();

          if (!authResponse.ok) {
            setError(
              typeof data?.detail ===
                "string"
                ? data.detail
                : "Unable to sign in with Google."
            );

            return;
          }

          router.push("/");
          router.refresh();
        } catch {
          setError(
            "Unable to connect to Memora."
          );
        } finally {
          setGoogleLoading(false);
        }
      },
      [router]
    );

  useEffect(() => {
    if (
      !googleReady ||
      !GOOGLE_CLIENT_ID ||
      !googleButtonRef.current ||
      !window.google
    ) {
      return;
    }

    const container =
      googleButtonRef.current;

    container.innerHTML = "";

    window.google.accounts.id.initialize(
      {
        client_id:
          GOOGLE_CLIENT_ID,
        callback: (
          response
        ) => {
          void handleGoogleCredential(
            response
          );
        },
      }
    );

    window.google.accounts.id.renderButton(
      container,
      {
        theme: "outline",
        size: "large",
        width: 390,
        text: "continue_with",
        shape: "rectangular",
      }
    );
  }, [
    googleReady,
    handleGoogleCredential,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          typeof data?.detail ===
            "string"
            ? data.detail
            : "Unable to sign in."
        );

        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError(
        "Unable to connect to Memora."
      );
    } finally {
      setLoading(false);
    }
  }

  const requiresVerification =
    error.toLowerCase().includes(
      "email verification"
    );

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() =>
          setGoogleReady(true)
        }
      />

      <main className="relative min-h-screen overflow-hidden bg-[#07080b] text-white">
        <div className="pointer-events-none absolute left-1/2 top-[-380px] h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[140px]" />

        <div className="pointer-events-none absolute bottom-[-260px] right-[-170px] h-[520px] w-[520px] rounded-full bg-blue-500/5 blur-[120px]" />

        <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
          <section className="hidden border-r border-white/[0.07] p-12 lg:flex lg:flex-col">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-400/30 to-violet-700/20 text-violet-200 shadow-2xl shadow-violet-900/20">
                <Sparkles size={19} />
              </div>

              <div>
                <div className="text-[15px] font-semibold tracking-[-0.02em]">
                  Memora
                </div>

                <div className="mt-0.5 text-[10px] tracking-[0.08em] text-white/30">
                  ADAPTIVE INTELLIGENCE
                </div>
              </div>
            </div>

            <div className="my-auto max-w-[620px]">
              <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/70">
                Persistent intelligence
              </div>

              <h1 className="max-w-[600px] text-[54px] font-medium leading-[1.02] tracking-[-0.055em] text-white/95">
                An AI that carries
                <span className="block bg-gradient-to-r from-violet-200 via-violet-400 to-sky-300 bg-clip-text text-transparent">
                  context forward.
                </span>
              </h1>

              <p className="mt-7 max-w-[520px] text-[14px] leading-7 text-white/40">
                Memora combines persistent memory,
                document intelligence, and contextual
                retrieval to create conversations that
                become more useful over time.
              </p>

              <div className="mt-12 grid max-w-[540px] grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <Brain
                    size={18}
                    className="text-violet-300/70"
                  />

                  <div className="mt-6 text-[12px] font-medium text-white/75">
                    Persistent memory
                  </div>

                  <div className="mt-2 text-[10px] leading-5 text-white/30">
                    Context that evolves with you.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <FileSearch
                    size={18}
                    className="text-sky-300/70"
                  />

                  <div className="mt-6 text-[12px] font-medium text-white/75">
                    Document RAG
                  </div>

                  <div className="mt-2 text-[10px] leading-5 text-white/30">
                    Search PDFs and OCR sources.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <LockKeyhole
                    size={18}
                    className="text-emerald-300/70"
                  />

                  <div className="mt-6 text-[12px] font-medium text-white/75">
                    Private context
                  </div>

                  <div className="mt-2 text-[10px] leading-5 text-white/30">
                    User-isolated intelligence.
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-white/20">
              Memora AI · Adaptive AI Agent with
              Persistent Memory and Tool Intelligence
            </div>
          </section>

          <section className="flex min-h-screen items-center justify-center px-6 py-12">
            <div className="w-full max-w-[390px]">
              <div className="mb-10 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/20 bg-violet-500/20 text-violet-200">
                    <Sparkles size={19} />
                  </div>

                  <span className="font-semibold">
                    Memora
                  </span>
                </div>
              </div>

              <div className="mb-9">
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/60">
                  Secure workspace
                </div>

                <h2 className="text-[31px] font-medium tracking-[-0.04em] text-white/95">
                  Welcome back
                </h2>

                <p className="mt-3 text-[12px] leading-6 text-white/35">
                  Sign in to continue your Memora
                  workspace.
                </p>
              </div>

              <div className="mb-5">
                {GOOGLE_CLIENT_ID ? (
                  <div className="relative min-h-[44px] overflow-hidden rounded-xl">
                    <div
                      ref={googleButtonRef}
                      className={
                        googleLoading
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-300/10 bg-amber-300/[0.035] px-4 py-3 text-[10px] leading-5 text-amber-100/55">
                    Google Sign-In is not configured.
                  </div>
                )}

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.07]" />

                  <span className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                    or continue with email
                  </span>

                  <div className="h-px flex-1 bg-white/[0.07]" />
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-[10px] font-medium text-white/45"
                  >
                    Email address
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-[12px] text-white outline-none transition placeholder:text-white/20 focus:border-violet-400/35 focus:bg-white/[0.035] focus:ring-2 focus:ring-violet-400/[0.06]"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="password"
                      className="block text-[10px] font-medium text-white/45"
                    >
                      Password
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-[10px] font-medium text-violet-300/60 transition hover:text-violet-200"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <input
                      id="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 pr-12 text-[12px] text-white outline-none transition placeholder:text-white/20 focus:border-violet-400/35 focus:bg-white/[0.035] focus:ring-2 focus:ring-violet-400/[0.06]"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) =>
                            !current
                        )
                      }
                      className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/25 transition hover:bg-white/[0.04] hover:text-white/55"
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-400/15 bg-red-400/[0.055] px-4 py-3 text-[10px] leading-5 text-red-200/75">
                    <div>{error}</div>

                    {requiresVerification && (
                      <Link
                        href={`/verify-email?email=${encodeURIComponent(
                          email
                        )}`}
                        className="mt-2 inline-flex font-medium text-violet-200/80 transition hover:text-violet-100"
                      >
                        Resend verification email →
                      </Link>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    loading ||
                    googleLoading
                  }
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 via-violet-300 to-sky-300 text-[12px] font-semibold text-[#111018] shadow-xl shadow-violet-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Signing in..."
                    : "Enter Memora"}

                  {!loading && (
                    <ArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-[11px] text-white/30">
                New to Memora?{" "}

                <Link
                  href="/signup"
                  className="font-medium text-violet-300/70 transition hover:text-violet-200"
                >
                  Create account
                </Link>
              </div>

              <div className="mt-7 flex items-center justify-center gap-2 text-[9px] text-white/20">
                <LockKeyhole size={11} />
                Authentication is handled through
                Memora&apos;s secure session layer.
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}