// Plan publikacji dla panelu KMZ (zakładka BiznesDOK): plan.json w katalogu głównym repo, w formacie planu Warszawy
// (warszawa-official-social, tools/plan.mjs) — biuro czyta go co godzinę z raw.githubusercontent.com.
// Użycie: node tools/plan.mjs [--bez-sieci]
// Uruchamia go automat GitHub (.github/workflows/plan.yml) po każdej zmianie kolejki i raz dziennie; ręcznie nie trzeba.
//
// Co trafia do planu: posty z queue/ (Instagram) i linkedin/ (LinkedIn) od 7 dni wstecz. Posty LinkedIn mają
// `kanal: "linkedin"`, `type: "linkedin"` i id z przedrostkiem „linkedin-” (bez kolizji z postem Instagrama).
// Miniatury slajdów postów jeszcze nieopublikowanych (od wczoraj): media/plan/<id>-NN-<skrót>.jpg, 540 px szerokości.
// To osobny katalog — publikator (run.mjs) go nie czyta ani nie zmienia. Skrót liczony z treści slajdów i renderera:
// zmiana posta daje nową nazwę, więc panel od razu dostaje nową miniaturę mimo pamięci CDN; stare miniatury znikają.
// Wideo: okładka z media/video/ (pole `poster`). Uwagi z kontroli zasad treści (tools/kontrola.mjs) — tylko przy postach
// nieopublikowanych; z siecią także sprawdzenie, czy strona z linku istnieje.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uwagaStrony, uwagiPosta } from "./kontrola.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = "https://raw.githubusercontent.com/maciejtzawadzki-bit/biznesdok-social/main/media";
const PLAN = path.join(ROOT, "media", "plan");
const SZEROKOSC = 540;
// Stan końcowy: post już wyszedł albo nie wyjdzie — bez miniatur i bez uwag.
const KONCOWE = new Set(["published", "skipped", "handed"]);
const RENDERER = createHash("sha1").update(readFileSync(path.join(ROOT, "tools", "render.mjs"))).digest("hex");

const dzisWarszawa = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
const dniPrzed = (dzien, n) => new Date(Date.parse(dzien) - n * 86_400_000).toISOString().slice(0, 10);
const bezWyroznien = (t) => String(t ?? "").replace(/\[\[|\]\]/g, "").trim();

async function wczytaj(katalog, kanal) {
  const dir = path.join(ROOT, katalog);
  if (!existsSync(dir)) return [];
  const pliki = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return Promise.all(pliki.map(async (f) => ({ kanal, post: JSON.parse(await readFile(path.join(dir, f), "utf8")) })));
}

function nazwyMiniatur(post, id) {
  const skrot = createHash("sha1")
    .update(RENDERER)
    .update(JSON.stringify({ format: post.type === "story" ? "story" : "feed", slides: post.slides }))
    .digest("hex")
    .slice(0, 8);
  return post.slides.map((_, i) => `${id}-${String(i + 1).padStart(2, "0")}-${skrot}.jpg`);
}

