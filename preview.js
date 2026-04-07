// Run with: node preview.js
// Then click Refresh in preview.html to see the result.

import fs from "fs";
import { generateAvatar, generateSVG } from "./generate.js";

// Three test cases for the stats card
const MOCK_CASES = [
  {
    id: "c1",
    label: "Case 1 — 0 commits, 0 languages",
    data: {
      commitsLast30Days: 0,
      topLanguages: [],
    },
  },
  {
    id: "c2",
    label: "Case 2 — 16 commits, 4 languages",
    data: {
      commitsLast30Days: 16,
      topLanguages: [
        { name: "Kotlin",    percentage: "55.4", color: "#f1e05a" },
        { name: "C#",        percentage: "37.6", color: "#e34c26" },
        { name: "ShaderLab", percentage: "4.8",  color: "#563d7c" },
        { name: "C++",       percentage: "2.2",  color: "#b07219" },
      ],
    },
  },
  {
    id: "c3",
    label: "Case 3 — 1337 commits, 16 languages (only 9 shown)",
    data: {
      commitsLast30Days: 1337,
      topLanguages: [
        { name: "Kotlin",      percentage: "25.0", color: "#f1e05a" },
        { name: "C#",          percentage: "20.0", color: "#e34c26" },
        { name: "TypeScript",  percentage: "13.0", color: "#563d7c" },
        { name: "Python",      percentage: "10.0", color: "#b07219" },
        { name: "Java",        percentage: "8.0",  color: "#2b7489" },
        { name: "Rust",        percentage: "6.0",  color: "#f34b7d" },
        { name: "Go",          percentage: "5.0",  color: "#701516" },
        { name: "C++",         percentage: "4.0",  color: "#3572A5" },
        { name: "Swift",       percentage: "3.5",  color: "#438eff" },
        // The 7 below should be silently dropped by the 9-language cap
        { name: "Ruby",        percentage: "2.0",  color: "#ff6b6b" },
        { name: "PHP",         percentage: "1.2",  color: "#f7c59f" },
        { name: "Dart",        percentage: "0.8",  color: "#70d6ff" },
        { name: "Scala",       percentage: "0.6",  color: "#e9ff70" },
        { name: "Haskell",     percentage: "0.4",  color: "#ff70a6" },
        { name: "Elixir",      percentage: "0.3",  color: "#05c793" },
        { name: "Lua",         percentage: "0.2",  color: "#b185db" },
      ],
    },
  },
];

function generateAllAvatars(theme) {
  const isDark = theme === "dark";
  const avSize = 64;
  const cols = 10;
  const gap = 4;
  const labelFontSize = 12;
  const labelGap = 4;
  const cellHeight = avSize + labelGap + labelFontSize;
  const padding = 16;
  const svgWidth = 2 * padding + cols * avSize + (cols - 1) * gap;
  const rows = 10;
  const svgHeight = 2 * padding + rows * cellHeight + (rows - 1) * gap;
  const svgCorners = 8;
  const bgColor = isDark ? "#0d1117" : "#ffffff";
  const font = "'Segoe UI', Segoe, sans-serif";
  const labelColor = isDark ? "#8b949e" : "#9ca3af";

  const borderRect = isDark
    ? ""
    : `  <rect x="0.5" y="0.5" width="${svgWidth - 1}" height="${svgHeight - 1}" rx="${svgCorners}" fill="none" stroke="#E5E7EB" stroke-width="1"/>\n`;

  let defs = "";
  let content = "";

  for (let i = 0; i < 100; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ax = padding + col * (avSize + gap);
    const ay = padding + row * (cellHeight + gap);
    const avatar = generateAvatar(i, `${theme}-all-${i}`, ax, ay);
    defs += `    ${avatar.defs}\n`;
    content += `  ${avatar.content}\n`;
    // Label centered below avatar
    const lx = ax + avSize / 2;
    const ly = ay + avSize + labelGap;
    content += `  <text x="${lx}" y="${ly}" fill="${labelColor}" font-size="${labelFontSize}" font-weight="bold" font-family="${font}" text-anchor="middle" dominant-baseline="hanging">${i}</text>\n`;
  }

  return `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
${defs}  </defs>
  <rect width="${svgWidth}" height="${svgHeight}" fill="${bgColor}" rx="${svgCorners}"/>
${borderRect}${content}</svg>`;
}

for (const { id, data } of MOCK_CASES) {
  fs.writeFileSync(`stats-${id}-dark.svg`,  generateSVG(data, "dark"));
  fs.writeFileSync(`stats-${id}-light.svg`, generateSVG(data, "light"));
}
fs.writeFileSync("all-dark.svg",  generateAllAvatars("dark"));
fs.writeFileSync("all-light.svg", generateAllAvatars("light"));
console.log("Preview SVGs written. Refresh preview.html.");
