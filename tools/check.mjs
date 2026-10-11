// Kontrola repo przed scaleniem i po każdym pushu: JSON kolejki, LinkedIn i listy wideo,
// pliki wideo z kolejki obecne w media/video/ i na liście zatwierdzonych, limit 20 MB (jsDelivr).
// Użycie: node tools/check.mjs
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const TYPES = new Set(["feed", "carousel", "story", "reel"]);
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(ROOT, file)}: niepoprawny JSON (${error.message})`);
    return null;
  }
}

const catalog = await readJson(path.join(ROOT, "data", "wideo.json"));
const approved = new Set((catalog?.filmy ?? []).map((film) => film.plik));
for (const film of catalog?.filmy ?? []) {
  const file = path.join(ROOT, "media", "video", film.plik);
  if (!existsSync(file)) errors.push(`data/wideo.json: brak pliku media/video/${film.plik}`);
  else if ((await stat(file)).size > MAX_VIDEO_BYTES) errors.push(`media/video/${film.plik}: plik większy niż 20 MB`);
}

for (const dir of ["queue", "linkedin"]) {
  const full = path.join(ROOT, dir);
  if (!existsSync(full)) continue;
  for (const name of (await readdir(full)).filter((f) => f.endsWith(".json")).sort()) {
    const post = await readJson(path.join(full, name));
    if (!post) continue;
    const where = `${dir}/${name}`;
    if (post.id !== name.replace(/\.json$/, "")) errors.push(`${where}: id różne od nazwy pliku`);
    if (!TYPES.has(post.type)) errors.push(`${where}: nieznany typ ${post.type}`);
    if (post.type === "reel" && !post.video) errors.push(`${where}: reel bez pola video`);
    if (post.video && !approved.has(post.video)) errors.push(`${where}: wideo ${post.video} spoza data/wideo.json`);
    if (!post.video && !(post.slides ?? []).length) errors.push(`${where}: brak slajdów`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("OK — kolejka, LinkedIn i wideo poprawne");
