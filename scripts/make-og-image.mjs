// Generates public/og-image.png (1200x630) for Open Graph / Twitter cards.
//
// Usage: node scripts/make-og-image.mjs
//
// The logo (public/Logo.png) is composited over a plain light background with
// the text "Taskr" and a one-line tagline. Text is set in IBM Plex Sans from
// the woff2 the app bundles: fontkit turns each glyph into an SVG path so the
// result does not depend on which fonts the build machine has installed. If
// the font cannot be loaded the text falls back to the system sans-serif.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = path.join(root, 'public', 'Logo.png');
const FONT = path.join(root, 'public', 'fonts', 'ibm-plex-sans-latin-wght-normal.woff2');
const OUT = path.join(root, 'public', 'og-image.png');

const WIDTH = 1200;
const HEIGHT = 630;
const BACKGROUND = '#e9eef3';
const TITLE = 'Taskr';
const TAGLINE = 'Free todo app. Kanban, Calendar, offline, no sign-up.';
const TITLE_SIZE = 92;
const TAGLINE_SIZE = 34;
const TITLE_COLOR = '#1a1a1f';
const TAGLINE_COLOR = '#3a3a44';
const LOGO_HEIGHT = 230;
const LOGO_TOP = 100;
const TITLE_BASELINE = 418;
const TAGLINE_BASELINE = 486;

async function loadFont() {
  try {
    const mod = await import('fontkit');
    const openSync = mod.openSync ?? mod.default?.openSync;
    const font = openSync(FONT);
    // The variable font's default instance is Regular (wght 400), the weight
    // the app uses for body text. Make sure layout works before trusting it.
    font.layout('Taskr');
    return font;
  } catch (err) {
    console.warn(`Could not load ${path.relative(root, FONT)} (${err.message}); using system sans-serif.`);
    return null;
  }
}

// Returns an SVG fragment with the text centred on `cx` and sitting on `baseline`.
function textAsPaths(font, text, size, baseline, cx, fill) {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  const width = run.advanceWidth * scale;
  let x = cx - width / 2;
  const parts = [];
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    const d = glyph.path.toSVG();
    if (d) {
      const gx = x + pos.xOffset * scale;
      const gy = baseline - pos.yOffset * scale;
      parts.push(`<path d="${d}" transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)}) scale(${scale} ${-scale})" fill="${fill}"/>`);
    }
    x += pos.xAdvance * scale;
  });
  return parts.join('\n');
}

function textAsSvgText(text, size, baseline, cx, fill) {
  return `<text x="${cx}" y="${baseline}" font-family="'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${size}" font-weight="400" fill="${fill}" text-anchor="middle">${text}</text>`;
}

async function main() {
  const font = await loadFont();
  const cx = WIDTH / 2;
  const text = font
    ? textAsPaths(font, TITLE, TITLE_SIZE, TITLE_BASELINE, cx, TITLE_COLOR) +
      '\n' +
      textAsPaths(font, TAGLINE, TAGLINE_SIZE, TAGLINE_BASELINE, cx, TAGLINE_COLOR)
    : textAsSvgText(TITLE, TITLE_SIZE, TITLE_BASELINE, cx, TITLE_COLOR) +
      '\n' +
      textAsSvgText(TAGLINE, TAGLINE_SIZE, TAGLINE_BASELINE, cx, TAGLINE_COLOR);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="${BACKGROUND}"/>
${text}
</svg>`;

  const logo = await sharp(LOGO).resize({ height: LOGO_HEIGHT }).png().toBuffer();
  const logoMeta = await sharp(logo).metadata();

  await sharp(Buffer.from(svg))
    .composite([
      {
        input: logo,
        left: Math.round((WIDTH - logoMeta.width) / 2),
        top: LOGO_TOP,
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(OUT);

  const out = await sharp(OUT).metadata();
  console.log(`Wrote ${path.relative(root, OUT)} (${out.width}x${out.height}, ${font ? 'IBM Plex Sans' : 'system sans-serif'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
