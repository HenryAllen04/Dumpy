import { XMLParser } from "fast-xml-parser";
import { minimatch } from "minimatch";
import type { DumpyConfig } from "./types.js";
import { canonicalizePath } from "./utils.js";

interface DiscoveryOptions {
  baseUrl: string;
  config: DumpyConfig;
}

const parser = new XMLParser();

export function parseSitemapRoutes(xml: string, baseUrl: string): string[] {
  const parsed = parser.parse(xml) as {
    urlset?: { url?: Array<{ loc?: string }> | { loc?: string } };
  };

  const base = new URL(baseUrl);
  const urlEntries = parsed.urlset?.url;

  const locs: string[] = [];

  const pushLoc = (value?: string): void => {
    if (value && typeof value === "string") {
      locs.push(value);
    }
  };

  if (Array.isArray(urlEntries)) {
    for (const item of urlEntries) pushLoc(item?.loc);
  } else if (urlEntries) {
    pushLoc(urlEntries.loc);
  }

  const routes = new Set<string>();

  for (const loc of locs) {
    try {
      const parsedUrl = new URL(loc);
      if (parsedUrl.origin !== base.origin) {
        continue;
      }
      routes.add(canonicalizePath(parsedUrl.pathname));
    } catch {
      // Skip malformed loc entries.
    }
  }

  return [...routes];
}

export function applyRouteFilters(
  routes: string[],
  excludePatterns: string[],
  maxRoutes: number
): string[] {
  const filtered = routes.filter((routePath) => {
    return !excludePatterns.some((pattern) =>
      minimatch(routePath, pattern, { nocase: true, dot: true })
    );
  });

  filtered.sort((a, b) => a.localeCompare(b));
  return filtered.slice(0, maxRoutes);
}

export async function discoverRoutes(
  options: DiscoveryOptions
): Promise<{ routes: string[]; warnings: string[] }> {
  const { baseUrl, config } = options;
  const warnings: string[] = [];

  const routeSet = new Set<string>(config.routes.include.map(canonicalizePath));

  if (config.discovery.sitemap.enabled) {
    const sitemapUrl = new URL(config.discovery.sitemap.path, baseUrl);

    try {
      const response = await fetch(sitemapUrl, {
        headers: {
          "user-agent": "dumpy-bot/0.1"
        }
      });

      if (!response.ok) {
        warnings.push(`Sitemap request failed (${response.status}) at ${sitemapUrl.toString()}`);
      } else {
        const xml = await response.text();
        for (const routePath of parseSitemapRoutes(xml, baseUrl)) {
          routeSet.add(routePath);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Sitemap fetch failed at ${sitemapUrl.toString()}: ${message}`);
    }
  }

  const routes = applyRouteFilters(
    [...routeSet],
    config.routes.exclude,
    config.discovery.maxRoutes
  );

  return { routes, warnings };
}
