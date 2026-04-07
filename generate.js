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
  let userData = null; // <-- store user info here

  do {
    const res = await client(`
      query($username: String!, $after: String) {
        user(login: $username) {
          contributionsCollection {
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
    `, { username, after });

    if (!res.user) {
      throw new Error(`User "${username}" not found or token cannot access user data`);
    }

    // Save contributions info (same for all pages)
    if (!userData) userData = res.user;

    allRepos = allRepos.concat(res.user.repositories.nodes);
    after = res.user.repositories.pageInfo.hasNextPage
      ? res.user.repositories.pageInfo.endCursor
      : null;

  } while (after);

  const totalCommits = userData?.contributionsCollection?.totalCommitContributions || 0;
  const repoCount = allRepos.length;

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

  return { totalCommits, repoCount, topLanguages };
}

function generateSVG({ totalCommits, repoCount, topLanguages }) {
  const svgWidth = 500;
  const padding = 16;
  const textSize = 14;
  const lineSpacing = 24; // equal spacing between lines

  // Language bar
  const barHeight = 14;
  const barY = padding + lineSpacing * 2; // below commits & repos
  const gap = 2; // 2px gap between segments

  let xOffset = padding;
  let barSegments = '';

  topLanguages.slice(0, 9).forEach(lang => {
    const width = (parseFloat(lang.percentage) / 100) * (svgWidth - 2 * padding - gap * (topLanguages.length - 1));
    barSegments += `<rect x="${xOffset}" y="${barY}" width="${width}" height="${barHeight}" fill="${lang.color}" rx="7" />\n`;
    xOffset += width + gap;
  });

  // Language labels, 3 per line, evenly spaced
  const labelsStartY = barY + barHeight + lineSpacing;
  const perLine = 3;
  const lines = Math.ceil(topLanguages.length / perLine);
  let labels = '';

  for (let i = 0; i < lines; i++) {
    const lineLangs = topLanguages.slice(i * perLine, i * perLine + perLine);
    const spacePerLang = (svgWidth - 2 * padding) / perLine;
    lineLangs.forEach((lang, idx) => {
      const x = padding + idx * spacePerLang;
      const y = labelsStartY + i * lineSpacing;
      labels += `<circle cx="${x + 5}" cy="${y - 5}" r="5" fill="${lang.color}" />`;
      labels += `<text x="${x + 15}" y="${y}" fill="white" font-size="${textSize}">${lang.name} ${lang.percentage}%</text>\n`;
    });
  }

  const svgHeight = labelsStartY + lines * lineSpacing + padding;

  return `
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <text x="${padding}" y="${padding + textSize}" fill="white" font-size="${textSize}">Commits: ${totalCommits}</text>
  <text x="${padding}" y="${padding + textSize + lineSpacing}" fill="white" font-size="${textSize}">Repos: ${repoCount}</text>
  ${barSegments}
  ${labels}
</svg>
  `;
}

async function main() {
  try {
    const data = await fetchData();
    const svg = generateSVG(data);
    fs.writeFileSync("stats.svg", svg);
    console.log("SVG generated successfully.");
  } catch (err) {
    console.error("Error generating SVG:", err);
    process.exit(1);
  }
}

main();