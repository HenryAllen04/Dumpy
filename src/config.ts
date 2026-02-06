import fs from "node:fs";
import path from "node:path";
import YAML from "js-yaml";
import { z } from "zod";
import type { DumpyConfig } from "./types.js";

const schema = z.object({
  version: z.number().int().positive().default(1),
  project: z.object({
    repo: z.string().min(3),
    defaultBranch: z.string().default("main")
  }),
  capture: z.object({
    devices: z
      .array(
        z.object({
          name: z.string().min(1),
          width: z.number().int().positive(),
          height: z.number().int().positive()
        })
      )
      .min(1),
    fullPage: z.boolean().default(true),
    timeoutMs: z.number().int().positive().default(30000),
    waitUntil: z
      .enum(["load", "domcontentloaded", "networkidle", "commit"])
      .default("networkidle"),
    disableAnimations: z.boolean().default(true)
  }),
  routes: z.object({
    include: z.array(z.string().min(1)).default(["/"]),
    exclude: z.array(z.string().min(1)).default([])
  }),
  discovery: z.object({
    sitemap: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default("/sitemap.xml")
    }),
    maxRoutes: z.number().int().positive().default(200)
  }),
  output: z.object({
    publicBaseUrl: z.string().url().default("https://assets.dumpy.ai")
  })
});

export function loadConfig(configPath: string): DumpyConfig {
  const resolved = path.resolve(configPath);
  const raw = fs.readFileSync(resolved, "utf8");
  const parsed = YAML.load(raw);
  const result = schema.parse(parsed);
  return result;
}
