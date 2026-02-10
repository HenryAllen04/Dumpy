"use client";

import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";

import { TimelineExplorer } from "@/components/timeline-explorer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ACCOUNT_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DUMPY_ACCOUNT_DASHBOARD_URL ?? "https://app.dumpy.ai/dashboard";

function hasAccountSessionCookie(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const cookies = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean);

  return cookies.some((cookie) => {
    return (
      cookie.startsWith("dumpy_session=") ||
      cookie.startsWith("__Secure-dumpy_session=") ||
      cookie.startsWith("__session=")
    );
  });
}

export function DashboardGate() {
  const isBrowser = typeof window !== "undefined";
  const allowed = isBrowser && hasAccountSessionCookie();

  if (!allowed) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 md:px-6">
        <Card className="w-full border-border/80 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4" aria-hidden="true" />
              Account required
            </CardTitle>
            <CardDescription>
              Timeline Explorer is restricted to signed-in Dumpy accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Sign in to your Dumpy account to access repository timelines and captured screenshots.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href={ACCOUNT_DASHBOARD_URL}>Sign in to Dashboard</a>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              To fully protect screenshots, store timeline assets behind authenticated hosting.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <TimelineExplorer />;
}