// Render pełnych slajdów tym samym rendererem co publikator (do katalogu tymczasowego) i zmniejszenie do JPEG.
async function zrobMiniatury(lista) {
  if (!lista.length) return;
  const { chromium } = await import("playwright-core");
  const { renderPost, chromiumPath } = await import("./render.mjs");
  const tmp = await mkdtemp(path.join(os.tmpdir(), "plan-"));
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  try {
    const page = await browser.newPage({ viewport: { width: SZEROKOSC, height: SZEROKOSC * 2 }, deviceScaleFactor: 1 });
    for (const { post, pliki } of lista) {
      for (const [i, png] of (await renderPost(post, tmp)).entries()) {
        const dane = readFileSync(png).toString("base64");
        await page.setContent(`<body style="margin:0"><img id="s" style="display:block;width:${SZEROKOSC}px" src="data:image/png;base64,${dane}"></body>`, { waitUntil: "load" });
        await page.locator("#s").screenshot({ path: pliki[i], type: "jpeg", quality: 80 });
      }
    }
  } finally {
    await browser.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

function tematWideo(plik) {
  try {
    const { filmy = [] } = JSON.parse(readFileSync(path.join(ROOT, "data", "wideo.json"), "utf8"));
    return filmy.find((f) => f.plik === plik)?.temat ?? null;
  } catch {
    return null;
  }
}

// Nagłówek i opis do panelu. Relacje nie mają opisu — panel dostaje treść grafiki albo temat urywka.
function teksty(post) {
  const opis = String(post.caption ?? "").trim();
  if (opis) return { naglowek: opis.split("\n")[0].slice(0, 160), podpis: opis.slice(0, 2400) };
  if (post.video) {
    const temat = tematWideo(post.video) ?? post.video;
    return { naglowek: `Wideo: ${temat}`.slice(0, 160), podpis: `Relacja wideo (bez opisu): ${temat}\nLink: ${post.link ?? "—"}` };
  }
  const s = post.slides?.[0] ?? {};
  const linie = [s.eyebrow, bezWyroznien(s.text), bezWyroznien(s.sub), s.note].filter(Boolean);
  return {
    naglowek: (bezWyroznien(s.text) || post.id).slice(0, 160),
    podpis: [`Relacja (bez opisu), na grafice:`, ...linie, `Link: ${post.link ?? "—"}`].join("\n").slice(0, 2400),
  };
}

export async function writePlan({ siec = true } = {}) {
  const dzis = dzisWarszawa();
  const wszystkie = [...(await wczytaj("queue", "instagram")), ...(await wczytaj("linkedin", "linkedin"))];
  // Post usunięty z kolejki (pole `usunieto`) znika z planu w panelu.
  const wPlanie = wszystkie.filter(({ post }) => !post.usunieto && post.date >= dniPrzed(dzis, 7));
  mkdirSync(PLAN, { recursive: true });
  const zostaja = new Set();
  const doZrobienia = [];
  const posty = [];
  for (const { kanal, post } of wPlanie) {
    const id = kanal === "linkedin" ? `linkedin-${post.id}` : post.id;
    const otwarty = !KONCOWE.has(post.status);
    let obrazy = [];
    if (otwarty && post.date >= dniPrzed(dzis, 1)) {
      if (post.video) {
        if (post.poster && existsSync(path.join(ROOT, "media", "video", post.poster))) obrazy = [`${RAW}/video/${post.poster}`];
      } else if ((post.slides ?? []).length) {
        const nazwy = nazwyMiniatur(post, id);
        nazwy.forEach((n) => zostaja.add(n));
        const pliki = nazwy.map((n) => path.join(PLAN, n));
        if (!pliki.every(existsSync)) doZrobienia.push({ post, pliki });
        obrazy = nazwy.map((n) => `${RAW}/plan/${n}`);
      }
    }
    const uwagi = otwarty ? [...uwagiPosta(post, kanal, dzis), ...(siec ? await uwagaStrony(post.link) : [])] : [];
    posty.push({
      id,
      kanal,
      date: post.date,
      time: post.time ?? null,
      type: kanal === "linkedin" ? "linkedin" : (post.type ?? null),
      rubric: post.pillar ?? null,
      status: post.status ?? null,
      ...teksty(post),
      link: post.link ?? null,
      obrazy,
      permalink: post.permalink ?? null,
      uwagi,
    });
  }
  await zrobMiniatury(doZrobienia);
  for (const f of readdirSync(PLAN)) if (f.endsWith(".jpg") && !zostaja.has(f)) unlinkSync(path.join(PLAN, f));
  posty.sort((a, b) => `${a.date} ${a.time} ${a.id}`.localeCompare(`${b.date} ${b.time} ${b.id}`));

  // Data aktualizacji zmienia się tylko razem z treścią planu — automat nie robi pustych commitów.
  const out = path.join(ROOT, "plan.json");
  let zaktualizowano = new Date().toISOString();
  try {
    const stary = JSON.parse(readFileSync(out, "utf8"));
    if (JSON.stringify(stary.posty) === JSON.stringify(posty)) zaktualizowano = stary.zaktualizowano;
  } catch {
    // pierwszy plan
  }
  await writeFile(out, `${JSON.stringify({ zaktualizowano, posty }, null, 2)}\n`);
  return { out, posty: posty.length, miniatury: doZrobienia.reduce((n, x) => n + x.pliki.length, 0) };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(await writePlan({ siec: !process.argv.includes("--bez-sieci") }));
