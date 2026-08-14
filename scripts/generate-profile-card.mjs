import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_REPOSITORY_OWNER || "coderfee";
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function text(x, y, value, className = "body", extra = "") {
  return `<text x="${x}" y="${y}" class="${className}" ${extra}>${escapeXml(value)}</text>`;
}

function bar(x, y, width, percent, color = "#39ff88") {
  const filled = Math.max(4, Math.round((width * percent) / 100));
  return `<rect x="${x}" y="${y - 12}" width="${width}" height="8" rx="4" class="bar-bg"/><rect x="${x}" y="${y - 12}" width="${filled}" height="8" rx="4" fill="${color}"/>`;
}

const profile = await github(`/users/${encodeURIComponent(username)}`);
const repositories = await github(`/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=updated`);
const stars = repositories.reduce((total, repo) => total + repo.stargazers_count, 0);
const languageCounts = new Map();

for (const repository of repositories) {
  if (repository.language) {
    languageCounts.set(repository.language, (languageCounts.get(repository.language) || 0) + 1);
  }
}

const languages = [...languageCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3);
const languageTotal = languages.reduce((total, [, count]) => total + count, 0) || 1;
const updated = new Date().toISOString().slice(0, 10);
const cardWidth = 780;
const languageColors = ["#8cffb0", "#7ee7ff", "#ffd166"];

const languageColumns = [0, 1, 2].map((index) => {
  const x = 28 + index * 244;
  const language = languages[index];
  if (!language) {
    return `${text(x, 222, "--", "muted")}${bar(x, 238, 200, 0, languageColors[index])}`;
  }
  const [name, count] = language;
  const percent = Math.round((count / languageTotal) * 100);
  return `${text(x, 222, name, "body")}${text(x + 200, 222, `${percent}%`, "muted", 'text-anchor="end"')}${bar(x, 238, 200, percent, languageColors[index])}`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="250" viewBox="0 0 ${cardWidth} 250" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} GitHub profile card</title>
  <desc id="desc">Terminal-style GitHub profile statistics for ${escapeXml(username)}.</desc>
  <defs>
    <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
      <path d="M 26 0 L 0 0 0 26" fill="none" stroke="#8cffb0" stroke-opacity="0.045" />
    </pattern>
    <style>
      .body { fill: #d7ffe7; font: 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .muted { fill: #79a88a; font: 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .label { fill: #8cffb0; font: 700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 1.4px; }
      .heading { fill: #ffffff; font: 700 22px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .value { fill: #ffffff; font: 700 24px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .bar-bg { fill: #153322; }
    </style>
  </defs>
  <rect width="${cardWidth}" height="250" rx="12" fill="#07110d" stroke="#39ff88" stroke-opacity="0.75" />
  <rect x="1" y="1" width="778" height="248" rx="11" fill="url(#grid)" />
  <circle cx="25" cy="24" r="5" fill="#ff5f56" />
  <circle cx="43" cy="24" r="5" fill="#ffbd2e" />
  <circle cx="61" cy="24" r="5" fill="#27c93f" />
  ${text(82, 29, `${username}@github:~`, "muted")}
  ${text(748, 29, "SYNCED", "label", 'text-anchor="end"')}
  <line x1="24" y1="47" x2="756" y2="47" stroke="#234b31" />
  ${text(28, 76, "$ whoami", "body")}
  ${text(28, 104, username, "heading")}
  ${text(748, 104, `sync ${updated}`, "muted", 'text-anchor="end"')}
  <line x1="24" y1="122" x2="756" y2="122" stroke="#234b31" />
  ${text(28, 146, "REPOS", "label")}${text(28, 177, profile.public_repos, "value")}
  ${text(276, 146, "FOLLOWERS", "label")}${text(276, 177, profile.followers, "value")}
  ${text(524, 146, "STARS", "label")}${text(524, 177, stars, "value")}
  <line x1="24" y1="200" x2="756" y2="200" stroke="#234b31" />
  ${languageColumns}
</svg>
`;

await mkdir("profile", { recursive: true });
await writeFile("profile/stats.svg", svg, "utf8");
