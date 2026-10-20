// Wspólne zasady doboru tematów (decyzja właściciela 20.10.2026): jedna lista oferty (data/oferta.json),
// okresy przydatności tematów, wstrzymania, powtórki. Używają jej kontrola treści, propozycja tygodnia,
// raport zgodności i publikator — żeby te same zasady liczyły się w jednym miejscu.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Ile dni musi minąć, zanim ten sam temat (dokument, narzędzie, poradnik) wróci w tym samym kanale. */
export const ODSTEP_TEMATU_DNI = 21;
/**
 * LinkedIn (2 posty tygodniowo; decyzja właściciela 20.10.2026 po powtórce wezwania: „po CO TO ROBIMY?”): temat wraca
 * dopiero po pełnym kole, ok. 4 miesiącach, a poradnik i dokumenty, do których prowadzi, nie wchodzą bliżej niż 4 tygodnie.
 */
export const ODSTEP_LINKEDIN_DNI = 120;
export const ODSTEP_POWIAZANYCH_DNI = 28;
export const odstepTematu = (kanal) => (kanal === "linkedin" ? ODSTEP_LINKEDIN_DNI : ODSTEP_TEMATU_DNI);

/**
 * LinkedIn — głównie dokumenty spółki (decyzja właściciela 20.10.2026: „na linkedinie … głównie o takich dok. zarządowych,
 * spółkowych”). Poradnik jest spółkowy, gdy prowadzi do dokumentów z tych grup.
 */
export const GRUPY_LINKEDIN = new Set(["Spółka — zarząd", "Spółka — sprawozdania", "Spółka — wspólnicy i udziały"]);
/** Kolejność grup przy remisie punktów na LinkedIn: najpierw zarząd, potem sprawozdania, potem wspólnicy i udziały. */
export const kolejnoscGrupyLinkedIn = (pozycja) => {
  const i = [...GRUPY_LINKEDIN].indexOf(pozycja?.grupa);
  return i < 0 ? GRUPY_LINKEDIN.size : i;
};
export function spolkowy(pozycja, oferta) {
  if (!pozycja) return false;
  if (GRUPY_LINKEDIN.has(pozycja.grupa)) return true;
  return pozycja.rodzaj === "poradnik" && (pozycja.prowadzi_do ?? []).some((t) => GRUPY_LINKEDIN.has(oferta?.mapa?.get(t)?.grupa));
}

