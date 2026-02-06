const messageEl = document.getElementById("message");
const contentEl = document.getElementById("content");
const repoInput = document.getElementById("repo-input");
const loadButton = document.getElementById("load-repo");

const query = new URLSearchParams(window.location.search);
const configuredAssetsBase = query.get("assets") || "https://assets.dumpy.ai";
const defaultRepo = "HenryAllen04/Dumpy";

function setMessage(text) {
  messageEl.textContent = text;
}

function parsePathname(pathname) {
  const pieces = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);

  if (pieces.length >= 4 && pieces[2] === "run") {
    return { repo: `${pieces[0]}/${pieces[1]}`, runSha: pieces[3] };
  }

  if (pieces.length >= 2) {
    return { repo: `${pieces[0]}/${pieces[1]}` };
  }

  return { repo: query.get("repo") || "" };
}

function repoKey(repo) {
  const [owner, name] = repo.split("/");
  return `repos/${owner}/${name}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

async function loadIndex(repo) {
  const url = `${configuredAssetsBase}/${repoKey(repo)}/index.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load repo index (${response.status})`);
  }
  return response.json();
}

async function loadManifest(repo, sha) {
  const url = `${configuredAssetsBase}/${repoKey(repo)}/runs/${sha}/manifest.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load run manifest (${response.status})`);
  }
  return response.json();
}

function renderWelcome() {
  const featuredHref = `/${defaultRepo}?assets=${encodeURIComponent(configuredAssetsBase)}`;
  contentEl.innerHTML = `
    <section class="run-list">
      <article class="card">
        <h3>Start with your repo</h3>
        <p class="meta">Enter your <code>owner/repo</code> above and load your timeline history.</p>
      </article>
      <article class="card">
        <h3>Assets bucket</h3>
        <p class="meta">Current source: <code>${configuredAssetsBase}</code></p>
      </article>
      <article class="card">
        <h3>Example path</h3>
        <p class="meta">If seeded, open <code>${defaultRepo}</code> directly.</p>
        <a href="${featuredHref}">Open example route</a>
      </article>
    </section>
  `;
}

function renderIndex(repo, index) {
  const runs = index.runs || [];

  if (runs.length === 0) {
    contentEl.innerHTML = `<p>No runs found for <strong>${repo}</strong>.</p>`;
    return;
  }

  const cards = runs
    .map((run) => {
      const runPath = `/${repo}/run/${run.sha}`;
      return `
      <article class="card">
        <h3>${run.sha.slice(0, 12)}</h3>
        <div class="meta">${formatDate(run.capturedAt)}</div>
        <p><span class="badge">${run.eventType}</span>${run.prNumber ? `<span class="badge">PR #${run.prNumber}</span>` : ""}</p>
        <p class="meta">Captured images: ${run.routeCount}</p>
        <a href="${runPath}?assets=${encodeURIComponent(configuredAssetsBase)}">Open run</a>
      </article>`;
    })
    .join("\n");

  contentEl.innerHTML = `<section class="run-list">${cards}</section>`;
}

function renderRun(repo, manifest) {
  const rows = (manifest.routes || [])
    .filter((route) => route.status === "ok")
    .map((route) => {
      const imageUrl = `${configuredAssetsBase}/${repoKey(repo)}/runs/${manifest.sha}/${route.imagePath}`;
      return `
      <article class="card">
        <h3>${route.path}</h3>
        <p class="meta">${route.device}</p>
        <a href="${imageUrl}" target="_blank" rel="noreferrer noopener">
          <img src="${imageUrl}" loading="lazy" alt="${route.path} on ${route.device}" />
        </a>
      </article>`;
    })
    .join("\n");

  contentEl.innerHTML = `
    <p><a href="/${repo}?assets=${encodeURIComponent(configuredAssetsBase)}">Back to timeline</a></p>
    <p class="meta">Run <code>${manifest.sha}</code> • ${formatDate(manifest.capturedAt)}</p>
    <section class="shot-grid">${rows}</section>
  `;
}

async function boot() {
  const parsed = parsePathname(window.location.pathname);
  repoInput.value = parsed.repo || defaultRepo;

  loadButton.addEventListener("click", () => {
    const value = repoInput.value.trim();
    if (!value) {
      setMessage("Enter owner/repo first.");
      return;
    }
    window.location.href = `/${value}?assets=${encodeURIComponent(configuredAssetsBase)}`;
  });

  if (!parsed.repo) {
    setMessage("Ready. Add a repo and load timeline data.");
    renderWelcome();
    return;
  }

  try {
    if (parsed.runSha) {
      setMessage(`Loading run ${parsed.runSha.slice(0, 12)} for ${parsed.repo}...`);
      const manifest = await loadManifest(parsed.repo, parsed.runSha);
      renderRun(parsed.repo, manifest);
      setMessage(`Loaded ${manifest.stats?.routesCaptured ?? 0} screenshots.`);
    } else {
      setMessage(`Loading timeline for ${parsed.repo}...`);
      const index = await loadIndex(parsed.repo);
      renderIndex(parsed.repo, index);
      setMessage(`Loaded ${index.runs?.length ?? 0} runs.`);
    }
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error));
    contentEl.innerHTML = "";
  }
}

boot();
