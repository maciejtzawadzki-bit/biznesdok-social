// Reakcje właściciela z panelu KMZ (zakładka BiznesDOK, karta „Plan publikacji”): „Wstrzymaj”, „Wznów” i „Zmień…”
// przy postach z planu, Instagram i LinkedIn. Wzór: tools/reakcje.mjs w warszawa-official-social (właściciel 19.10.2026:
// „ma działać tak jak w Warszawie”).
// Użycie (na początku trybów 1–3, zawsze przed run.mjs):
//   node tools/reakcje.mjs                         odbiera reakcje: wstrzymaj → vetoed, wznów → planned (tylko z vetoed),
//                                                  commit i push kolejki, potwierdza w panelu; „zmień” wypisuje jako
//                                                  ZMIEŃ #nr <post>: <uwaga> do wykonania przez agenta
//   node tools/reakcje.mjs --potwierdz 12 "opis"   po wykonaniu „zmień”: potwierdza reakcję nr 12 krótkim opisem
//   node tools/reakcje.mjs --dry-run               tylko wypisuje, nic nie zmienia
// run.mjs wywołuje odbierzReakcje() sam przed publikacją i nie publikuje posta, przy którym czeka „zmień”.
// Post LinkedIn ma w planie i w panelu id z przedrostkiem „linkedin-” (tools/plan.mjs), a jego plik leży w linkedin/.
// plan.json dla panelu odświeża po pushu automat GitHub (plan.yml); ten skrypt go nie zmienia.
// Klucz w zmiennej KMZ_BIZNESDOK_SEKRET (nigdy go nie wypisuj); bez niej albo bez sieci skrypt tylko to zgłasza i kończy
// z kodem 0, żeby nie zatrzymać publikacji.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADRES = "https://mnpjvkieetcrqzswxwqt.supabase.co/functions/v1/panel?instagram_reakcje";
const KATALOGI = [["queue", ""], ["linkedin", "linkedin-"]];
// Jak w run.mjs: posty w feedzie nadrabiamy do 3 dni wstecz, relacji z minionych dni nie.
const CATCH_UP_DAYS = 3;

// W chmurze adres Supabase panelu bywa osiągalny tylko przez proxy środowiska (Warszawa 14.10: „fetch failed”, ENOTFOUND),
// a wbudowany fetch Node'a proxy pomija; Node włącza je tylko przy starcie (NODE_USE_ENV_PROXY=1). Dlatego przy
// ustawionym proxy pytamy panel z osobnego procesu Node z tą zmienną, a publikator (Graph API) działa jak dotąd.
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;

async function zapytanie(method, cialo) {
  try {
    const r = await fetch(ADRES, {
      method,
      headers: { "x-kmz-biznesdok": process.env.KMZ_BIZNESDOK_SEKRET, ...(cialo ? { "Content-Type": "application/json" } : {}) },
      body: cialo || undefined,
      signal: AbortSignal.timeout(20_000),
    });
    return { status: r.status, dane: await r.json().catch(() => ({})) };
  } catch (error) {
    return { blad: [error.message, error.cause?.code].filter(Boolean).join(", ").slice(0, 200) };
  }
}
// Ta sama funkcja `zapytanie` w osobnym procesie (ciało na wejściu, wynik jako JSON na wyjściu).
const ZAPYTANIE = `
const ADRES = ${JSON.stringify(ADRES)};
${zapytanie.toString()}
let cialo = "";
for await (const c of process.stdin) cialo += c;
process.stdout.write(JSON.stringify(await zapytanie(process.argv[1], cialo)));
`;

async function panel(method, body) {
  const cialo = body ? JSON.stringify(body) : "";
  let wynik;
  if (PROXY && !process.env.NODE_USE_ENV_PROXY) {
    const w = spawnSync(process.execPath, ["--disable-warning=UNDICI-EHPA", "--input-type=module", "-e", ZAPYTANIE, method], {
      input: cialo,
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
    });
    try {
      wynik = JSON.parse(w.stdout);
    } catch {
      wynik = { blad: w.error?.message ?? `zapytanie przez proxy nie powiodło się (kod ${w.status})` };
    }
  } else {
    wynik = await zapytanie(method, cialo);
  }
  if (wynik.blad) throw new Error(wynik.blad);
  if (wynik.status < 200 || wynik.status > 299) throw new Error(`HTTP ${wynik.status}${wynik.dane?.blad ? ` (${wynik.dane.blad})` : ""}`);
  return wynik.dane;
}

function git(...cmd) {
  return execFileSync("git", ["-C", ROOT, ...cmd], { encoding: "utf8" }).trim();
}

function pushWithRetry() {
  for (const wait of [0, 2, 4, 8, 16]) {
    if (wait) execFileSync("sleep", [String(wait)]);
    try {
      git("pull", "--rebase", "-q", "origin", "main");
      git("push", "-q", "origin", "HEAD:main");
      return;
    } catch (error) {
      if (wait === 16) throw error;
    }
  }
}

function dzisWarszawa() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
}

/** Kolejka Instagrama (queue/) i LinkedIna (linkedin/) według id z planu: id posta, a dla LinkedIna „linkedin-<id>”. */
async function wczytajKolejke() {
  const kolejka = new Map();
  for (const [katalog, przedrostek] of KATALOGI) {
    const dir = path.join(ROOT, katalog);
    if (!existsSync(dir)) continue;
    for (const f of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
      const post = JSON.parse(await readFile(path.join(dir, f), "utf8"));
      kolejka.set(`${przedrostek}${post.id}`, { file: path.join(dir, f), post, linkedin: katalog === "linkedin" });
    }
  }
  return kolejka;
}

