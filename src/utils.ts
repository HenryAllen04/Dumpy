import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function canonicalizePath(input: string): string {
  if (!input) {
    return "/";
  }

  const [withoutHash] = input.split("#", 1);
  const [withoutQuery] = withoutHash.split("?", 1);
  let normalized = withoutQuery.trim();

  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }

  normalized = normalized.replace(/\/+/g, "/");

  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || "/";
}

export function routeSlug(routePath: string): string {
  if (routePath === "/") {
    return "root";
  }

  const cleaned = routePath
    .slice(1)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const hash = crypto
    .createHash("sha1")
    .update(routePath)
    .digest("hex")
    .slice(0, 8);

  return `${cleaned || "route"}-${hash}`;
}

export function sha256Buffer(input: Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

export function parseRepo(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo '${repo}'. Expected owner/repo format.`);
  }

  return { owner: parts[0], repo: parts[1] };
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  await fs.promises.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
