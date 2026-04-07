import fs from "fs";
import { graphql } from "@octokit/graphql";

const username = process.env.USERNAME;

const client = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

async function fetchData() {
  // First, fetch total commits, repo count, and languages per repo
  const reposQuery = await client(`
    query($username: String!, $after: String) {
      user(login: $username) {
        contributionsCollection {
          totalCommitContributions
        }
        repositories(first: 100, ownerAffiliations: OWNER, after: $after) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            name
            languages(first: 10) {
              edges {
                size
                node {
                  name
                }
              }
            }
          }
        }
      }
    }
  `, { username, after: null });

  const totalCommits = reposQuery.user.contributionsCollection.totalCommitContributions;
  const repoCount = reposQuery.user.repositories.totalCount;

  // Collect language sizes
  const languageMap = {};
  let repos = reposQuery.user.repositories.nodes;
  let pageInfo = reposQuery.user.repositories.pageInfo;

  // Pagination for more than 100 repos
  let afterCursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  while (afterCursor) {
    const nextPage = await client(`
      query($username: String!, $after: String) {
        user(login: $username) {
          repositories(first: 100, ownerAffiliations: OWNER, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              languages(first: 10) {
                edges {
                  size
                  node {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `, { username, after: afterCursor });

    repos = repos.concat(nextPage.user.repositories.nodes);
    pageInfo = nextPage.user.repositories.pageInfo;
    afterCursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  }

  for (const repo of repos) {
    if (!repo.languages) continue;
    for (const edge of repo.languages.edges) {
      const lang = edge.node.name;
      const size = edge.size;
      languageMap[lang] = (languageMap[lang] || 0) + size;
    }
  }

  // Get top 10 languages
  const topLanguages = Object.entries(languageMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  return { totalCommits, repoCount, topLanguages };
}

function generateSVG({ totalCommits, repoCount, topLanguages }) {
  return `
<svg width="500" height="${200 + topLanguages.length * 30}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <text x="20" y="40" fill="white" font-size="20">Commits: ${totalCommits}</text>
  <text x="20" y="80" fill="white" font-size="20">Repos: ${repoCount}</text>
  <text x="20" y="120" fill="white" font-size="20">Top Languages:</text>
  ${topLanguages.map((lang, i) => `<text x="40" y="${150 + i * 30}" fill="white" font-size="18">${i + 1}. ${lang}</text>`).join("\n")}
</svg>
`;
}

async function main() {
  const data = await fetchData();
  const svg = generateSVG(data);
  fs.writeFileSync("stats.svg", svg);
}

main();