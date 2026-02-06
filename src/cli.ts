#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { captureRun } from "./capture.js";
import { createOrUpdatePrComment } from "./comment-pr.js";
import { loadConfig } from "./config.js";
import type { EventType } from "./types.js";
import { publishRun } from "./publish.js";

const program = new Command();

program
  .name("dumpy")
  .description("Capture and publish UI timeline screenshots")
  .version("0.1.0");

program
  .command("capture")
  .requiredOption("--base-url <url>", "Deployment URL to capture")
  .requiredOption("--sha <sha>", "Git SHA")
  .requiredOption("--ref <ref>", "Git ref")
  .requiredOption("--event <event>", "Event type: preview|production")
  .option("--pr <number>", "Pull request number")
  .option("--config <path>", "Config path", ".dumpy.yml")
  .option("--out <dir>", "Output directory", "output/run")
  .action(async (options) => {
    const config = loadConfig(options.config);
    const eventType = options.event as EventType;

    if (eventType !== "preview" && eventType !== "production") {
      throw new Error(`Invalid --event '${options.event}'`);
    }

    const manifest = await captureRun({
      baseUrl: options.baseUrl,
      sha: options.sha,
      ref: options.ref,
      eventType,
      prNumber: options.pr ? Number(options.pr) : undefined,
      outputDir: options.out,
      config
    });

    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  });

program
  .command("publish")
  .requiredOption("--input <dir>", "Run directory containing manifest.json")
  .requiredOption("--bucket <bucket>", "R2 bucket name")
  .requiredOption("--account-id <id>", "Cloudflare account ID")
  .requiredOption("--access-key-id <id>", "R2 access key ID")
  .requiredOption("--secret-access-key <key>", "R2 secret access key")
  .requiredOption("--public-base-url <url>", "Public assets base URL")
  .option("--history-base-url <url>", "History app base URL", "https://history.dumpy.ai")
  .action(async (options) => {
    const result = await publishRun({
      inputDir: options.input,
      bucket: options.bucket,
      accountId: options.accountId,
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      publicBaseUrl: options.publicBaseUrl,
      historyBaseUrl: options.historyBaseUrl
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("comment-pr")
  .requiredOption("--repo <owner/repo>", "Repository in owner/repo format")
  .requiredOption("--sha <sha>", "Commit SHA")
  .requiredOption("--run-url <url>", "Run URL")
  .requiredOption("--timeline-url <url>", "Timeline URL")
  .option("--pr <number>", "Pull request number")
  .option("--token <token>", "GitHub token")
  .action(async (options) => {
    const token = options.token ?? process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("Missing GitHub token. Set --token or GITHUB_TOKEN.");
    }

    const pr = await createOrUpdatePrComment({
      token,
      repo: options.repo,
      sha: options.sha,
      runUrl: options.runUrl,
      timelineUrl: options.timelineUrl,
      prNumber: options.pr ? Number(options.pr) : undefined
    });

    process.stdout.write(
      `${JSON.stringify({ prNumber: pr ?? null, updated: Boolean(pr) }, null, 2)}\n`
    );
  });

program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`dumpy error: ${message}\n`);
  process.exitCode = 1;
});
