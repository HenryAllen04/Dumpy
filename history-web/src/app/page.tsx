import { CheckCircle2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ACCOUNT_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DUMPY_ACCOUNT_DASHBOARD_URL ?? "https://app.dumpy.ai/dashboard";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-16 md:px-6">
      <header className="grid gap-4 md:grid-cols-[1.45fr_1fr]">
        <Card className="border-border/80 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="text-balance text-3xl leading-tight tracking-tight md:text-5xl">
              Start tracking your UI with Dumpy.
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed md:text-base">
              Install Dumpy in your repo. On every deploy, capture screenshots and build a timeline of
              your product changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="https://github.com/HenryAllen04/Dumpy" target="_blank" rel="noreferrer noopener">
                Install Dumpy
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a href={ACCOUNT_DASHBOARD_URL}>Sign in to view timelines</a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Install Dumpy and configure your routes in <code>.dumpy.yml</code>.
            </p>
            <p className="text-muted-foreground flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Deploy previews trigger screenshot capture and manifest publishing.
            </p>
            <p className="text-muted-foreground flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Signed-in users view timelines in the dashboard.
            </p>
          </CardContent>
        </Card>
      </header>
    </main>
  );
}
