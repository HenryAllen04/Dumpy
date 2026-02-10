"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEFAULT_ASSETS_BASE = "https://assets.dumpy.ai";
const DEFAULT_REPO = "HenryAllen04/Dumpy";

type ParsedPath = {
  repo?: string;
  runSha?: string;
};

type RunSummary = {
  sha: string;
  capturedAt: string;
  eventType: string;
  prNumber?: number;
  routeCount: number;
};

type RepoIndex = {
  runs?: RunSummary[];
};

type ManifestRoute = {
  path: string;
  device: string;
  status: string;
  imagePath: string;
};

type RunManifest = {
  sha: string;
  capturedAt: string;
  routes?: ManifestRoute[];
  stats?: {
    routesCaptured?: number;
  };
};

type ViewState =
  | { kind: "welcome"; assetsBase: string }
  | { kind: "index"; repo: string; assetsBase: string; runs: RunSummary[] }
  | { kind: "run"; repo: string; assetsBase: string; manifest: RunManifest };

function parsePathname(pathname: string): ParsedPath {
  const pieces = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);

  if (pieces.length >= 4 && pieces[2] === "run") {
    return { repo: `${pieces[0]}/${pieces[1]}`, runSha: pieces[3] };
  }

  if (pieces.length >= 2) {
    return { repo: `${pieces[0]}/${pieces[1]}` };
  }

  return {};
}

function readAssetsBase(search: string): string {
  const query = new URLSearchParams(search);
  return query.get("assets") || DEFAULT_ASSETS_BASE;
}

