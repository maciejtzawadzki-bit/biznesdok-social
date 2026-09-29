// Podgląd tygodnia dla właściciela (weto): node tools/preview.mjs <data-poniedziałku RRRR-MM-DD>
// Renderuje wszystkie posty z kolejki z pn–nd tego tygodnia i skleja je w preview/tydzien-<data>.png.
import { readdir, readFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { renderPost, chromiumPath } from "./render.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const monday = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(monday ?? "")) {
  console.error("Użycie: node tools/preview.mjs RRRR-MM-DD (poniedziałek)");
  process.exit(1);
}
const end = new Date(Date.parse(monday) + 6 * 86_400_000).toISOString().slice(0, 10);
const tmp = path.join(os.tmpdir(), `preview-${monday}`);
const files = [];
for (const f of (await readdir(path.join(ROOT, "queue"))).sort()) {
  const post = JSON.parse(await readFile(path.join(ROOT, "queue", f), "utf8"));
  if (post.date < monday || post.date > end || post.status === "vetoed") continue;
  files.push(...(await renderPost(post, tmp)).map((file) => ({ file, post })));
}
const cells = files
  .map(({ file, post }) => `<figure><img src="data:image/png;base64,${readFileSync(file).toString("base64")}"><figcaption><b>${post.date} ${post.time}</b> · ${post.type}<br>${path.basename(file, ".png")}</figcaption></figure>`)
  .join("");
await mkdir(path.join(ROOT, "preview"), { recursive: true });
const out = path.join(ROOT, "preview", `tydzien-${monday}.png`);
const browser = await chromium.launch({ executablePath: chromiumPath() });
const page = await browser.newPage({ viewport: { width: 1800, height: 800 } });
await page.setContent(`<style>body{margin:0;padding:30px;background:#ECEBE8;font:14px sans-serif;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}figure{margin:0;width:260px}img{width:260px;border:1px solid #ccc;border-radius:6px;display:block}figcaption{margin-top:6px;color:#444;word-break:break-all}</style>${cells}`);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
