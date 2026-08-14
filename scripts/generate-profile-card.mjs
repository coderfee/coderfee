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
const languageColors = ["#39ff88", "#00d9ff", "#ffcf5c"];

const languageRows = languages.length
  ? languages.map(([language, count], index) => {
      const percent = Math.round((count / languageTotal) * 100);
      const y = 190 + index * 30;
      return [
        text(432, y, language, "body"),
        text(574, y, `${percent}%`, "muted", 'text-anchor="end"'),
        bar(590, y, 150, percent, languageColors[index]),
      ].join("");
    }).join("")
  : text(432, 190, "awaiting first scan...", "muted");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="330" viewBox="0 0 ${cardWidth} 330" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} GitHub profile card</title>
  <desc id="desc">Terminal-style GitHub profile statistics for ${escapeXml(username)}.</desc>
  <defs>
    <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
      <path d="M 26 0 L 0 0 0 26" fill="none" stroke="#39ff88" stroke-opacity="0.07" />
    </pattern>
    <linearGradient id="scan" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#39ff88" stop-opacity="0" />
      <stop offset="0.5" stop-color="#39ff88" stop-opacity="0.13" />
      <stop offset="1" stop-color="#39ff88" stop-opacity="0" />
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      .body { fill: #d7ffe7; font: 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .muted { fill: #79a88a; font: 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .label { fill: #39ff88; font: 700 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 1.6px; }
      .heading { fill: #ffffff; font: 700 18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .value { fill: #ffffff; font: 700 15px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .bar-bg { fill: #153322; }
    </style>
  </defs>
  <rect width="${cardWidth}" height="330" rx="12" fill="#07110d" stroke="#39ff88" stroke-width="1.5" />
  <rect x="1" y="1" width="778" height="328" rx="11" fill="url(#grid)" />
  <rect x="1" y="1" width="778" height="328" rx="11" fill="url(#scan)" opacity="0.35" />
  <circle cx="25" cy="24" r="5" fill="#ff5f56" />
  <circle cx="43" cy="24" r="5" fill="#ffbd2e" />
  <circle cx="61" cy="24" r="5" fill="#27c93f" />
  ${text(82, 29, `${username}@github:~`, "muted")}
  ${text(748, 29, "● ONLINE", "label", 'text-anchor="end" filter="url(#glow)"')}
  <line x1="24" y1="47" x2="756" y2="47" stroke="#234b31" />
  ${text(28, 77, "$ ./profile --verbose", "body")}
  ${text(28, 105, `PROFILE :: ${username.toUpperCase()}`, "heading", 'filter="url(#glow)"')}
  ${text(28, 133, "[ SYSTEM METRICS ]", "label")}
  ${text(28, 164, "public_repos", "muted")}${text(180, 164, profile.public_repos, "value", 'text-anchor="end"')}
  ${text(28, 194, "followers", "muted")}${text(180, 194, profile.followers, "value", 'text-anchor="end"')}
  ${text(28, 224, "following", "muted")}${text(180, 224, profile.following, "value", 'text-anchor="end"')}
  ${text(28, 254, "total_stars", "muted")}${text(180, 254, stars, "value", 'text-anchor="end"')}
  ${text(28, 286, "status", "muted")}${text(180, 286, "building in public", "value", 'text-anchor="end"')}
  <line x1="230" y1="128" x2="230" y2="291" stroke="#234b31" />
  ${text(258, 133, "[ LANGUAGE MATRIX ]", "label")}
  ${languageRows}
  ${text(258, 286, `last_scan  ${updated}`, "muted")}
  <line x1="24" y1="307" x2="756" y2="307" stroke="#234b31" />
  ${text(28, 322, "root@github:~$ _", "body", 'filter="url(#glow)"')}
  ${text(748, 322, "v1.0.0", "muted", 'text-anchor="end"')}
</svg>
`;

await mkdir("profile", { recursive: true });
await writeFile("profile/stats.svg", svg, "utf8");
