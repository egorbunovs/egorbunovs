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

    allRepos = allRepos.concat(res.user.repositories.nodes);
    after = res.user.repositories.pageInfo.hasNextPage
      ? res.user.repositories.pageInfo.endCursor
      : null;

  } while (after);

  // Total commits
  const totalCommits = res.user?.contributionsCollection?.totalCommitContributions || 0;

  // Total repos
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
  const padding = 20;

  // Language bar
  let xOffset = padding;
  const barHeight = 20;
  const barY = 150;

  let barSegments = '';
  topLanguages.forEach(lang => {
    const width = (parseFloat(lang.percentage) / 100) * (svgWidth - 2 * padding);
    barSegments += `<rect x="${xOffset}" y="${barY}" width="${width}" height="${barHeight}" fill="${lang.color}" />\n`;
    xOffset += width;
  });

  // Language labels
  let labels = '';
  let currentX = padding;
  let currentY = barY + barHeight + 30;
  const lineHeight = 25;
  topLanguages.forEach(lang => {
    const text = `${lang.name} ${lang.percentage}%`;
    const textWidth = text.length * 8 + 20; // approximate width
    if (currentX + textWidth > svgWidth - padding) {
      currentX = padding;
      currentY += lineHeight;
    }
    labels += `<circle cx="${currentX + 5}" cy="${currentY - 5}" r="5" fill="${lang.color}" />`;
    labels += `<text x="${currentX + 15}" y="${currentY}" fill="white" font-size="14">${text}</text>\n`;
    currentX += textWidth + 10;
  });

  const svgHeight = currentY + padding;

  return `
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <text x="${padding}" y="40" fill="white" font-size="20">Commits: ${totalCommits}</text>
  <text x="${padding}" y="80" fill="white" font-size="20">Repos: ${repoCount}</text>
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