function repoKey(repo: string): string {
  const [owner, name] = repo.split("/");
  return `repos/${owner}/${name}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function buildHref(pathname: string, assetsBase: string): string {
  if (assetsBase === DEFAULT_ASSETS_BASE) {
    return pathname;
  }
  return `${pathname}?assets=${encodeURIComponent(assetsBase)}`;
}

async function loadIndex(repo: string, assetsBase: string): Promise<RepoIndex> {
  const url = `${assetsBase}/${repoKey(repo)}/index.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load repo index (${response.status})`);
  }

  return response.json();
}

async function loadManifest(repo: string, sha: string, assetsBase: string): Promise<RunManifest> {
  const url = `${assetsBase}/${repoKey(repo)}/runs/${sha}/manifest.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load run manifest (${response.status})`);
  }

  return response.json();
}

export function TimelineExplorer() {
  const [repoInput, setRepoInput] = useState(DEFAULT_REPO);
  const [message, setMessage] = useState("Loading timeline context...");
  const [isLoading, setIsLoading] = useState(true);
  const [viewState, setViewState] = useState<ViewState>({
    kind: "welcome",
    assetsBase: DEFAULT_ASSETS_BASE,
  });
  const [locationState, setLocationState] = useState(() => ({
    pathname: "/",
    search: "",
  }));

  useEffect(() => {
    const syncLocation = () => {
      setLocationState({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };

    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);

  useEffect(() => {
    let active = true;
    const assetsBase = readAssetsBase(locationState.search);
    const parsed = parsePathname(locationState.pathname);

    setRepoInput(parsed.repo || DEFAULT_REPO);
    setIsLoading(true);

    async function load() {
      try {
        if (!parsed.repo) {
          setViewState({ kind: "welcome", assetsBase });
          setMessage("Ready. Add a repo and load timeline data.");
          return;
        }

        if (parsed.runSha) {
          setMessage(`Loading run ${parsed.runSha.slice(0, 12)} for ${parsed.repo}...`);
          const manifest = await loadManifest(parsed.repo, parsed.runSha, assetsBase);

          if (!active) {
            return;
          }

          setViewState({ kind: "run", repo: parsed.repo, assetsBase, manifest });
          setMessage(`Loaded ${manifest.stats?.routesCaptured ?? 0} screenshots.`);
          return;
        }

        setMessage(`Loading timeline for ${parsed.repo}...`);
        const index = await loadIndex(parsed.repo, assetsBase);

        if (!active) {
          return;
        }

        setViewState({ kind: "index", repo: parsed.repo, assetsBase, runs: index.runs || [] });
        setMessage(`Loaded ${index.runs?.length ?? 0} runs.`);
      } catch (error) {
        if (!active) {
          return;
        }
        setViewState({ kind: "welcome", assetsBase });
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [locationState.pathname, locationState.search]);

  const assetsBase = useMemo(() => readAssetsBase(locationState.search), [locationState.search]);

  function navigateTo(pathname: string) {
    const href = buildHref(pathname, assetsBase);
    window.history.pushState({}, "", href);
    setLocationState({ pathname: window.location.pathname, search: window.location.search });
  }

  function handleLoadRepo() {
    const repo = repoInput.trim();
    if (!repo) {
      setMessage("Enter owner/repo first.");
      return;
    }

    navigateTo(`/${repo}`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-16 md:px-6">
      <header className="grid gap-4 md:grid-cols-[1.35fr_1fr]">
        <Card className="border-border/80 shadow-lg shadow-primary/5">
          <CardHeader>
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
              UI history for fast-moving teams
            </p>
            <CardTitle className="text-balance text-3xl leading-tight tracking-tight md:text-5xl">
              Dumpy tracks how your UI evolves on every deploy.
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed md:text-base">
              Connect a repo, capture preview deployments, and browse screenshot history by PR, route,
              device, and commit.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a
                href="https://github.com/HenryAllen04/Dumpy"
                target="_blank"
                rel="noreferrer noopener"
              >
                Open Source Repo
              </a>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a
                href="https://github.com/HenryAllen04/Dumpy-Private"
                target="_blank"
                rel="noreferrer noopener"
              >
                Private Product Repo
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle>MVP status</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground grid gap-2 text-sm">
              <li>GitHub Action capture pipeline</li>
              <li>Playwright screenshot capture</li>
              <li>Cloudflare R2 manifest storage</li>
              <li>Cloudflare Pages timeline UI</li>
            </ul>
          </CardContent>
        </Card>
      </header>

      <section id="explorer" className="mt-4">
        <Card className="border-border/80 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle>Timeline Explorer</CardTitle>
            <CardDescription>
              Load any repo with Dumpy data stored in your configured assets bucket.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-col items-start gap-3 md:flex-row md:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                handleLoadRepo();
              }}
            >
              <label htmlFor="repo-input" className="text-sm font-medium">
                Repository
              </label>
              <Input
                id="repo-input"
                placeholder="owner/repo"
                value={repoInput}
                onChange={(event) => setRepoInput(event.target.value)}
                className="h-11 w-full max-w-sm"
              />
              <Button type="submit" size="lg">
                Load timeline
              </Button>
            </form>

            <div className="text-muted-foreground min-h-6 text-sm">
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {message}
                </span>
              ) : (
                message
              )}
            </div>

            {viewState.kind === "welcome" && (
              <section className="grid gap-4 lg:grid-cols-3">
                <Card className="gap-3 py-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Start with your repo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      Enter your <code>owner/repo</code> above and load timeline history.
                    </p>
                  </CardContent>
                </Card>
                <Card className="gap-3 py-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Assets bucket</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      Current source: <code>{viewState.assetsBase}</code>
                    </p>
                  </CardContent>
                </Card>
                <Card className="gap-3 py-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Example path</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground text-sm">
                      If seeded, open <code>{DEFAULT_REPO}</code> directly.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateTo(`/${DEFAULT_REPO}`)}
                      className="w-full sm:w-auto"
                    >
                      Open example route
                    </Button>
                  </CardContent>
                </Card>
              </section>
            )}

            {viewState.kind === "index" && (
              <>
                {viewState.runs.length === 0 ? (
                  <p className="text-sm">
                    No runs found for <strong>{viewState.repo}</strong>.
                  </p>
                ) : (
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {viewState.runs.map((run) => {
                      const runPath = `/${viewState.repo}/run/${run.sha}`;
                      return (
                        <Card key={run.sha} className="gap-4 py-4">
                          <CardHeader className="space-y-2">
                            <CardTitle className="text-lg">{run.sha.slice(0, 12)}</CardTitle>
                            <CardDescription>{formatDate(run.capturedAt)}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">{run.eventType}</Badge>
                              {run.prNumber ? <Badge variant="outline">PR #{run.prNumber}</Badge> : null}
                            </div>
                            <p className="text-muted-foreground text-sm">
                              Captured images: {run.routeCount}
                            </p>
                            <Button variant="outline" size="sm" asChild>
                              <a href={buildHref(runPath, viewState.assetsBase)}>
                                Open run
                                <ExternalLink className="size-3.5" aria-hidden="true" />
                              </a>
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </section>
                )}
              </>
            )}

            {viewState.kind === "run" && (
              <section className="space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateTo(`/${viewState.repo}`)}
                  className="w-full sm:w-auto"
                >
                  Back to timeline
                </Button>

                <p className="text-muted-foreground text-sm">
                  Run <code>{viewState.manifest.sha}</code> - {formatDate(viewState.manifest.capturedAt)}
                </p>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(viewState.manifest.routes || [])
                    .filter((route) => route.status === "ok")
                    .map((route) => {
                      const imageUrl = `${viewState.assetsBase}/${repoKey(viewState.repo)}/runs/${viewState.manifest.sha}/${route.imagePath}`;

                      return (
                        <Card key={`${route.path}-${route.device}`} className="gap-3 py-4">
                          <CardHeader className="space-y-1">
                            <CardTitle className="text-lg">{route.path}</CardTitle>
                            <CardDescription>{route.device}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="focus-visible:ring-ring/50 block rounded-md focus-visible:ring-2 focus-visible:outline-none"
                            >
                              {/* Dynamic screenshot URLs come from user-configured assets domains. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imageUrl}
                                loading="lazy"
                                alt={`${route.path} on ${route.device}`}
                                className="border-border bg-background block w-full rounded-md border"
                              />
                            </a>
                            <Button asChild variant="outline" size="sm">
                              <a href={imageUrl} target="_blank" rel="noreferrer noopener">
                                Open image
                                <ExternalLink className="size-3.5" aria-hidden="true" />
                              </a>
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                </section>
              </section>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
