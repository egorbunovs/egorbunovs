import fs from "fs";
import { fileURLToPath } from "url";

const languageColors = [
  "#f1e05a", "#e34c26", "#563d7c", "#b07219",
  "#2b7489", "#f34b7d", "#701516", "#3572A5",
  "#438eff"
];

async function fetchData() {
  const username = process.env.USERNAME;
  if (!username) throw new Error("USERNAME environment variable is not set");
  const { graphql } = await import("@octokit/graphql");
  const client = graphql.defaults({
    headers: { authorization: `token ${process.env.GITHUB_TOKEN}` },
  });

  const now = new Date();
  const from = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();

  const res = await client(`
    query($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          commitContributionsByRepository(maxRepositories: 100) {
            repository {
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
    }
  `, { username, from, to });

  if (!res.user) {
    throw new Error(`User "${username}" not found or token cannot access user data`);
  }

  const contributions = res.user.contributionsCollection;
  const commitsLast30Days = contributions.totalCommitContributions || 0;

  const languageMap = {};
  for (const { repository } of contributions.commitContributionsByRepository) {
    if (!repository.languages) continue;
    for (const edge of repository.languages.edges) {
      const lang = edge.node.name;
      languageMap[lang] = (languageMap[lang] || 0) + edge.size;
    }
  }

  const totalBytes = Object.values(languageMap).reduce((a, b) => a + b, 0);

  const topLanguages = Object.entries(languageMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 9)
    .map(([name, size], i) => ({
      name,
      size,
      percentage: totalBytes ? ((size / totalBytes) * 100).toFixed(1) : "0.0",
      color: languageColors[i]
    }));

  return { commitsLast30Days, topLanguages };
}

// HSL → hex helper used for random avatar colors
export function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return `#${f(0).toString(16).padStart(2, '0')}${f(8).toString(16).padStart(2, '0')}${f(4).toString(16).padStart(2, '0')}`;
}

// Seeded PRNG so the avatar is deterministic per commit count
export function createRng(seed) {
  let s = ((seed ^ 0xdeadbeef) + 1) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns { defs, content } with absolute SVG coordinates (ax, ay = top-left of the 64x64 avatar)
export function generateAvatar(commits, theme, ax, ay) {
  commits = Math.max(0, Math.min(100, commits));
  const rng = createRng(commits);
  const fn = n => +n.toFixed(1);
  const SIZE = 64;
  const ocx = ax + SIZE / 2;  // absolute center x
  const ocy = ay + SIZE / 2;  // absolute center y
  const clipId = `avatar-clip-${theme}`;

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

  // Face shape center — randomly offset from avatar center
  const fcx = fn(ocx + (rng() - 0.5) * 20);
  const fcy = fn(ocy + (rng() - 0.5) * 16);

  // Random face shape — smaller than before so background always peeks through
  const shapeType = Math.floor(rng() * 4);
  let faceShape;

  if (shapeType === 0) {
    // Rounded rect
    const w = fn(44 + rng() * 12);
    const h = fn(44 + rng() * 12);
    const r = fn(3 + rng() * 12);
    faceShape = `<rect x="${fn(fcx - w / 2)}" y="${fn(fcy - h / 2)}" width="${w}" height="${h}" rx="${r}" fill="${faceColor}"/>`;
  } else if (shapeType === 1) {
    // Ellipse
    const rx = fn(20 + rng() * 10);
    const ry = fn(20 + rng() * 10);
    faceShape = `<ellipse cx="${fcx}" cy="${fcy}" rx="${rx}" ry="${ry}" fill="${faceColor}"/>`;
  } else if (shapeType === 2) {
    // Rotated rounded square
    const size = fn(44 + rng() * 12);
    const r = fn(2 + rng() * 5);
    const angle = fn(20 + rng() * 40);
    faceShape = `<rect x="${fn(fcx - size / 2)}" y="${fn(fcy - size / 2)}" width="${size}" height="${size}" rx="${r}" transform="rotate(${angle} ${fcx} ${fcy})" fill="${faceColor}"/>`;
  } else {
    // Smooth organic blob via quadratic beziers through midpoints of a random polygon
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

  // Eyes — circles 0–30, then widen by 1px and grow into vertical ellipses 30–100
  const eyeY = fn(fcy - 5);
  const eyeSpread = fn(8 + rng() * 2);
  let eyeRx, eyeRy;
  if (commits <= 30) {
    const r = fn(1.5 + (commits / 30) * 1);
    eyeRx = eyeRy = r; // circle growing 1.5 → 2.5
  } else {
    const tE = (commits - 30) / 70;
    eyeRx = fn(2.5 + tE * 0.5);  // starts 1px wider than circle, grows to 3
    eyeRy = fn(2.5 + tE * 1.5);  // grows taller to 4
  }
  const eyes = `<ellipse cx="${fn(fcx - eyeSpread)}" cy="${eyeY}" rx="${eyeRx}" ry="${eyeRy}" fill="${markColor}"/>
  <ellipse cx="${fn(fcx + eyeSpread)}" cy="${eyeY}" rx="${eyeRx}" ry="${eyeRy}" fill="${markColor}"/>`;

  // Mouth — width and depth both scale continuously with commit count
  //   0:    flat line
  //   1–49: open arc smile (curvature grows)
  //   50+:  filled D shape (wider + taller)
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

export function generateSVG({ commitsLast30Days, topLanguages }, theme) {
  topLanguages = topLanguages.slice(0, 9);
  // Normalise so bar segments always sum to 100%
  const pctSum = topLanguages.reduce((s, l) => s + parseFloat(l.percentage), 0);
  if (pctSum > 0) {
    topLanguages = topLanguages.map(l => ({
      ...l,
      percentage: ((parseFloat(l.percentage) / pctSum) * 100).toFixed(1)
    }));
  }
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

  // Avatar centered at top
  const avatarSize = 64;
  const avatarX = (svgWidth - avatarSize) / 2;
  const avatarY = padding;
  const avatarGap = 12;

  const avatar = generateAvatar(commitsLast30Days, theme, avatarX, avatarY);

  // Layout — y values are tops of text (dominant-baseline="hanging")
  const commitsTextY = avatarY + avatarSize + avatarGap;
  const barY = commitsTextY + commitsFontSize + textGap;
  const labelsStartY = barY + barHeight + textGap;

  // Bar segments
  let xOffset = padding;
  let barSegments = "";
  topLanguages.forEach(lang => {
    const segWidth = (parseFloat(lang.percentage) / 100) * (barWidth - gap * (topLanguages.length - 1));
    barSegments += `    <rect x="${xOffset.toFixed(2)}" y="${barY}" width="${segWidth.toFixed(2)}" height="${barHeight}" fill="${lang.color}" />\n`;
    xOffset += segWidth + gap;
  });

  // Language labels, 3 per row
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
