import fs from "fs";
import { graphql } from "@octokit/graphql";

const username = process.env.USERNAME;

const client = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

async function fetchData() {
  const data = await client(`
    query {
      user(login: "${username}") {
        contributionsCollection {
          totalCommitContributions
        }
        repositories(first: 1, ownerAffiliations: OWNER) {
          totalCount
        }
      }
    }
  `);

  return {
    totalCommits: data.user.contributionsCollection.totalCommitContributions,
    repoCount: data.user.repositories.totalCount,
  };
}

function generateSVG({ totalCommits, repoCount }) {
  return `
<svg width="500" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <text x="20" y="80" fill="white" font-size="20">
    Commits: ${totalCommits}
  </text>
  <text x="20" y="120" fill="white" font-size="20">
    Repos: ${repoCount}
  </text>
</svg>
`;
}

async function main() {
  const data = await fetchData();

  const svg = generateSVG(data);

  fs.writeFileSync("stats.svg", svg);
}

main();