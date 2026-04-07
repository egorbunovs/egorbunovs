import fs from "fs";
import { graphql } from "@octokit/graphql";

const username = process.env.USERNAME;
if (!username) throw new Error("USERNAME environment variable is not set");

const client = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

// Distinct colors for top languages
const languageColors = [
  "#f1e05a", "#e34c26", "#563d7c", "#b07219",
  "#2b7489", "#f34b7d", "#701516", "#3572A5",
  "#438eff", "#178600"
];

async function fetchData() {
  let allRepos = [];
  let after = null;
  let userData = null;

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  do {
    const res = await client(`
      query($username: String!, $after: String, $from: DateTime!, $to: DateTime!) {
        user(login: $username) {
          contributionsCollection(from: $from, to: $to) {
            totalCommitContributions
          }
          repositories(first: 100, ownerAffiliations: OWNER, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              name
              languages(first: 10) {
                edges {
                  size
                  node { name }
                }
              }
            }
          }
        }
      }
    `, { username, after, from, to });

    if (!res.user) {
      throw new Error(`User "${username}" not found or token cannot access user data`);
    }

    if (!userData) userData = res.user;

    allRepos = allRepos.concat(res.user.repositories.nodes);
    after = res.user.repositories.pageInfo.hasNextPage
      ? res.user.repositories.pageInfo.endCursor
      : null;

  } while (after);

  const commitsThisMonth = userData?.contributionsCollection?.totalCommitContributions || 0;

  // Aggregate languages
  const languageMap = {};
  for (const repo of allRepos) {
    if (!repo.languages) continue;
    for (const edge of repo.languages.edges) {
      const lang = edge.node.name;
      languageMap[lang] = (languageMap[lang] || 0) + edge.size;
    }
  }

  const totalBytes = Object.values(languageMap).reduce((a, b) => a + b, 0);

  const topLanguages = Object.entries(languageMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, size], i) => ({
      name,
      size,
      percentage: totalBytes ? ((size / totalBytes) * 100).toFixed(1) : "0.0",
      color: languageColors[i % languageColors.length]
    }));

  return { commitsThisMonth, topLanguages };
}

function generateSVG({ commitsThisMonth, topLanguages }, theme) {
  const isDark = theme === "dark";
  const svgWidth = 500;
  const padding = 16;
  const textSize = 14;
  const lineSpacing = 24;

  const bgColor = isDark ? "#0d1117" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#24292f";

  // Bar dimensions
  const barHeight = 12;
  const barWidth = svgWidth - 2 * padding;
  const barRx = 6;
  const gap = 2;

  // Layout: equal gap above and below bar
  const textY1 = padding + textSize;
  const sectionGap = lineSpacing;
  const barY = textY1 + sectionGap;

  // Bar segments clipped to rounded rect
  let xOffset = padding;
  let barSegments = "";
  topLanguages.forEach(lang => {
    const segWidth = (parseFloat(lang.percentage) / 100) * (barWidth - gap * (topLanguages.length - 1));
    barSegments += `    <rect x="${xOffset.toFixed(2)}" y="${barY}" width="${segWidth.toFixed(2)}" height="${barHeight}" fill="${lang.color}" />\n`;
    xOffset += segWidth + gap;
  });

  // Language labels, 3 per row
  const labelsStartY = barY + barHeight + sectionGap;
  const perLine = 3;
  const lines = Math.ceil(topLanguages.length / perLine);
  let labels = "";
  for (let i = 0; i < lines; i++) {
    const lineLangs = topLanguages.slice(i * perLine, i * perLine + perLine);
    const spacePerLang = (svgWidth - 2 * padding) / perLine;
    lineLangs.forEach((lang, idx) => {
      const x = padding + idx * spacePerLang;
      const y = labelsStartY + i * lineSpacing;
      labels += `  <circle cx="${x + 5}" cy="${y - 5}" r="5" fill="${lang.color}" />\n`;
      labels += `  <text x="${x + 15}" y="${y}" fill="${textColor}" font-size="${textSize}">${lang.name} ${lang.percentage}%</text>\n`;
    });
  }

  const svgHeight = labelsStartY + lines * lineSpacing + padding;

  const borderRect = isDark
    ? ""
    : `  <rect x="0.5" y="0.5" width="${svgWidth - 1}" height="${svgHeight - 1}" rx="16" fill="none" stroke="#000000" stroke-width="1"/>\n`;

  return `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="bar-clip">
      <rect x="${padding}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${barRx}" />
    </clipPath>
  </defs>
  <rect width="${svgWidth}" height="${svgHeight}" fill="${bgColor}" rx="16"/>
${borderRect}  <text x="${padding}" y="${textY1}" fill="${textColor}" font-size="${textSize}">Commits this month: ${commitsThisMonth}</text>
  <g clip-path="url(#bar-clip)">
${barSegments}  </g>
${labels}</svg>`;
}

async function main() {
  try {
    const data = await fetchData();
    fs.writeFileSync("stats-dark.svg", generateSVG(data, "dark"));
    fs.writeFileSync("stats-light.svg", generateSVG(data, "light"));
    console.log("SVGs generated successfully.");
  } catch (err) {
    console.error("Error generating SVG:", err);
    process.exit(1);
  }
}

main();
