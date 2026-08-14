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

function segment(x, y, width, color) {
  return `<rect x="${x}" y="${y}" width="${width}" height="14" rx="4" fill="${color}"/>`;
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
const cardWidth = 780;
const languageColors = ["#62d9ff", "#a99cff", "#8ce99a"];

let distributed = 0;
const languageValues = languages.map(([name, count], index) => {
  const percent = index === languages.length - 1
    ? 100 - distributed
    : Math.round((count / languageTotal) * 100);
  distributed += percent;
  return { name, percent };
});

let barX = 32;
const languageBar = languageValues.length
  ? languageValues.map(({ percent }, index) => {
      const width = Math.max(8, Math.round((716 * percent) / 100) - 2);
      const result = segment(barX, 194, width, languageColors[index]);
      barX += width + 2;
      return result;
    }).join("")
  : segment(32, 194, 716, "#24344d");

const languageLegend = [0, 1, 2].map((index) => {
  const x = 32 + index * 244;
  const language = languageValues[index];
  if (!language) return text(x, 240, "--", "muted");
  return `<circle cx="${x + 4}" cy="236" r="4" fill="${languageColors[index]}"/>${text(x + 16, 240, language.name, "body")}${text(x + 200, 240, `${language.percent}%`, "muted", 'text-anchor="end"')}`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="280" viewBox="0 0 ${cardWidth} 280" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} GitHub profile card</title>
  <desc id="desc">Technical dashboard-style GitHub profile statistics for ${escapeXml(username)}.</desc>
  <defs>
    <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
      <path d="M 26 0 L 0 0 0 26" fill="none" stroke="#62d9ff" stroke-opacity="0.05" />
    </pattern>
    <style>
      .body { fill: #eaf2ff; font: 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .muted { fill: #8ea3bd; font: 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .label { fill: #62d9ff; font: 700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 1.4px; }
      .heading { fill: #ffffff; font: 700 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .value { fill: #ffffff; font: 700 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .panel { fill: #101b2d; stroke: #24344d; }
    </style>
  </defs>
  <rect width="${cardWidth}" height="280" rx="14" fill="#0b1220" stroke="#2b4261" />
  <rect x="1" y="1" width="778" height="278" rx="13" fill="url(#grid)" />
  <rect x="24" y="24" width="4" height="42" rx="2" fill="#62d9ff" />
  ${text(42, 35, "GITHUB / PROFILE", "label")}
  ${text(42, 62, username, "heading")}
  <rect x="300" y="24" width="140" height="58" rx="8" class="panel" />
  <rect x="456" y="24" width="140" height="58" rx="8" class="panel" />
  <rect x="612" y="24" width="144" height="58" rx="8" class="panel" />
  ${text(316, 45, "REPOS", "label")}${text(316, 70, profile.public_repos, "value")}
  ${text(472, 45, "FOLLOWERS", "label")}${text(472, 70, profile.followers, "value")}
  ${text(628, 45, "STARS", "label")}${text(628, 70, stars, "value")}
  <line x1="24" y1="112" x2="756" y2="112" stroke="#24344d" />
  ${text(32, 138, "LANGUAGE PROFILE", "label")}
  ${text(748, 138, "TOP 3 REPOSITORY LANGUAGES", "muted", 'text-anchor="end"')}
  <rect x="32" y="194" width="716" height="14" rx="4" fill="#17243a" />
  ${languageBar}
  ${languageLegend}
</svg>
`;

await mkdir("profile", { recursive: true });
await writeFile("profile/stats.svg", svg, "utf8");
