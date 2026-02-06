import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput
} from "@aws-sdk/client-s3";
import type { RepoIndex, RunManifest, RunIndexEntry } from "./types.js";
import { parseRepo } from "./utils.js";

interface PublishOptions {
  inputDir: string;
  bucket: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  historyBaseUrl?: string;
}

interface PublishResult {
  manifestUrl: string;
  timelineUrl: string;
}

function createClient(options: PublishOptions): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey
    }
  });
}

async function streamToString(body: GetObjectCommandOutput["Body"]): Promise<string> {
  if (!body) {
    return "";
  }

  const chunks: Uint8Array[] = [];

  for await (const chunk of body as Readable) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function runPrefix(manifest: RunManifest): string {
  const { owner, repo } = parseRepo(manifest.repo);
  return `repos/${owner}/${repo}/runs/${manifest.sha}`;
}

function indexKey(repoName: string): string {
  const { owner, repo } = parseRepo(repoName);
  return `repos/${owner}/${repo}/index.json`;
}

function prPointerKey(repoName: string, prNumber: number): string {
  const { owner, repo } = parseRepo(repoName);
  return `repos/${owner}/${repo}/prs/${prNumber}/latest.json`;
}

async function putJson(
  client: S3Client,
  bucket: string,
  key: string,
  value: unknown
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: "application/json; charset=utf-8",
      CacheControl: "public, max-age=60"
    })
  );
}

async function getJsonOrNull<T>(
  client: S3Client,
  bucket: string,
  key: string
): Promise<T | null> {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );

    const raw = await streamToString(response.Body);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error: unknown) {
    const hasCode =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "NoSuchKey";

    if (hasCode) {
      return null;
    }

    throw error;
  }
}

async function uploadScreenshots(
  client: S3Client,
  options: PublishOptions,
  manifest: RunManifest,
  manifestPath: string
): Promise<void> {
  const basePrefix = runPrefix(manifest);
  const baseDir = path.dirname(manifestPath);

  for (const route of manifest.routes) {
    if (route.status !== "ok" || !route.imagePath) {
      continue;
    }

    const localPath = path.join(baseDir, route.imagePath);
    const key = `${basePrefix}/${route.imagePath}`;

    const body = await fs.promises.readFile(localPath);

    await client.send(
      new PutObjectCommand({
        Bucket: options.bucket,
        Key: key,
        Body: body,
        ContentType: "image/png",
        CacheControl: "public, max-age=31536000, immutable"
      })
    );
  }
}

function mergeIndex(existing: RepoIndex | null, manifest: RunManifest, manifestUrl: string): RepoIndex {
  const run: RunIndexEntry = {
    sha: manifest.sha,
    ref: manifest.ref,
    eventType: manifest.eventType,
    prNumber: manifest.prNumber,
    capturedAt: manifest.capturedAt,
    manifestUrl,
    routeCount: manifest.stats.routesCaptured
  };

  const priorRuns = (existing?.runs ?? []).filter((entry) => entry.sha !== manifest.sha);
  const runs = [run, ...priorRuns].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

  return {
    version: 1,
    repo: manifest.repo,
    updatedAt: new Date().toISOString(),
    runs
  };
}

export async function publishRun(options: PublishOptions): Promise<PublishResult> {
  const manifestPath = path.join(path.resolve(options.inputDir), "manifest.json");
  const raw = await fs.promises.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as RunManifest;

  const client = createClient(options);
  const runBasePrefix = runPrefix(manifest);

  await uploadScreenshots(client, options, manifest, manifestPath);

  const manifestKey = `${runBasePrefix}/manifest.json`;
  await putJson(client, options.bucket, manifestKey, manifest);

  const manifestUrl = `${options.publicBaseUrl}/${manifestKey}`;
  const repoIndexKey = indexKey(manifest.repo);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentIndex = await getJsonOrNull<RepoIndex>(client, options.bucket, repoIndexKey);
    const merged = mergeIndex(currentIndex, manifest, manifestUrl);
    await putJson(client, options.bucket, repoIndexKey, merged);

    const verify = await getJsonOrNull<RepoIndex>(client, options.bucket, repoIndexKey);
    if (verify?.runs.some((item) => item.sha === manifest.sha)) {
      break;
    }

    if (attempt === 2) {
      throw new Error("Failed to persist repo index after retries.");
    }

    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  if (manifest.prNumber) {
    const pointerKey = prPointerKey(manifest.repo, manifest.prNumber);
    await putJson(client, options.bucket, pointerKey, {
      version: 1,
      repo: manifest.repo,
      prNumber: manifest.prNumber,
      sha: manifest.sha,
      manifestUrl,
      updatedAt: new Date().toISOString()
    });
  }

  return {
    manifestUrl,
    timelineUrl: `${(options.historyBaseUrl ?? "https://history.dumpy.ai").replace(/\/$/, "")}/${manifest.repo}`
  };
}
