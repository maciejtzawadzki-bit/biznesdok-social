// Renderer grafik Instagram BiznesDOK: plik posta (JSON) → PNG dla każdego slajdu.
// Użycie: node render.mjs <post.json> [katalog-wyjściowy]
// Wymaga playwright-core i Chromium (PLAYWRIGHT_BROWSERS_PATH albo CHROMIUM_PATH).
// Gramatyka wizualna wynika z brandbooka FINAL (BIZNESDOK_LINKEDIN_GUIDELINES §10):
// tło paper, Instrument Serif w hasłach, clause highlight, lockup BD + BiznesDOK prawy dół.
import { readFile, mkdir } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

// Fonty marki są w repo (licencja OFL), bo renderer nie może zależeć od sieci.
const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fonts");
const FONTS = [
  ["Instrument Sans", 400, "InstrumentSans-Regular.ttf"],
  ["Instrument Sans", 600, "InstrumentSans-SemiBold.ttf"],
  ["Instrument Serif", 400, "InstrumentSerif-Regular.ttf"],
]
  .map(([family, weight, file]) => {
    const data = readFileSync(path.join(FONT_DIR, file)).toString("base64");
    return `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url(data:font/ttf;base64,${data}) format("truetype"); }`;
  })
  .join("\n");

const SIZES = { feed: [1080, 1350], story: [1080, 1920] };

// Polska typografia: krótkie przyimki i spójniki nie zostają na końcu wiersza.
const GLUE = /(^|[\s(])(w|z|i|o|u|a|we|ze|na|do|po|od|bez|dla|że|to|—)\s+/giu;
function typo(text) {
  return String(text ?? "").replace(GLUE, (_, pre, word) => `${pre}${word} `);
}
function esc(text) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
// Fraza w [[...]] dostaje clause highlight (akcent emerald-tint).
function rich(text) {
  return esc(typo(text)).replace(/\[\[(.+?)\]\]/g, '<mark>$1</mark>');
}

function slideHtml(slide, format, index, total) {
  const [W, H] = SIZES[format];
  const story = format === "story";
  const layout = slide.layout ?? "headline";
  const size = slide.size ?? (layout === "headline" ? (story ? 112 : 104) : story ? 76 : 70);
  const counter = total > 1 && !story ? `<div class="counter">${index + 1}/${total}</div>` : "";
  const eyebrow = slide.eyebrow ? `<div class="eyebrow">${esc(slide.eyebrow)}</div>` : "";
  const items = (slide.items ?? [])
    .map((item, i) => {
      const [title, text] = Array.isArray(item) ? item : [item, ""];
      return `<li><span class="num">${String(i + 1).padStart(2, "0")}</span><div><b>${rich(title)}</b>${text ? `<p>${rich(text)}</p>` : ""}</div></li>`;
    })
    .join("");
  const body =
    layout === "list"
      ? `<h1 style="font-size:${size}px">${rich(slide.text)}</h1><ol>${items}</ol>`
      : `<h1 style="font-size:${size}px">${rich(slide.text)}</h1>${slide.sub ? `<p class="sub">${rich(slide.sub)}</p>` : ""}`;
  const note = slide.note ? `<div class="note">${esc(slide.note)}</div>` : "";
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<style>
  ${FONTS}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; }
  body { background: #FCFCF9; color: #262132; font-family: "Instrument Sans", sans-serif; position: relative; overflow: hidden; }
  .wrap { position: absolute; left: 86px; right: 86px; top: ${story ? 300 : 110}px; }
  .eyebrow { font: 600 24px "Instrument Sans"; letter-spacing: 3px; text-transform: uppercase; color: #625D68; margin-bottom: ${story ? 56 : 48}px; }
  h1 { font-family: "Instrument Serif", serif; font-weight: 400; line-height: 1.06; letter-spacing: -0.5px; }
  mark { background: linear-gradient(transparent 14%, #E7F5F0 14%, #E7F5F0 94%, transparent 94%); color: inherit; padding: 0 6px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  .sub { margin-top: 44px; font-size: ${story ? 38 : 34}px; line-height: 1.35; color: #3D3747; max-width: 860px; }
  ol { list-style: none; margin-top: 48px; display: grid; gap: ${story ? 34 : 26}px; }
  li { display: grid; grid-template-columns: 64px 1fr; align-items: baseline; border-top: 1px solid #DDD9D3; padding-top: ${story ? 26 : 20}px; }
  .num { font: 600 22px "Instrument Sans"; color: #625D68; letter-spacing: 1px; }
  li b { font: 600 ${story ? 36 : 32}px/1.25 "Instrument Sans"; display: block; }
  li p { font-size: ${story ? 30 : 27}px; line-height: 1.35; color: #4A4452; margin-top: 6px; }
  .counter { position: absolute; top: 58px; right: 86px; font: 600 22px "Instrument Sans"; color: #8A8490; letter-spacing: 2px; }
  .note { position: absolute; left: 86px; bottom: ${story ? 360 : 96}px; font: 600 26px "Instrument Sans"; color: #262132; max-width: 560px; }
  .lockup { position: absolute; right: 60px; bottom: ${story ? 340 : 90}px; display: flex; align-items: center; gap: 17px; }
  .mark { width: 59px; height: 59px; border-radius: 16px; background: #262132; color: #FCFCF9; font: 24px "Instrument Serif"; display: grid; place-items: center; }
  .word { font: 31px "Instrument Serif"; }
</style></head><body>
${counter}
<div class="wrap">${eyebrow}${body}</div>
${note}
<div class="lockup"><div class="mark">BD</div><div class="word">BiznesDOK</div></div>
</body></html>`;
}

export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  const dir = existsSync(base) ? readdirSync(base).find((d) => /^chromium-\d+$/.test(d)) : null;
  return dir ? path.join(base, dir, "chrome-linux", "chrome") : undefined;
}

export async function renderPost(post, outDir) {
  const format = post.type === "story" ? "story" : "feed";
  const [W, H] = SIZES[format];
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const files = [];
  for (const [i, slide] of post.slides.entries()) {
    await page.setContent(slideHtml(slide, format, i, post.slides.length));
    const missing = await page.evaluate(async () => {
      const specs = ['16px "Instrument Sans"', '600 16px "Instrument Sans"', '16px "Instrument Serif"'];
      await Promise.all(specs.map((spec) => document.fonts.load(spec, "Ąż")));
      await document.fonts.ready;
      return specs.filter((spec) => !document.fonts.check(spec, "Ąż"));
    });
    if (missing.length) throw new Error(`Nie wczytano fontów: ${missing.join(", ")}`);
    const file = path.join(outDir, `${post.id}-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    files.push(file);
  }
  await browser.close();
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, out] = process.argv.slice(2);
  if (!input) {
    console.error("Użycie: node render.mjs <post.json> [katalog-wyjściowy]");
    process.exit(1);
  }
  const post = JSON.parse(await readFile(input, "utf8"));
  const files = await renderPost(post, out ?? path.join(path.dirname(input), "..", "rendered"));
  console.log(files.join("\n"));
}
