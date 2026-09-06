"use client";

import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type AccountSettings = {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  has_password: boolean;
  google_connected: boolean;
  created_at: string;
};

export default function SettingsWorkspace() {
  const router = useRouter();

  const [account, setAccount] =
    useState<AccountSettings | null>(
      null
    );

  const [displayName, setDisplayName] =
    useState("");

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPasswords,
    setShowPasswords,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [
    savingProfile,
    setSavingProfile,
  ] = useState(false);

  const [
    savingPassword,
    setSavingPassword,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            "/api/settings/account",
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
              : "Unable to load settings."
          );
        }

        if (!active) {
          return;
        }

        const nextAccount =
          data as AccountSettings;

        setAccount(
          nextAccount
        );

        setDisplayName(
          nextAccount.display_name ??
            ""
        );
      } catch (caughtError) {
        if (!active) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load settings."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      active = false;
    };
  }, [router]);

  async function saveProfile(
    event: FormEvent
  ) {
    event.preventDefault();

    if (savingProfile) {
      return;
    }

    try {
      setSavingProfile(true);
      setError("");
      setSuccess("");

      const response =
        await fetch(
          "/api/settings/account",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              display_name:
                displayName.trim() ||
                null,
            }),
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
            : "Unable to save profile."
        );
      }

      const nextAccount =
        data as AccountSettings;

      setAccount(
        nextAccount
      );

      setDisplayName(
        nextAccount.display_name ??
          ""
      );

      setSuccess(
        "Profile updated successfully."
      );

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(
    event: FormEvent
  ) {
    event.preventDefault();

    if (
      savingPassword ||
      !account
    ) {
      return;
    }

    setError("");
    setSuccess("");

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        "New passwords do not match."
      );
      return;
    }

    if (
      newPassword.length < 8
    ) {
      setError(
        "New password must be at least 8 characters."
      );
      return;
    }

    try {
      setSavingPassword(true);

      const response =
        await fetch(
          "/api/settings/password",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              current_password:
                account.has_password
                  ? currentPassword
                  : null,
              new_password:
                newPassword,
            }),
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
            : "Unable to update password."
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setAccount(
        (current) =>
          current
            ? {
                ...current,
                has_password: true,
              }
            : current
      );

      setSuccess(
        account.has_password
          ? "Password updated successfully."
          : "Password created successfully."
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update password."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  function formatCreatedAt(
    value: string
  ) {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "Unknown";
    }

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    ).format(date);
  }

  return (
    <section className="workspace min-w-0">
      <header className="topbar">
        <div className="conversation-title">
          <div>
            <span className="eyebrow">
              Account control
            </span>

            <h1>Settings</h1>
          </div>

          <div className="ml-2 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[10px] text-white/42">
            <Sparkles
              size={14}
              className="text-violet-300/65"
            />
            Memora account
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
        <div className="mx-auto w-full max-w-[1080px] px-6 py-7 lg:px-8">
          <div className="mb-6">
            <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/60">
              <ShieldCheck size={13} />
              Account & security
            </div>

            <h2 className="text-[34px] font-medium leading-[1.1] tracking-[-0.045em] text-white/95">
              Control your
              <span className="bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">
                {" "}
                Memora identity.
              </span>
            </h2>

            <p className="mt-3 max-w-[680px] text-[13px] leading-6 text-white/38">
              Manage your profile, sign-in methods, and account security from one place.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-400/15 bg-red-400/[0.045] px-4 py-3 text-[11px] leading-5 text-red-200/75">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.045] px-4 py-3 text-[11px] text-emerald-200/70">
              <CheckCircle2
                size={14}
              />
              {success}
            </div>
          )}

          {loading ? (
            <div className="grid min-h-[360px] place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.015]">
              <div className="flex items-center gap-3 text-[12px] text-white/35">
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
                Loading settings...
              </div>
            </div>
          ) : account ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                <form
                  onSubmit={saveProfile}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/10 bg-violet-400/[0.045] text-violet-300/65">
                      <UserRound
                        size={17}
                      />
                    </div>

                    <div>
                      <h3 className="text-[15px] font-medium text-white/82">
                        Profile
                      </h3>

                      <p className="mt-0.5 text-[10px] text-white/29">
                        The identity shown across your workspace.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-white/27">
                        Display name
                      </span>

                      <input
                        value={
                          displayName
                        }
                        onChange={(
                          event
                        ) =>
                          setDisplayName(
                            event.target.value
                          )
                        }
                        maxLength={120}
                        placeholder="Your name"
                        className="h-11 w-full rounded-xl border border-white/[0.07] bg-black/15 px-3.5 text-[12px] text-white/78 outline-none transition placeholder:text-white/19 focus:border-violet-300/20"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-white/27">
                        Email
                      </span>

                      <input
                        value={
                          account.email
                        }
                        readOnly
                        className="h-11 w-full cursor-not-allowed rounded-xl border border-white/[0.05] bg-black/10 px-3.5 text-[12px] text-white/35 outline-none"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      savingProfile
                    }
                    className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-300/15 bg-violet-400/[0.08] px-4 text-[11px] font-semibold text-violet-100/75 transition hover:bg-violet-400/[0.12] disabled:cursor-wait disabled:opacity-45"
                  >
                    {savingProfile ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <Save size={14} />
                    )}
                    Save profile
                  </button>
                </form>

                <form
                  onSubmit={
                    savePassword
                  }
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-sky-300/10 bg-sky-400/[0.035] text-sky-300/60">
                      <KeyRound
                        size={17}
                      />
                    </div>

                    <div>
                      <h3 className="text-[15px] font-medium text-white/82">
                        Password
                      </h3>

                      <p className="mt-0.5 text-[10px] text-white/29">
                        {account.has_password
                          ? "Update your existing Memora password."
                          : "Add a password to your Google-created account."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {account.has_password && (
                      <label className="block">
                        <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-white/27">
                          Current password
                        </span>

                        <input
                          type={
                            showPasswords
                              ? "text"
                              : "password"
                          }
                          value={
                            currentPassword
                          }
                          onChange={(
                            event
                          ) =>
                            setCurrentPassword(
                              event.target.value
                            )
                          }
                          required
                          autoComplete="current-password"
                          className="h-11 w-full rounded-xl border border-white/[0.07] bg-black/15 px-3.5 text-[12px] text-white/78 outline-none focus:border-violet-300/20"
                        />
                      </label>
                    )}

                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-white/27">
                        New password
                      </span>

                      <input
                        type={
                          showPasswords
                            ? "text"
                            : "password"
                        }
                        value={
                          newPassword
                        }
                        onChange={(
                          event
                        ) =>
                          setNewPassword(
                            event.target.value
                          )
                        }
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        className="h-11 w-full rounded-xl border border-white/[0.07] bg-black/15 px-3.5 text-[12px] text-white/78 outline-none focus:border-violet-300/20"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.11em] text-white/27">
                        Confirm password
                      </span>

                      <input
                        type={
                          showPasswords
                            ? "text"
                            : "password"
                        }
                        value={
                          confirmPassword
                        }
                        onChange={(
                          event
                        ) =>
                          setConfirmPassword(
                            event.target.value
                          )
                        }
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        className="h-11 w-full rounded-xl border border-white/[0.07] bg-black/15 px-3.5 text-[12px] text-white/78 outline-none focus:border-violet-300/20"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords(
                          (current) =>
                            !current
                        )
                      }
                      className="inline-flex items-center gap-2 text-[10px] text-white/30 transition hover:text-white/55"
                    >
                      {showPasswords ? (
                        <EyeOff size={13} />
                      ) : (
                        <Eye size={13} />
                      )}
                      {showPasswords
                        ? "Hide passwords"
                        : "Show passwords"}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      savingPassword
                    }
                    className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-300/15 bg-violet-400/[0.08] px-4 text-[11px] font-semibold text-violet-100/75 transition hover:bg-violet-400/[0.12] disabled:cursor-wait disabled:opacity-45"
                  >
                    {savingPassword ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <LockKeyhole
                        size={14}
                      />
                    )}
                    {account.has_password
                      ? "Update password"
                      : "Create password"}
                  </button>
                </form>
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/27">
                    Account status
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.05] bg-black/10 px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Mail
                          size={14}
                          className="text-white/35"
                        />
                        <span className="text-[10px] text-white/42">
                          Email
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-emerald-200/60">
                        <BadgeCheck
                          size={12}
                        />
                        {account.is_email_verified
                          ? "Verified"
                          : "Unverified"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.05] bg-black/10 px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Sparkles
                          size={14}
                          className="text-white/35"
                        />
                        <span className="text-[10px] text-white/42">
                          Google
                        </span>
                      </div>

                      <span className="text-[9px] font-medium text-white/34">
                        {account.google_connected
                          ? "Connected"
                          : "Not connected"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.05] bg-black/10 px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <KeyRound
                          size={14}
                          className="text-white/35"
                        />
                        <span className="text-[10px] text-white/42">
                          Password
                        </span>
                      </div>

                      <span className="text-[9px] font-medium text-white/34">
                        {account.has_password
                          ? "Enabled"
                          : "Not set"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/27">
                    Workspace identity
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-violet-300/10 bg-violet-400/[0.05] text-[14px] font-semibold text-violet-200/70">
                      {(account.display_name ||
                        account.email)
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-medium text-white/72">
                        {account.display_name ||
                          account.email.split("@")[0]}
                      </div>

                      <div className="mt-1 truncate text-[9px] text-white/27">
                        {account.email}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/[0.05] pt-4 text-[9px] leading-5 text-white/25">
                    Member since{" "}
                    {formatCreatedAt(
                      account.created_at
                    )}
                  </div>
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}