import { Octokit } from "@octokit/rest";
import { parseRepo } from "./utils.js";

const MARKER = "<!-- dumpy-comment -->";

interface CommentOptions {
  token: string;
  repo: string;
  sha: string;
  runUrl: string;
  timelineUrl: string;
  prNumber?: number;
}

async function resolvePrByCommit(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string
): Promise<number | undefined> {
  const response = await octokit.repos.listPullRequestsAssociatedWithCommit({
    owner,
    repo,
    commit_sha: sha
  });

  const first = response.data[0];
  return first?.number;
}

function body(runUrl: string, timelineUrl: string): string {
  return [
    MARKER,
    "## Dumpy UI History",
    "",
    `- Run: ${runUrl}`,
    `- Timeline: ${timelineUrl}`,
    "",
    "This is an archive-only snapshot run and does not block merges."
  ].join("\n");
}

export async function createOrUpdatePrComment(options: CommentOptions): Promise<number | undefined> {
  const { owner, repo } = parseRepo(options.repo);
  const octokit = new Octokit({ auth: options.token });

  const prNumber =
    options.prNumber ?? (await resolvePrByCommit(octokit, owner, repo, options.sha));

  if (!prNumber) {
    return undefined;
  }

  const issueComments = await octokit.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100
  });

  const existing = issueComments.data.find((comment) =>
    comment.body?.includes(MARKER)
  );

  const nextBody = body(options.runUrl, options.timelineUrl);

  if (existing) {
    await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: nextBody
    });
  } else {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: nextBody
    });
  }

  return prNumber;
}
