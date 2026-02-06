import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { discoverRoutes } from "./discovery.js";
import type { DumpyConfig, EventType, RunManifest } from "./types.js";
import { ensureDir, routeSlug, sha256Buffer, writeJson } from "./utils.js";

interface CaptureOptions {
  baseUrl: string;
  sha: string;
  ref: string;
  eventType: EventType;
  prNumber?: number;
  outputDir: string;
  config: DumpyConfig;
}

export async function captureRun(options: CaptureOptions): Promise<RunManifest> {
  const { baseUrl, sha, ref, eventType, prNumber, outputDir, config } = options;
  const runDir = path.resolve(outputDir);
  const shotsDir = path.join(runDir, "shots");
  await ensureDir(shotsDir);

  const discovery = await discoverRoutes({ baseUrl, config });
  const { routes, warnings } = discovery;

  const browser = await chromium.launch({ headless: true });
  const results: RunManifest["routes"] = [];

  try {
    for (const device of config.capture.devices) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height }
      });

      const page = await context.newPage();

      for (const routePath of routes) {
        const targetUrl = new URL(routePath, baseUrl).toString();
        const slug = routeSlug(routePath);
        const relativeImagePath = path.posix.join("shots", device.name, `${slug}.png`);
        const absoluteImagePath = path.join(runDir, relativeImagePath);

        try {
          await ensureDir(path.dirname(absoluteImagePath));

          await page.goto(targetUrl, {
            waitUntil: config.capture.waitUntil,
            timeout: config.capture.timeoutMs
          });

          if (config.capture.disableAnimations) {
            await page.addStyleTag({
              content:
                "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}"
            });
          }

          await page.waitForTimeout(150);

          const screenshot = await page.screenshot({
            path: absoluteImagePath,
            fullPage: config.capture.fullPage
          });

          results.push({
            path: routePath,
            device: device.name,
            imagePath: relativeImagePath,
            imageSha256: sha256Buffer(screenshot),
            status: "ok"
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.push({
            path: routePath,
            device: device.name,
            status: "error",
            error: message
          });
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  for (const warning of warnings) {
    results.push({
      path: "_discovery",
      device: "system",
      status: "error",
      error: warning
    });
  }

  const captured = results.filter((item) => item.status === "ok").length;
  const failed = results.filter((item) => item.status === "error").length;

  const manifest: RunManifest = {
    version: 1,
    repo: config.project.repo,
    sha,
    ref,
    eventType,
    prNumber,
    baseUrl,
    capturedAt: new Date().toISOString(),
    routes: results,
    stats: {
      routesRequested: routes.length * config.capture.devices.length,
      routesCaptured: captured,
      routesFailed: failed
    }
  };

  await writeJson(path.join(runDir, "manifest.json"), manifest);

  // Write minimal run summary to ease debugging in CI artifacts.
  await fs.promises.writeFile(
    path.join(runDir, "SUMMARY.txt"),
    `Routes: ${routes.length}\nCaptured: ${captured}\nFailed: ${failed}\n`,
    "utf8"
  );

  return manifest;
}
