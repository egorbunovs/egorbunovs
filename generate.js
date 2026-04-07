import fs from "fs";

const svg = `
<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <text x="20" y="100" fill="white">It works</text>
</svg>
`;

fs.writeFileSync("stats.svg", svg);