// Kontrola repo przed scaleniem i po każdym pushu: JSON kolejki, LinkedIn i listy wideo,
// pliki wideo z kolejki obecne w media/video/ i na liście zatwierdzonych, limit 20 MB (jsDelivr),
// lista oferty i serii AI (data/oferta.json, data/seria-ai.json) oraz twarde uwagi kontroli treści
// dla zaplanowanych postów od dziś (decyzja właściciela 20.10.2026: zasady pilnowane na bieżąco).
// Użycie: node tools/check.mjs
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ocenPost } from "./kontrola.mjs";
import { dzisWarszawa, wczytajOferte, wczytajPosty, wczytajSerieAI } from "./tematy.mjs";

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

// data/oferta.json — jedno źródło tematów (rodzaj, priorytet, okresy, fakty).
const oferta = await readJson(path.join(ROOT, "data", "oferta.json"));
const RODZAJE = new Set(["dokument", "narzedzie", "poradnik", "subskrypcja"]);
const tematy = new Set();
for (const p of oferta?.pozycje ?? []) {
  const gdzie = `data/oferta.json: ${p.temat ?? "(bez tematu)"}`;
  if (!p.temat || tematy.has(p.temat)) errors.push(`${gdzie}: brak albo powtórzony temat`);
  tematy.add(p.temat);
  if (!RODZAJE.has(p.rodzaj)) errors.push(`${gdzie}: nieznany rodzaj ${p.rodzaj}`);
  if (!["A", "B", "C"].includes(p.priorytet)) errors.push(`${gdzie}: priorytet musi być A, B albo C`);
  if (!String(p.link ?? "").startsWith("https://biznesdok.pl/")) errors.push(`${gdzie}: link poza biznesdok.pl`);
  for (const o of p.sezon ?? []) if (!/^\d{2}-\d{2}$/.test(o.od ?? "") || !/^\d{2}-\d{2}$/.test(o.do ?? "")) errors.push(`${gdzie}: okres w formacie MM-DD`);
  if (!p.wstrzymany && !(p.fakty ?? []).length) errors.push(`${gdzie}: brak faktów do postów`);
}
// data/seria-ai.json — seria „AI zawiodło? Decyduje prawnik”.
const seriaAI = await readJson(path.join(ROOT, "data", "seria-ai.json"));
for (const t of seriaAI?.tematy ?? []) {
  if (!t.id || !t.fakt || !String(t.zrodlo ?? "").startsWith("https://biznesdok.pl/")) errors.push(`data/seria-ai.json: ${t.id ?? "?"} — id, fakt i źródło na biznesdok.pl są obowiązkowe`);
  if (t.rozwiazanie && !tematy.has(t.rozwiazanie)) errors.push(`data/seria-ai.json: ${t.id} — rozwiązanie „${t.rozwiazanie}” spoza oferty`);
}

// Zaplanowane posty od dziś: twarde uwagi kontroli treści (takie posty i tak nie wyjdą z publikatora).
const dzis = dzisWarszawa();
const kontekst = { wszystkie: wczytajPosty(ROOT), oferta: wczytajOferte(ROOT), seria: wczytajSerieAI(ROOT) };
for (const { kanal, post } of kontekst.wszystkie) {
  if (post.status !== "planned" || post.usunieto || post.date < dzis) continue;
  for (const u of ocenPost(post, kanal, dzis, kontekst).twarde) errors.push(`${kanal === "linkedin" ? "linkedin" : "queue"}/${post.id}: ${u}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("OK — kolejka, LinkedIn, wideo, oferta i seria AI poprawne; zaplanowane posty bez blokujących uwag");
