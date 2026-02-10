"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEFAULT_ASSETS_BASE = "https://assets.dumpy.ai";

type UrlState = {
  repo: string;
  runSha?: string;
  assetsBase: string;
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

type LocationState = {
  pathname: string;
  search: string;
};

function readUrlState(pathname: string, search: string): UrlState {
  const query = new URLSearchParams(search);
  const queryRepo = query.get("repo")?.trim() ?? "";
  const queryRun = query.get("run")?.trim() ?? "";
  const queryAssets = query.get("assets")?.trim() ?? "";

  if (queryRepo) {
    return {
      repo: queryRepo,
      runSha: queryRun || undefined,
      assetsBase: queryAssets || DEFAULT_ASSETS_BASE,
    };
  }

  // Backward compatibility for old path-style links.
  const pieces = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (pieces.length >= 2 && pieces[0] !== "dashboard") {
    const repo = `${pieces[0]}/${pieces[1]}`;
    const runSha = pieces.length >= 4 && pieces[2] === "run" ? pieces[3] : undefined;
    return {
      repo,
      runSha,
      assetsBase: queryAssets || DEFAULT_ASSETS_BASE,
    };
  }

  return {
    repo: "",
    assetsBase: queryAssets || DEFAULT_ASSETS_BASE,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function repoKey(repo: string): string {
  const [owner, name] = repo.split("/");
  return `repos/${owner}/${name}`;
}

function replaceUrlState(nextState: UrlState) {
  const url = new URL(window.location.href);

  if (nextState.repo) {
    url.searchParams.set("repo", nextState.repo);
  } else {
    url.searchParams.delete("repo");
  }

  if (nextState.runSha) {
    url.searchParams.set("run", nextState.runSha);
  } else {
    url.searchParams.delete("run");
  }

  if (nextState.assetsBase && nextState.assetsBase !== DEFAULT_ASSETS_BASE) {
    url.searchParams.set("assets", nextState.assetsBase);
  } else {
    url.searchParams.delete("assets");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

async function loadIndex(repo: string, assetsBase: string): Promise<RepoIndex> {
  const url = `${assetsBase}/${repoKey(repo)}/index.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`repo-index:${response.status}`);
  }
  return response.json();
}

async function loadManifest(repo: string, sha: string, assetsBase: string): Promise<RunManifest> {
  const url = `${assetsBase}/${repoKey(repo)}/runs/${sha}/manifest.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`run-manifest:${response.status}`);
  }
  return response.json();
}

function friendlyErrorMessage(error: unknown, repo: string): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  if (error.message === "repo-index:404") {
    return `No timeline found for ${repo} yet. Install Dumpy in your repo and run your first capture, then try again.`;
  }

  if (error.message.startsWith("repo-index:")) {
    return `Could not load timeline index (${error.message.replace("repo-index:", "")}).`;
  }

  if (error.message.startsWith("run-manifest:")) {
    return `Could not load run manifest (${error.message.replace("run-manifest:", "")}).`;
  }

  return error.message;
}

export function TimelineExplorer() {
  const [locationState, setLocationState] = useState<LocationState>({ pathname: "/", search: "" });
  const [repoInput, setRepoInput] = useState("");
  const [assetsInput, setAssetsInput] = useState(DEFAULT_ASSETS_BASE);
  const [message, setMessage] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);
  const [viewState, setViewState] = useState<ViewState>({
    kind: "welcome",
    assetsBase: DEFAULT_ASSETS_BASE,
  });

  useEffect(() => {
    const sync = () => {
      setLocationState({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };

    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    let alive = true;
    const urlState = readUrlState(locationState.pathname, locationState.search);

    setRepoInput(urlState.repo);
    setAssetsInput(urlState.assetsBase);
    setIsLoading(true);

    async function boot() {
      try {
        if (!urlState.repo) {
          if (!alive) {
            return;
          }
          setViewState({ kind: "welcome", assetsBase: urlState.assetsBase });
          setMessage("Install Dumpy in your repo, then load your timeline.");
          return;
        }

        if (urlState.runSha) {
          setMessage(`Loading run ${urlState.runSha.slice(0, 12)} for ${urlState.repo}...`);
          const manifest = await loadManifest(urlState.repo, urlState.runSha, urlState.assetsBase);
          if (!alive) {
            return;
          }
          setViewState({
            kind: "run",
            repo: urlState.repo,
            assetsBase: urlState.assetsBase,
            manifest,
          });
          setMessage(`Loaded ${manifest.stats?.routesCaptured ?? 0} screenshots.`);
          return;
        }

        setMessage(`Loading timeline for ${urlState.repo}...`);
        const index = await loadIndex(urlState.repo, urlState.assetsBase);
        if (!alive) {
          return;
        }
        setViewState({
          kind: "index",
          repo: urlState.repo,
          assetsBase: urlState.assetsBase,
          runs: index.runs || [],
        });
        setMessage(`Loaded ${index.runs?.length ?? 0} runs.`);
      } catch (error) {
        if (!alive) {
          return;
        }
        setViewState({ kind: "welcome", assetsBase: urlState.assetsBase });
        setMessage(friendlyErrorMessage(error, urlState.repo));
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    }

    void boot();

    return () => {
      alive = false;
    };
  }, [locationState.pathname, locationState.search]);

  const currentUrlState = useMemo(
    () => readUrlState(locationState.pathname, locationState.search),
    [locationState.pathname, locationState.search]
  );

  function setUrlState(nextState: UrlState) {
    replaceUrlState(nextState);
    setLocationState({
      pathname: window.location.pathname,
      search: window.location.search,
    });
  }

  function handleLoadRepo() {
    const repo = repoInput.trim();
    const assetsBase = assetsInput.trim() || DEFAULT_ASSETS_BASE;

    if (!repo) {
      setMessage("Enter owner/repo first.");
      return;
    }

    setUrlState({
      repo,
      assetsBase,
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-16 md:px-6">
      <section id="explorer">
        <Card className="border-border/80 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle>Timeline Explorer</CardTitle>
            <CardDescription>
              Load timelines from your assets domain. This dashboard is intended for authenticated users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid gap-3 md:grid-cols-[1fr_1.2fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                handleLoadRepo();
              }}
            >
              <div className="space-y-2">
                <label htmlFor="repo-input" className="text-sm font-medium">
                  Repository
                </label>
                <Input
                  id="repo-input"
                  placeholder="owner/repo"
                  value={repoInput}
                  onChange={(event) => setRepoInput(event.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="assets-input" className="text-sm font-medium">
                  Assets base URL
                </label>
                <Input
                  id="assets-input"
                  placeholder="https://assets.example.com"
                  value={assetsInput}
                  onChange={(event) => setAssetsInput(event.target.value)}
                  className="h-11"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" size="lg" className="h-11 w-full md:w-auto">
                  Load timeline
                </Button>
              </div>
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
                    <CardTitle className="text-lg">1. Install and configure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      Add Dumpy to your repo and set your tracked routes in <code>.dumpy.yml</code>.
                    </p>
                  </CardContent>
                </Card>
                <Card className="gap-3 py-4">
                  <CardHeader>
                    <CardTitle className="text-lg">2. Publish assets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      Dumpy uploads screenshots and manifests to your configured storage domain.
                    </p>
                  </CardContent>
                </Card>
                <Card className="gap-3 py-4">
                  <CardHeader>
                    <CardTitle className="text-lg">3. Explore timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      Enter <code>owner/repo</code> and your assets URL above to load all captured runs.
                    </p>
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
                    {viewState.runs.map((run) => (
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
                          <p className="text-muted-foreground text-sm">Captured images: {run.routeCount}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setUrlState({
                                repo: viewState.repo,
                                runSha: run.sha,
                                assetsBase: viewState.assetsBase,
                              })
                            }
                          >
                            Open run
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </section>
                )}
              </>
            )}

            {viewState.kind === "run" && (
              <section className="space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setUrlState({
                      repo: viewState.repo,
                      assetsBase: viewState.assetsBase,
                    })
                  }
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

            {currentUrlState.repo ? (
              <p className="text-muted-foreground text-xs">
                Current URL state: <code>repo={currentUrlState.repo}</code>
                {currentUrlState.runSha ? (
                  <>
                    {" "}
                    • <code>run={currentUrlState.runSha.slice(0, 12)}</code>
                  </>
                ) : null}
                {" • "}
                <code>assets={currentUrlState.assetsBase}</code>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