/** Tematy, do których odnosi się post serii AI: dokument z `rozwiazanie` i poradnik ze `zrodlo`. */
export function tematySeriiAI(t) {
  const wynik = new Set();
  if (t?.rozwiazanie) wynik.add(t.rozwiazanie);
  const poradnik = String(t?.zrodlo ?? "").match(/^https:\/\/biznesdok\.pl\/(poradniki\/[^?#/]+)/);
  if (poradnik) wynik.add(poradnik[1]);
  return wynik;
}

/**
 * Tematy powiązane: poradnik ↔ dokumenty, do których prowadzi (pole `prowadzi_do` w ofercie), oraz odcinek serii AI ↔ jego
 * dokument i poradnik (`seria`). Trzy posty o tym samym w kilka dni to powtórka, nawet jeśli każdy ma inny temat.
 */
export function powiazaneTematy(temat, oferta, seria = null) {
  const wynik = new Set();
  if (!temat) return wynik;
  if (temat.startsWith("seria-ai/")) {
    const t = (seria?.tematy ?? []).find((x) => `seria-ai/${x.id}` === temat);
    for (const x of tematySeriiAI(t)) wynik.add(x);
    return wynik;
  }
  const pozycja = oferta?.mapa?.get(temat);
  if (pozycja?.rodzaj === "poradnik") for (const t of pozycja.prowadzi_do ?? []) wynik.add(t);
  for (const p of oferta?.mapa?.values() ?? []) if (p.rodzaj === "poradnik" && (p.prowadzi_do ?? []).includes(temat)) wynik.add(p.temat);
  for (const t of seria?.tematy ?? []) if (tematySeriiAI(t).has(temat)) wynik.add(`seria-ai/${t.id}`);
  wynik.delete(temat);
  return wynik;
}
/** Stany, w których post się liczy (wyszedł albo ma wyjść). */
export const ZYWE = new Set(["planned", "published", "handed"]);

export const dzisWarszawa = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(d);
export const dniMiedzy = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
export const dodajDni = (dzien, n) => new Date(Date.parse(dzien) + n * 86_400_000).toISOString().slice(0, 10);

export function wczytajJson(plik, zapas = null) {
  try {
    return JSON.parse(readFileSync(plik, "utf8"));
  } catch {
    return zapas;
  }
}

export function wczytajOferte(root = ROOT) {
  const oferta = wczytajJson(path.join(root, "data", "oferta.json"), { pozycje: [] });
  const mapa = new Map(oferta.pozycje.map((p) => [p.temat, p]));
  return { ...oferta, mapa };
}

export function wczytajSerieAI(root = ROOT) {
  return wczytajJson(path.join(root, "data", "seria-ai.json"), { tematy: [] });
}

/** Wszystkie posty z kolejki Instagrama i LinkedIna: [{ kanal, post }]. */
export function wczytajPosty(root = ROOT) {
  const wynik = [];
  for (const [katalog, kanal] of [["queue", "instagram"], ["linkedin", "linkedin"]]) {
    const dir = path.join(root, katalog);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
      const post = wczytajJson(path.join(dir, f));
      if (post) wynik.push({ kanal, post });
    }
  }
  return wynik;
}

/** Temat posta: pole `temat` albo ścieżka linku do biznesdok.pl (bez /dokument/). Seria AI ma temat „seria-ai/<id>”. */
export function tematPosta(post) {
  if (post.seria === "ai-zawiodlo" && post.temat_serii) return `seria-ai/${post.temat_serii}`;
  if (post.temat) return post.temat;
  const link = String(post.link ?? "");
  if (!link.startsWith("https://biznesdok.pl/")) return null;
  const sciezka = link.replace("https://biznesdok.pl/", "").replace(/[?#].*$/, "").replace(/\/$/, "");
  return sciezka.replace(/^dokument\//, "") || null;
}

/** Wideo (reel, urywek w relacji) ma osobną rotację z data/wideo.json — nie liczy się do powtórek tematów. */
export const toWideo = (post) => Boolean(post.video);

function mmdd(dzien) {
  return String(dzien).slice(5, 10);
}

/** Czy dzień (RRRR-MM-DD) wpada w okres { od: "MM-DD", do: "MM-DD" } — także przez Nowy Rok. */
export function wOkresie(dzien, okres) {
  const d = mmdd(dzien);
  return okres.od <= okres.do ? d >= okres.od && d <= okres.do : d >= okres.od || d <= okres.do;
}

export function sezonTematu(pozycja, dzien) {
  const okresy = pozycja?.sezon ?? [];
  if (!okresy.length) return { wSezonie: false, poza: false, okres: null };
  const okres = okresy.find((o) => wOkresie(dzien, o)) ?? null;
  return { wSezonie: Boolean(okres), poza: !okres && Boolean(pozycja.tylko_w_sezonie), okres };
}

/** Powód, dla którego temat nie może dziś wyjść (wstrzymany, nieważny, poza sezonem), albo null. */
export function blokadaTematu(pozycja, dzien) {
  if (!pozycja) return null;
  if (pozycja.wstrzymany) return `temat wstrzymany: ${pozycja.wstrzymany}`;
  if (pozycja.wazne_do && dzien > pozycja.wazne_do) return `temat nieaktualny po ${pozycja.wazne_do} (np. stawki na dany rok)`;
  const { poza } = sezonTematu(pozycja, dzien);
  if (poza) return `poza okresem przydatności (${pozycja.sezon.map((o) => `${o.od}–${o.do}`).join(", ")})`;
  return null;
}

const bezWyroznien = (t) => String(t ?? "").replace(/\[\[|\]\]/g, "");
const normalizuj = (t) => bezWyroznien(t).toLowerCase().replace(/[\s ]+/g, " ").replace(/[.„”"]/g, "").trim();

/** Hasło grafiki (pierwszy slajd) — do wykrywania identycznych grafik. */
export function hasloPosta(post) {
  return normalizuj(post.slides?.[0]?.text ?? "");
}

/**
 * Inne posty tego samego kanału z tym samym tematem w oknie odstępu kanału (Instagram 21 dni, LinkedIn 120 dni), bez wideo
 * i bez wstrzymanych. Liczy się każdy format — także relacja tego samego dnia co post w feedzie o tym samym temacie
 * (decyzja 20.10). Na LinkedIn także tematy powiązane (poradnik i jego dokumenty, odcinek serii AI i jego dokument
 * albo poradnik) bliżej niż ODSTEP_POWIAZANYCH_DNI — z `oferta` i `seria`.
 */
export function powtorkiTematu(post, kanal, wszystkie, oferta = null, seria = null) {
  const temat = tematPosta(post);
  if (!temat || toWideo(post)) return [];
  const odstep = odstepTematu(kanal);
  const powiazane = kanal === "linkedin" ? powiazaneTematy(temat, oferta, seria) : new Set();
  return wszystkie
    .filter((x) => x.kanal === kanal && x.post.id !== post.id && ZYWE.has(x.post.status) && !x.post.usunieto && !toWideo(x.post))
    .filter((x) => {
      const t = tematPosta(x.post);
      const dni = Math.abs(dniMiedzy(x.post.date, post.date));
      return (t === temat && dni < odstep) || (powiazane.has(t) && dni < ODSTEP_POWIAZANYCH_DNI);
    })
    .map((x) => x.post);
}

/** Inne posty tego samego kanału (w dowolnym czasie) z identycznym hasłem na grafice. */
export function powtorkiHasla(post, kanal, wszystkie) {
  const haslo = hasloPosta(post);
  if (!haslo) return [];
  return wszystkie
    .filter((x) => x.kanal === kanal && x.post.id !== post.id && ZYWE.has(x.post.status) && !x.post.usunieto)
    .filter((x) => hasloPosta(x.post) === haslo)
    .map((x) => x.post);
}

/** Ostatnia data (przed dniem `przed`, włącznie z planowanymi) pokazania tematu w kanale — do rotacji. */
export function ostatnioPokazany(temat, kanal, wszystkie, przed = "9999-12-31") {
  const daty = wszystkie
    .filter((x) => x.kanal === kanal && ZYWE.has(x.post.status) && !x.post.usunieto && !toWideo(x.post))
    .filter((x) => tematPosta(x.post) === temat && x.post.date < przed)
    .map((x) => x.post.date)
    .sort();
  return daty.at(-1) ?? null;
}

/** Tydzień ISO (poniedziałek) dla dnia. */
export function poniedzialek(dzien) {
  const d = new Date(`${dzien}T12:00:00Z`);
  const dzienTyg = (d.getUTCDay() + 6) % 7;
  return dodajDni(dzien, -dzienTyg);
}

/** Numer tygodnia ISO — parzysty tydzień: seria AI w piątek. */
export function numerTygodnia(dzien) {
  const d = new Date(`${dzien}T12:00:00Z`);
  const czw = new Date(d);
  czw.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const pierwszyCzw = new Date(Date.UTC(czw.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((czw - pierwszyCzw) / 86_400_000 - 3 + ((pierwszyCzw.getUTCDay() + 6) % 7)) / 7);
}
