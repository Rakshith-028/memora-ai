"use client";

import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  FormEvent,
  useState,
} from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/forgot-password",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email,
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
            : "Unable to request reset."
        );

        return;
      }

      setSuccess(true);
    } catch {
      setError(
        "Unable to connect to Memora."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07080b] text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-320px] h-[680px] w-[680px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[140px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/20 bg-violet-500/15 text-violet-200">
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

          <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] text-violet-300/70">
              {success ? (
                <CheckCircle2
                  size={23}
                />
              ) : (
                <Mail size={23} />
              )}
            </div>

            <div className="mt-6 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/55">
                Account recovery
              </div>

              <h1 className="mt-3 text-[28px] font-medium tracking-[-0.04em] text-white/92">
                {success
                  ? "Check your email"
                  : "Reset your password"}
              </h1>

              <p className="mt-3 text-[12px] leading-6 text-white/35">
                {success
                  ? "If an account exists for that email, Memora has sent a password reset link."
                  : "Enter your account email and we'll send you a secure reset link."}
              </p>
            </div>

            {!success && (
              <form
                onSubmit={handleSubmit}
                className="mt-7 space-y-4"
              >
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
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-xl border border-white/[0.09] bg-black/15 px-4 text-[12px] text-white outline-none placeholder:text-white/20 focus:border-violet-400/30"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 py-3 text-[10px] text-red-200/75">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-sky-300 text-[12px] font-semibold text-[#111018] transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading && (
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                  )}

                  {loading
                    ? "Sending..."
                    : "Send reset link"}
                </button>
              </form>
            )}

            <Link
              href="/login"
              className="mt-6 flex items-center justify-center gap-2 text-[10px] text-white/35 transition hover:text-white/65"
            >
              <ArrowLeft size={13} />
              Back to sign in
            </Link>

            <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/[0.06] pt-5 text-[9px] text-white/20">
              <ShieldCheck size={11} />
              Reset links expire after 30 minutes.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}