// Wynik „wznów” zaczyna się zawsze od „wznowiony” (panel KMZ po tym poznaje, że post znów czeka na publikację).
function wynikWznowienia(post, dzis, linkedin) {
  if (linkedin || post.date >= dzis) return "wznowiony";
  const dni = Math.round((Date.parse(dzis) - Date.parse(post.date)) / 86_400_000);
  if (post.type === "story" || dni > CATCH_UP_DAYS)
    return "wznowiony, ale termin minął: publikator go pominie (relacji z minionych dni i postów starszych niż 3 dni nie nadrabiamy)";
  return "wznowiony; termin minął, wyjdzie przy najbliższej publikacji (do 3 dni wstecz)";
}

/**
 * Co zrobić z reakcjami (bez plików i sieci): zmienia status postów w `kolejka` i zwraca potwierdzenia dla panelu,
 * reakcje „zmień” dla agenta i id zmienionych postów.
 */
export function zastosuj(reakcje, kolejka, dzis) {
  const zastosowane = [];
  const doZmiany = [];
  const zmienione = new Set();
  for (const r of reakcje) {
    const item = kolejka.get(r.post_id);
    if (!item) {
      zastosowane.push({ id: r.id, wynik: "nie ma takiego posta w kolejce" });
      continue;
    }
    const { post } = item;
    if (post.status === "published") {
      zastosowane.push({ id: r.id, wynik: item.linkedin ? "już opublikowany na LinkedIn" : "już opublikowany; usunąć albo poprawić można tylko w aplikacji Instagram" });
    } else if (r.reakcja === "wstrzymaj") {
      if (post.status === "planned" || post.status === "error") {
        post.status = "vetoed";
        zmienione.add(r.post_id);
        zastosowane.push({ id: r.id, wynik: "wstrzymany" });
      } else zastosowane.push({ id: r.id, wynik: `bez zmian (status ${post.status})` });
    } else if (r.reakcja === "wznow") {
      if (post.status === "vetoed") {
        post.status = "planned";
        zmienione.add(r.post_id);
        zastosowane.push({ id: r.id, wynik: wynikWznowienia(post, dzis, item.linkedin) });
      } else zastosowane.push({ id: r.id, wynik: `bez zmian (status ${post.status})` });
    } else {
      doZmiany.push(r);
    }
  }
  return { zastosowane, doZmiany, zmienione };
}

/** Odbiera reakcje z panelu i stosuje wstrzymaj/wznów; zwraca reakcje „zmień” czekające na agenta. */
export async function odbierzReakcje({ dryRun = false } = {}) {
  if (!process.env.KMZ_BIZNESDOK_SEKRET) {
    console.log("Reakcje z panelu KMZ: brak zmiennej KMZ_BIZNESDOK_SEKRET, pomijam.");
    return [];
  }
  let reakcje;
  try {
    ({ reakcje = [] } = await panel("GET"));
  } catch (error) {
    console.log(`Reakcje z panelu KMZ: panel niedostępny (${error.message}). Publikuję bez nich; zgłoś to w odpowiedzi.`);
    return [];
  }
  if (!reakcje.length) {
    console.log("Reakcje z panelu KMZ: brak nowych.");
    return [];
  }

  const kolejka = await wczytajKolejke();
  const { zastosowane, doZmiany, zmienione } = zastosuj(reakcje, kolejka, dzisWarszawa());

  for (const r of reakcje) {
    const z = zastosowane.find((x) => x.id === r.id);
    console.log(`Reakcja z panelu #${r.id} ${r.reakcja} ${r.post_id}: ${z ? z.wynik : "do zrobienia przez agenta"}`);
  }

  if (!dryRun && zmienione.size) {
    for (const id of zmienione) {
      const item = kolejka.get(id);
      await writeFile(item.file, `${JSON.stringify(item.post, null, 2)}\n`);
    }
    git("add", ...KATALOGI.map(([k]) => k).filter((k) => existsSync(path.join(ROOT, k))));
    git("commit", "-q", "-m", `panel KMZ: reakcje właściciela (${[...zmienione].join(", ")})`);
    pushWithRetry();
  }
  if (!dryRun && zastosowane.length) await panel("POST", { zastosowane });

  for (const r of doZmiany) console.log(`ZMIEŃ #${r.id} ${r.post_id}: ${r.uwaga}`);
  if (doZmiany.length)
    console.log('Każdą zmianę wykonaj przed publikacją (CLAUDE.md, „Weto właściciela”), potem: node tools/reakcje.mjs --potwierdz <nr> "co zrobiono".');
  return doZmiany;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes("--potwierdz")) {
    const [nr, ...opis] = args.slice(args.indexOf("--potwierdz") + 1);
    if (!/^\d+$/.test(nr ?? "")) throw new Error('Użycie: node tools/reakcje.mjs --potwierdz <nr> "co zrobiono"');
    if (!process.env.KMZ_BIZNESDOK_SEKRET) throw new Error("Brak zmiennej KMZ_BIZNESDOK_SEKRET.");
    const d = await panel("POST", { zastosowane: [{ id: Number(nr), wynik: opis.join(" ").slice(0, 300) || "zmienione" }] });
    console.log(`Potwierdzono reakcję #${nr} (${d.potwierdzone ?? 0}).`);
  } else {
    await odbierzReakcje({ dryRun: args.includes("--dry-run") });
  }
}
