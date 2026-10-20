#!/usr/bin/env node
// Regenerates the crawler-facing copy from content/features.json so it can't
// go stale when a feature ships. Runs before every build (npm run build) and
// on its own with `npm run seo`. Pass --check to exit 1 instead of writing
// when anything is out of date.
//
// Generated:
//   public/index.html     the hidden #landing block between <!-- seo:start -->
//                         and <!-- seo:end -->, and the two JSON-LD blocks
//                         between <!-- seo:jsonld:start --> and <!-- seo:jsonld:end -->
//   public/llms.txt       the whole file
//   public/changelog.html the dated list between <!-- seo:start --> and
//                         <!-- seo:end -->, and the footer date between
//                         <!-- seo:updated:start --> and <!-- seo:updated:end -->
//   public/sitemap.xml    every <lastmod>, from each page's last git commit
//
// Nothing a visitor to the app can see is touched: the landing block is
// hidden once React mounts (body.app-mounted), and the other files are
// static pages the app never links to. The README feature list is not
// generated; update it by hand.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'content/features.json';
const CHECK = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// Helpers

const readFile = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

// Keep each file's own line endings so a Windows checkout doesn't churn
const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');
const withEol = (text, eol) => text.replace(/\r?\n/g, eol);

let changed = 0;
const writeFile = (file, next) => {
  const full = path.join(ROOT, file);
  const current = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  const output = withEol(next, current ? eolOf(current) : '\n');
  if (output === current) return;
  changed += 1;
  if (CHECK) {
    console.error(`generate-seo: ${file} is out of date`);
    return;
  }
  fs.writeFileSync(full, output);
  console.log(`generate-seo: wrote ${file}`);
};

// For text nodes only (quotes are fine there); attribute values are URLs from the source file
const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Plain text with bare URLs turned into links. The link text drops the
// scheme, and the root URL's trailing slash, so it reads like the old
// hand-written copy ("taskr-todo.vercel.app").
const linkify = (text) =>
  escapeHtml(text).replace(/https?:\/\/[^\s<"]+?(?=[.,;:)]*(?:\s|$))/g, (url) => {
    const label = url.replace(/^https?:\/\//, '').replace(/^([^/]+)\/$/, '$1');
    return `<a href="${url}">${label}</a>`;
  });

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const assertIsoDate = (value, where) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${where}: date must be YYYY-MM-DD, got ${JSON.stringify(value)}`);
  return value;
};
const parts = (iso) => iso.split('-').map(Number);
// "17 Oct 2026"
const shortDate = (iso) => { const [y, m, d] = parts(iso); return `${d} ${MONTHS_SHORT[m - 1]} ${y}`; };
// "17 October 2026"
const longDate = (iso) => { const [y, m, d] = parts(iso); return `${d} ${MONTHS_LONG[m - 1]} ${y}`; };
const maxDate = (dates) => dates.filter(Boolean).sort().at(-1) ?? null;

// Replace what sits between two marker comments, keeping the markers and
// the indentation of the start marker's line.
const replaceBetween = (text, start, end, body, file) => {
  const startAt = text.indexOf(start);
  const endAt = text.indexOf(end);
  if (startAt < 0 || endAt < 0 || endAt < startAt) {
    throw new Error(`${file}: expected ${start} followed by ${end}`);
  }
  const lineStart = text.lastIndexOf('\n', startAt) + 1;
  const indent = text.slice(lineStart, startAt).match(/^[ \t]*/)[0];
  const indented = body
    .split('\n')
    .map((line) => (line ? indent + line : line))
    .join('\n');
  return text.slice(0, startAt + start.length) + '\n' + indented + '\n' + indent + text.slice(endAt);
};

// Last commit date (YYYY-MM-DD) of a file, or null when git or the history
// is unavailable (a fresh file, a shallow or absent clone on the build host).
const gitDate = (file) => {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ad', '--date=short', '--', file], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Source

const data = JSON.parse(readFile(SOURCE));
const { site, features, guides, faq } = data;

features.forEach((f, i) => assertIsoDate(f.shipped, `${SOURCE} features[${i}] "${f.name}"`));
data.changelog.forEach((c, i) => assertIsoDate(c.date, `${SOURCE} changelog[${i}]`));

const featureLine = (f) => `${f.name} ${f.description}`;

// Changelog rows: every feature on the day it shipped (unless it opts out
// with "changelog": null, or gives its own wording), plus the extra entries.
const changelog = [
  ...features
    .filter((f) => f.changelog !== null)
    .map((f) => ({ date: f.shipped, text: f.changelog ?? featureLine(f) })),
  ...data.changelog.map((c) => ({ date: c.date, text: c.text }))
].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // stable: newest first

const updated = maxDate(changelog.map((c) => c.date));

// ---------------------------------------------------------------------------
// public/index.html: landing block and JSON-LD

const landing = [
  `<h1>${escapeHtml(site.heading)}</h1>`,
  ...site.intro.map((p) => `<p>${linkify(p)}</p>`),
  '',
  '<h2>Features</h2>',
  '<ul>',
  ...features.map((f) => `  <li><strong>${escapeHtml(f.name)}</strong> ${escapeHtml(f.description)}</li>`),
  '</ul>',
  '',
  '<h2>Guides</h2>',
  '<ul>',
  ...guides.map((g) => `  <li><a href="${g.url}">${escapeHtml(g.title)}</a></li>`),
  '</ul>',
  '',
  '<h2>Frequently asked questions</h2>',
  ...faq.flatMap((q) => ['', `<h3>${escapeHtml(q.question)}</h3>`, `<p>${linkify(q.answer)}</p>`]),
  '',
  `<p><small>Last updated: <time datetime="${updated}">${updated}</time></small></p>`
].join('\n');

const softwareApplication = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: site.name,
  url: site.url,
  image: `${site.url}Logo.png`,
  description: site.tagline,
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requires a modern web browser with JavaScript enabled',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: features.map(featureLine),
  author: { '@type': 'Person', name: site.author.name, url: site.author.url },
  sameAs: [site.repo],
  dateModified: updated
};

const faqPage = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((q) => ({
    '@type': 'Question',
    name: q.question,
    acceptedAnswer: { '@type': 'Answer', text: q.answer }
  }))
};

// "</script" inside JSON would end the tag early; keep it harmless
const jsonLd = (obj) =>
  ['<script type="application/ld+json">', JSON.stringify(obj, null, 2).replace(/<\//g, '<\\/'), '</script>'].join('\n');

{
  const file = 'public/index.html';
  let html = readFile(file);
  html = replaceBetween(html, '<!-- seo:jsonld:start -->', '<!-- seo:jsonld:end -->', `${jsonLd(softwareApplication)}\n${jsonLd(faqPage)}`, file);
  html = replaceBetween(html, '<!-- seo:start -->', '<!-- seo:end -->', landing, file);
  writeFile(file, html);
}

// ---------------------------------------------------------------------------
// public/llms.txt

{
  const lines = [
    `# ${site.name}`,
    '',
    `> ${site.tagline}`,
    '',
    `Last updated: ${updated}`,
    '',
    ...site.intro.flatMap((p) => [p, '']),
    '## Features',
    '',
    ...features.map((f) => `- ${featureLine(f)}`),
    '',
    '## Guides',
    '',
    ...guides.map((g) => `- ${g.title}: ${g.url}`),
    '',
    '## FAQ',
    ...faq.flatMap((q) => ['', `### ${q.question}`, '', q.answer]),
    '',
    '## Links',
    '',
    `- App: ${site.url}`,
    `- Source code: ${site.repo}`,
    `- Tech: ${site.tech}`,
    ''
  ];
  writeFile('public/llms.txt', lines.join('\n'));
}

