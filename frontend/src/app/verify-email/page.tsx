"use client";

import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";

type VerificationState =
  | "waiting"
  | "verifying"
  | "success"
  | "error";

export default function VerifyEmailPage() {
  const verificationStartedRef =
    useRef(false);

  const [
    verificationState,
    setVerificationState,
  ] = useState<VerificationState>(
    "waiting"
  );

  const [message, setMessage] =
    useState(
      "Check your inbox for the Memora verification link."
    );

  const [email, setEmail] =
    useState("");

  const [resending, setResending] =
    useState(false);

  const [
    resendMessage,
    setResendMessage,
  ] = useState("");

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const token =
      params.get("token");

    const emailParam =
      params.get("email");

    if (emailParam) {
      setEmail(emailParam);
    }

    if (!token) {
      return;
    }

    if (
      verificationStartedRef.current
    ) {
      return;
    }

    verificationStartedRef.current =
      true;

    async function verify() {
      setVerificationState(
        "verifying"
      );

      setMessage(
        "Verifying your email address..."
      );

      try {
        const response =
          await fetch(
            "/api/auth/verify-email",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                token,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setVerificationState(
            "error"
          );

          setMessage(
            typeof data?.detail ===
              "string"
              ? data.detail
              : "Unable to verify email."
          );

          return;
        }

        setVerificationState(
          "success"
        );

        setMessage(
          "Your email has been verified successfully."
        );
      } catch {
        setVerificationState(
          "error"
        );

        setMessage(
          "Unable to connect to Memora."
        );
      }
    }

    void verify();
  }, []);

  async function resendVerification() {
    if (
      !email.trim() ||
      resending
    ) {
      return;
    }

    setResending(true);
    setResendMessage("");

    try {
      const response =
        await fetch(
          "/api/auth/resend-verification",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email: email.trim(),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setResendMessage(
          typeof data?.detail ===
            "string"
            ? data.detail
            : "Unable to resend verification email."
        );

        return;
      }

      setResendMessage(
        typeof data?.message ===
          "string"
          ? data.message
          : "Verification email sent."
      );
    } catch {
      setResendMessage(
        "Unable to connect to Memora."
      );
    } finally {
      setResending(false);
    }
  }

  const StateIcon =
    verificationState === "success"
      ? CheckCircle2
      : verificationState === "error"
        ? XCircle
        : verificationState ===
            "verifying"
          ? LoaderCircle
          : Mail;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07080b] text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-320px] h-[680px] w-[680px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[140px]" />

      <div className="pointer-events-none absolute bottom-[-260px] right-[-170px] h-[520px] w-[520px] rounded-full bg-blue-500/5 blur-[120px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-400/30 to-violet-700/20 text-violet-200">
              <Sparkles size={19} />
            </div>

            <div>
              <div className="text-[15px] font-semibold">
                Memora
              </div>

              <div className="text-[9px] uppercase tracking-[0.12em] text-white/25">
                Adaptive Intelligence
              </div>
            </div>
          </div>

          <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-7 shadow-2xl shadow-black/20 sm:p-9">
            <div
              className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl border ${
                verificationState ===
                "success"
                  ? "border-emerald-300/15 bg-emerald-400/[0.06] text-emerald-300/70"
                  : verificationState ===
                      "error"
                    ? "border-red-300/15 bg-red-400/[0.06] text-red-300/70"
                    : "border-violet-300/15 bg-violet-400/[0.06] text-violet-300/70"
              }`}
            >
              <StateIcon
                size={23}
                className={
                  verificationState ===
                  "verifying"
                    ? "animate-spin"
                    : ""
                }
              />
            </div>

            <div className="mt-6 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/55">
                Secure account
              </div>

              <h1 className="mt-3 text-[28px] font-medium tracking-[-0.04em] text-white/92">
                {verificationState ===
                "success"
                  ? "Email verified"
                  : verificationState ===
                      "verifying"
                    ? "Verifying email"
                    : verificationState ===
                        "error"
                      ? "Verification failed"
                      : "Verify your email"}
              </h1>

              <p className="mt-3 text-[12px] leading-6 text-white/35">
                {message}
              </p>
            </div>

            {verificationState ===
              "waiting" && (
              <div className="mt-7 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-[10px] font-medium text-white/40"
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
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-xl border border-white/[0.09] bg-black/15 px-4 text-[12px] text-white outline-none placeholder:text-white/20 focus:border-violet-400/30"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void resendVerification()
                  }
                  disabled={
                    resending ||
                    !email.trim()
                  }
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-300/15 bg-violet-400/[0.07] text-[11px] font-medium text-violet-100/75 transition hover:bg-violet-400/[0.11] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {resending ? (
                    <LoaderCircle
                      size={14}
                      className="animate-spin"
                    />
                  ) : (
                    <RefreshCw
                      size={14}
                    />
                  )}

                  Resend verification
                </button>

                {resendMessage && (
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[10px] leading-5 text-white/45">
                    {resendMessage}
                  </div>
                )}
              </div>
            )}

            {verificationState ===
              "success" && (
              <Link
                href="/login"
                className="group mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-sky-300 text-[12px] font-semibold text-[#111018] transition hover:brightness-110"
              >
                Continue to sign in

                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            )}

            {verificationState ===
              "error" && (
              <div className="mt-7 space-y-3">
                <Link
                  href="/login"
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-[11px] font-medium text-white/55 transition hover:bg-white/[0.04]"
                >
                  Back to sign in
                </Link>
              </div>
            )}

            <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/[0.06] pt-5 text-[9px] text-white/20">
              <ShieldCheck size={11} />
              Verification links expire automatically.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
