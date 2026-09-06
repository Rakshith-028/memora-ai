"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import DashboardShell from "./dashboard-shell";

export type SessionUser = {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
};

export default function AuthenticatedDashboard() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [user, setUser] =
    useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      try {
        const response = await fetch(
          "/api/auth/me",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const data = await response.json();

        if (
          !data.authenticated ||
          !data.user
        ) {
          router.replace("/login");
          return;
        }

        if (active) {
          setUser(data.user);
          setCheckingSession(false);
        }
      } catch {
        router.replace("/login");
      }
    }

    verifySession();

    return () => {
      active = false;
    };
  }, [router]);

  if (
    checkingSession ||
    !user
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07080b] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-violet-300" />

          <span className="text-[11px] tracking-wide text-white/35">
            Restoring your Memora workspace...
          </span>
        </div>
      </main>
    );
  }

  return (
    <DashboardShell user={user} />
  );
}