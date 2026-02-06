export type EventType = "preview" | "production";

export interface DeviceConfig {
  name: string;
  width: number;
  height: number;
}

export interface DumpyConfig {
  version: number;
  project: {
    repo: string;
    defaultBranch: string;
  };
  capture: {
    devices: DeviceConfig[];
    fullPage: boolean;
    timeoutMs: number;
    waitUntil: "load" | "domcontentloaded" | "networkidle" | "commit";
    disableAnimations: boolean;
  };
  routes: {
    include: string[];
    exclude: string[];
  };
  discovery: {
    sitemap: {
      enabled: boolean;
      path: string;
    };
    maxRoutes: number;
  };
  output: {
    publicBaseUrl: string;
  };
}

export interface CaptureRouteResult {
  path: string;
  device: string;
  imagePath?: string;
  imageSha256?: string;
  status: "ok" | "error";
  error?: string;
}

export interface RunManifest {
  version: number;
  repo: string;
  sha: string;
  ref: string;
  eventType: EventType;
  prNumber?: number;
  baseUrl: string;
  capturedAt: string;
  routes: CaptureRouteResult[];
  stats: {
    routesRequested: number;
    routesCaptured: number;
    routesFailed: number;
  };
}

export interface RunIndexEntry {
  sha: string;
  ref: string;
  eventType: EventType;
  prNumber?: number;
  capturedAt: string;
  manifestUrl: string;
  routeCount: number;
}

export interface RepoIndex {
  version: number;
  repo: string;
  updatedAt: string;
  runs: RunIndexEntry[];
}
