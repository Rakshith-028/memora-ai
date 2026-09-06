"use client";

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

export default function ResetPasswordPage() {
  const [token, setToken] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    setToken(
      params.get("token") ?? ""
    );
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!token) {
      setError(
        "Password reset token is missing."
      );

      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );

      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/reset-password",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              token,
              new_password:
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
            : "Unable to reset password."
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

            <span className="font-semibold">
              Memora
            </span>
          </div>

          <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-8">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] text-violet-300/70">
              {success ? (
                <CheckCircle2
                  size={23}
                />
              ) : (
                <LockKeyhole
                  size={23}
                />
              )}
            </div>

            <div className="mt-6 text-center">
              <h1 className="text-[28px] font-medium tracking-[-0.04em] text-white/92">
                {success
                  ? "Password updated"
                  : "Choose a new password"}
              </h1>

              <p className="mt-3 text-[12px] leading-6 text-white/35">
                {success
                  ? "Your Memora account is ready to use."
                  : "Use at least 8 characters for your new password."}
              </p>
            </div>

            {!success && (
              <form
                onSubmit={handleSubmit}
                className="mt-7 space-y-4"
              >
                <div>
                  <label className="mb-2 block text-[10px] text-white/40">
                    New password
                  </label>

                  <div className="relative">
                    <input
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
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      className="h-12 w-full rounded-xl border border-white/[0.09] bg-black/15 px-4 pr-12 text-[12px] text-white outline-none focus:border-violet-400/30"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) =>
                            !current
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30"
                    >
                      {showPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] text-white/40">
                    Confirm password
                  </label>

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    className="h-12 w-full rounded-xl border border-white/[0.09] bg-black/15 px-4 text-[12px] text-white outline-none focus:border-violet-400/30"
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
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-300 to-sky-300 text-[12px] font-semibold text-[#111018] transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading
                    ? "Updating password..."
                    : "Update password"}
                </button>
              </form>
            )}

            {success && (
              <Link
                href="/login"
                className="group mt-7 flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-sky-300 text-[12px] font-semibold text-[#111018]"
              >
                Sign in to Memora
                <ArrowRight size={15} />
              </Link>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}