// ---------------------------------------------------------------------------
// public/changelog.html: newest first, one list per year, dated rows

{
  const file = 'public/changelog.html';
  const byYear = new Map();
  for (const entry of changelog) {
    const year = entry.date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(entry);
  }
  const list = [...byYear.entries()]
    .flatMap(([year, entries], i) => [
      ...(i ? [''] : []),
      `<h2>${year}</h2>`,
      '<ul class="log">',
      ...entries.map(
        (e) => `  <li><time datetime="${e.date}">${shortDate(e.date)}</time><span>${escapeHtml(e.text)}</span></li>`
      ),
      '</ul>'
    ])
    .join('\n');
  let html = readFile(file);
  html = replaceBetween(html, '<!-- seo:start -->', '<!-- seo:end -->', list, file);
  html = html.replace(
    /(<!-- seo:updated:start -->)[\s\S]*?(<!-- seo:updated:end -->)/,
    `$1<time datetime="${updated}">${longDate(updated)}</time>$2`
  );
  writeFile(file, html);
}

// ---------------------------------------------------------------------------
// public/sitemap.xml: lastmod from git

{
  const file = 'public/sitemap.xml';
  // Pages whose content comes from the source file change whenever it does,
  // so they are never older than the newest shipped date.
  const generated = new Set(['public/index.html', 'public/changelog.html']);
  const sourceDate = gitDate(SOURCE);
  let xml = readFile(file);
  xml = xml.replace(
    /(<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>)([^<]*)(<\/lastmod>)/g,
    (match, head, loc, current, tail) => {
      const rel = loc.replace(site.url, '');
      const page = `public/${rel === '' ? 'index.html' : rel}`;
      const candidates = [gitDate(page)];
      if (generated.has(page)) candidates.push(sourceDate, updated);
      // No git history (new file, or a build host without a clone): keep
      // what is committed, and the newest shipped date when there is nothing
      const lastmod = maxDate(candidates) || current || updated;
      return `${head}${lastmod}${tail}`;
    }
  );
  writeFile(file, xml);
}

// ---------------------------------------------------------------------------

if (CHECK && changed) {
  console.error(`generate-seo: ${changed} file(s) out of date. Run \`npm run seo\` and commit the result.`);
  process.exit(1);
}
if (!changed) console.log('generate-seo: everything up to date');
