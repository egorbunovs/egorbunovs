// Run with: node preview.js
// Then click Refresh in preview.html to see the result.

// Commit values shown in the avatar sheet row
const SHEET_COMMITS = [0, 25, 49, 75, 100];

import fs from "fs";

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

// ---- copied from generate.js (keep in sync) ----

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return `#${f(0).toString(16).padStart(2, '0')}${f(8).toString(16).padStart(2, '0')}${f(4).toString(16).padStart(2, '0')}`;
}

function createRng(seed) {
  let s = ((seed ^ 0xdeadbeef) + 1) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

// idSuffix makes the clipPath ID unique — pass theme for single-avatar SVGs,
// or a unique string (e.g. "dark-2") when multiple avatars share one SVG.
function generateAvatar(commits, idSuffix, ax, ay) {
  commits = Math.max(0, Math.min(100, commits));
  const rng = createRng(commits);
  const fn = n => +n.toFixed(1);
  const SIZE = 64;
  const ocx = ax + SIZE / 2;
  const ocy = ay + SIZE / 2;
  const clipId = `avatar-clip-${idSuffix}`;

  const t = commits / 100; // normalised 0→1

  // Random HSL colors — background: dark & saturated; face shape: lighter, contrasting hue
  const bgHue = rng() * 360;
  const bgColor = hslToHex(bgHue, 40 + rng() * 40, 15 + rng() * 30);
  const faceHue = (bgHue + 100 + rng() * 160) % 360;
  const faceSat = 50 + rng() * 40;
  const faceLight = 55 + rng() * 25;
  const faceColor = hslToHex(faceHue, faceSat, faceLight);
  const markColor = faceLight > 55 ? '#1a1a1a' : '#ffffff'; // dark on light face, white on dark
  const borderColor = hslToHex(5 + t * 140, 50, 42); // calm red → calm green

  const fcx = fn(ocx + (rng() - 0.5) * 20);
  const fcy = fn(ocy + (rng() - 0.5) * 16);

  const shapeType = Math.floor(rng() * 4);
  let faceShape;

  if (shapeType === 0) {
    const w = fn(44 + rng() * 12);
    const h = fn(44 + rng() * 12);
    const r = fn(3 + rng() * 12);
    faceShape = `<rect x="${fn(fcx - w / 2)}" y="${fn(fcy - h / 2)}" width="${w}" height="${h}" rx="${r}" fill="${faceColor}"/>`;
  } else if (shapeType === 1) {
    const rx = fn(20 + rng() * 10);
    const ry = fn(20 + rng() * 10);
    faceShape = `<ellipse cx="${fcx}" cy="${fcy}" rx="${rx}" ry="${ry}" fill="${faceColor}"/>`;
  } else if (shapeType === 2) {
    const size = fn(44 + rng() * 12);
    const r = fn(2 + rng() * 5);
    const angle = fn(20 + rng() * 40);
    faceShape = `<rect x="${fn(fcx - size / 2)}" y="${fn(fcy - size / 2)}" width="${size}" height="${size}" rx="${r}" transform="rotate(${angle} ${fcx} ${fcy})" fill="${faceColor}"/>`;
  } else {
    const sides = 5 + Math.floor(rng() * 2);
    const baseR = 36 + rng() * 10;
    const startAngle = rng() * Math.PI * 2;
    const pts = Array.from({ length: sides }, (_, i) => {
      const angle = startAngle + (i / sides) * Math.PI * 2;
      const r = baseR * (0.7 + rng() * 0.3);
      return [fcx + r * Math.cos(angle), fcy + r * Math.sin(angle)];
    });
    const mids = pts.map((p, i) => {
      const q = pts[(i + 1) % sides];
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    });
    let d = `M ${fn(mids[0][0])},${fn(mids[0][1])}`;
    for (let i = 0; i < sides; i++) {
      const ctrl = pts[(i + 1) % sides];
      const end = mids[(i + 1) % sides];
      d += ` Q ${fn(ctrl[0])},${fn(ctrl[1])} ${fn(end[0])},${fn(end[1])}`;
    }
    faceShape = `<path d="${d} Z" fill="${faceColor}"/>`;
  }

  // Eyes — vertical ellipses: taller than wide, grow vertically with commits
  // Max height diameter = 6px (ry max = 3), width stays narrow
  const eyeRx = fn(1.5 + t * 0.5);      // 1 → 1.5 (stays narrow)
  const eyeRy = fn(1.5 + t * 3);        // 1 → 4  (diameter 2 → 8)
  const eyeY = fn(fcy - 5);
  const eyeSpread = fn(8 + rng() * 2); // further apart
  const eyes = `<ellipse cx="${fn(fcx - eyeSpread)}" cy="${eyeY}" rx="${eyeRx}" ry="${eyeRy}" fill="${markColor}"/>
  <ellipse cx="${fn(fcx + eyeSpread)}" cy="${eyeY}" rx="${eyeRx}" ry="${eyeRy}" fill="${markColor}"/>`;

  const mouthY = fcy + 6;
  const hw = fn(5 + t * 6); // 5 → 11 across full range
  let mouth;
  if (commits === 0) {
    mouth = `<line x1="${fn(fcx - hw)}" y1="${fn(mouthY)}" x2="${fn(fcx + hw)}" y2="${fn(mouthY)}" stroke="${markColor}" stroke-width="1.5" stroke-linecap="round"/>`;
  } else if (commits < 30) {
    const curve = fn((commits / 30) * 5);
    mouth = `<path d="M ${fn(fcx - hw)},${fn(mouthY)} Q ${fcx},${fn(mouthY + curve)} ${fn(fcx + hw)},${fn(mouthY)}" fill="none" stroke="${markColor}" stroke-width="1.5" stroke-linecap="round"/>`;
  } else {
    const arcH = fn(7 + t * 9);
    mouth = `<path d="M ${fn(fcx - hw)},${fn(mouthY)} Q ${fcx},${fn(mouthY + arcH)} ${fn(fcx + hw)},${fn(mouthY)} Z" fill="${markColor}"/>`;
  }

  return {
    defs: `<clipPath id="${clipId}">
      <circle cx="${ocx}" cy="${ocy}" r="${SIZE / 2}"/>
    </clipPath>`,
    content: `<circle cx="${ocx}" cy="${ocy}" r="${SIZE / 2}" fill="${bgColor}"/>
  <g clip-path="url(#${clipId})">
    ${faceShape}
  </g>
  ${eyes}
  ${mouth}
  <circle cx="${ocx}" cy="${ocy}" r="${SIZE / 2 - 1}" fill="none" stroke="${borderColor}" stroke-width="2"/>`
  };
}

function generateSVG({ commitsLast30Days, topLanguages }, theme) {
  topLanguages = topLanguages.slice(0, 9);
  const isDark = theme === "dark";
  const svgWidth = 500;
  const svgCorners = 8;
  const padding = 16;
  const font = "'Segoe UI', Segoe, sans-serif";

  const commitsFontSize = 16;
  const labelFontSize = 14;
  const textGap = 16;
  const lineSpacing = 22;
  const semiBold = 600;

  const bgColor = isDark ? "#0d1117" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#24292f";
  const percentColor = isDark ? "#8b949e" : "#6e7681";

  const barHeight = 12;
  const barWidth = svgWidth - 2 * padding;
  const barRx = 6;
  const gap = 2;

  const avatarSize = 64;
  const avatarX = (svgWidth - avatarSize) / 2;
  const avatarY = padding;
  const avatarGap = 12;

  const avatar = generateAvatar(commitsLast30Days, theme, avatarX, avatarY);

  const commitsTextY = avatarY + avatarSize + avatarGap;
  const barY = commitsTextY + commitsFontSize + textGap;
  const labelsStartY = barY + barHeight + textGap;

  let xOffset = padding;
  let barSegments = "";
  topLanguages.forEach(lang => {
    const segWidth = (parseFloat(lang.percentage) / 100) * (barWidth - gap * (topLanguages.length - 1));
    barSegments += `    <rect x="${xOffset.toFixed(2)}" y="${barY}" width="${segWidth.toFixed(2)}" height="${barHeight}" fill="${lang.color}" />\n`;
    xOffset += segWidth + gap;
  });

  const perLine = 3;
  const lines = Math.ceil(topLanguages.length / perLine);
  let labels = "";
  for (let i = 0; i < lines; i++) {
    const lineLangs = topLanguages.slice(i * perLine, i * perLine + perLine);
    const spacePerLang = (svgWidth - 2 * padding) / perLine;
    lineLangs.forEach((lang, idx) => {
      const x = padding + idx * spacePerLang;
      const y = labelsStartY + i * lineSpacing;
      labels += `  <circle cx="${x + 5}" cy="${y + labelFontSize / 2}" r="5" fill="${lang.color}" />\n`;
      labels += `  <text x="${x + 15}" y="${y}" fill="${textColor}" font-size="${labelFontSize}" font-family="${font}" dominant-baseline="hanging"><tspan font-weight="${semiBold}">${lang.name}</tspan><tspan fill="${percentColor}"> ${lang.percentage}%</tspan></text>\n`;
    });
  }

  const svgHeight = labelsStartY + lines * lineSpacing + padding;

  const borderRect = isDark
    ? ""
    : `  <rect x="0.5" y="0.5" width="${svgWidth - 1}" height="${svgHeight - 1}" rx="${svgCorners}" fill="none" stroke="#E5E7EB" stroke-width="1"/>\n`;

  return `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${avatar.defs}
    <clipPath id="bar-clip">
      <rect x="${padding}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="${barRx}" />
    </clipPath>
  </defs>
  <rect width="${svgWidth}" height="${svgHeight}" fill="${bgColor}" rx="${svgCorners}"/>
${borderRect}  ${avatar.content}
  <text x="${svgWidth / 2}" y="${commitsTextY}" fill="${textColor}" font-size="${commitsFontSize}" font-family="${font}" dominant-baseline="hanging" text-anchor="middle">Commits in last 30 days: <tspan font-weight="${semiBold}">${commitsLast30Days}</tspan></text>
  <g clip-path="url(#bar-clip)">
${barSegments}  </g>
${labels}</svg>`;
}

function generateAvatarSheet(commitValues, theme) {
  const isDark = theme === "dark";
  const svgWidth = 500;
  const svgCorners = 8;
  const padding = 16;
  const font = "'Segoe UI', Segoe, sans-serif";
  const avSize = 64;
  const labelFontSize = 11;
  const labelGap = 8;

  const bgColor = isDark ? "#0d1117" : "#ffffff";
  const textColor = isDark ? "#8b949e" : "#6e7681";

  // Evenly space avatars across the full width
  const usable = svgWidth - 2 * padding;
  const gap = (usable - commitValues.length * avSize) / (commitValues.length - 1);
  const svgHeight = padding + avSize + labelGap + labelFontSize + padding;

  let defs = "";
  let content = "";

  commitValues.forEach((commits, i) => {
    const ax = padding + i * (avSize + gap);
    const ay = padding;
    const avatar = generateAvatar(commits, `${theme}-${i}`, ax, ay);
    defs += `    ${avatar.defs}\n`;
    content += `  ${avatar.content}\n`;

    // Commit count label centered below each avatar
    const lx = +(ax + avSize / 2).toFixed(1);
    const ly = ay + avSize + labelGap;
    content += `  <text x="${lx}" y="${ly}" fill="${textColor}" font-size="${labelFontSize}" font-family="${font}" text-anchor="middle" dominant-baseline="hanging">${commits}</text>\n`;
  });

  const borderRect = isDark
    ? ""
    : `  <rect x="0.5" y="0.5" width="${svgWidth - 1}" height="${svgHeight - 1}" rx="${svgCorners}" fill="none" stroke="#E5E7EB" stroke-width="1"/>\n`;

  return `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
${defs}  </defs>
  <rect width="${svgWidth}" height="${svgHeight}" fill="${bgColor}" rx="${svgCorners}"/>
${borderRect}${content}</svg>`;
}

function generateAllAvatars(theme) {
  const isDark = theme === "dark";
  const avSize = 64;
  const cols = 10;
  const gap = 4;
  const padding = 16;
  const svgWidth = 2 * padding + cols * avSize + (cols - 1) * gap;
  const rows = 10;
  const svgHeight = 2 * padding + rows * avSize + (rows - 1) * gap;
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
    const ay = padding + row * (avSize + gap);
    const avatar = generateAvatar(i, `${theme}-all-${i}`, ax, ay);
    defs += `    ${avatar.defs}\n`;
    content += `  ${avatar.content}\n`;
    // Small commit-count label in top-left corner of each cell
    content += `  <text x="${ax + 3}" y="${ay + 3}" fill="${labelColor}" font-size="7" font-family="${font}" dominant-baseline="hanging">${i}</text>\n`;
  }

  return `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
${defs}  </defs>
  <rect width="${svgWidth}" height="${svgHeight}" fill="${bgColor}" rx="${svgCorners}"/>
${borderRect}${content}</svg>`;
}

// ---- end copy ----

for (const { id, data } of MOCK_CASES) {
  fs.writeFileSync(`stats-${id}-dark.svg`,  generateSVG(data, "dark"));
  fs.writeFileSync(`stats-${id}-light.svg`, generateSVG(data, "light"));
}
fs.writeFileSync("avatars-dark.svg",  generateAvatarSheet(SHEET_COMMITS, "dark"));
fs.writeFileSync("avatars-light.svg", generateAvatarSheet(SHEET_COMMITS, "light"));
fs.writeFileSync("all-dark.svg",      generateAllAvatars("dark"));
fs.writeFileSync("all-light.svg",     generateAllAvatars("light"));
console.log("Preview SVGs written. Refresh preview.html.");
