// Propozycja tematów na tydzień (tryb 2): każde miejsce rytmu dostaje temat z data/oferta.json według zasad
// z decyzji właściciela 20.10.2026 — najpierw płatne dokumenty i Subskrypcja, cała oferta po kolei, bez powtórki
// tematu (Instagram 21 dni, LinkedIn 120 dni), z pierwszeństwem tematów w ich okresie przydatności; seria „AI zawiodło?”
// co 2 tygodnie. LinkedIn — głównie dokumenty spółki: zarząd, zgromadzenia, wspólnicy i udziały (decyzja 20.10.2026).
// Wynik to propozycja: agent pisze do niej teksty (tylko fakty z pola `fakty`) i może zamienić temat,
// jeśli ma powód — ale post i tak musi przejść kontrolę (tools/kontrola.mjs).
// Użycie: node tools/propozycja.mjs [RRRR-MM-DD poniedziałek, domyślnie najbliższy] [--json]
import {
  blokadaTematu,
  dniMiedzy,
  dodajDni,
  dzisWarszawa,
  numerTygodnia,
  ostatnioPokazany,
  poniedzialek,
  powtorkiTematu,
  kolejnoscGrupyLinkedIn,
  sezonTematu,
  spolkowy,
  tematPosta,
  toWideo,
  wczytajJson,
  wczytajOferte,
  wczytajPosty,
  wczytajSerieAI,
  wOkresie,
  ZYWE,
  ROOT,
} from "./tematy.mjs";
import path from "node:path";

const WAGA = { A: 30, B: 20, C: 10 };

/** Rytm tygodnia (CLAUDE.md, „Rytm”). rodzaj: platny | poradnik | wolne | piatek | seria-li. */
export const RYTM = [
  { dzien: 0, kanal: "instagram", format: "feed", godzina: "08:30", rodzaj: "platny", opis: "płatny dokument (najpierw A)" },
  { dzien: 0, kanal: "instagram", format: "story", godzina: "12:30", rodzaj: "platny", opis: "płatny dokument" },
  { dzien: 1, kanal: "instagram", format: "carousel", godzina: "08:30", rodzaj: "poradnik", opis: "karuzela z poradnika w sezonie" },
  { dzien: 1, kanal: "instagram", format: "story", godzina: "12:30", rodzaj: "platny", opis: "płatny dokument" },
  { dzien: 1, kanal: "linkedin", format: "linkedin", godzina: "09:00", rodzaj: "platny", opis: "LinkedIn: dokument spółki (zarząd, wspólnicy, udziały)" },
  { dzien: 2, kanal: "instagram", format: "feed", godzina: "08:30", rodzaj: "platny", opis: "płatny dokument" },
  { dzien: 2, kanal: "instagram", format: "story", godzina: "12:30", rodzaj: "platny", opis: "płatny dokument" },
  { dzien: 3, kanal: "instagram", format: "feed", godzina: "08:30", rodzaj: "platny", opis: "płatny dokument (seria „…przygotowujesz i trzymasz”)" },
  { dzien: 3, kanal: "instagram", format: "story", godzina: "12:30", rodzaj: "platny", opis: "płatny dokument" },
  { dzien: 3, kanal: "linkedin", format: "linkedin", godzina: "09:00", rodzaj: "seria-li", opis: "LinkedIn: poradnik spółkowy albo seria AI (na zmianę)" },
  { dzien: 4, kanal: "instagram", format: "feed", godzina: "08:30", rodzaj: "piatek", opis: "tydzień parzysty: seria AI; nieparzysty: Subskrypcja albo bezpłatne w sezonie" },
  { dzien: 4, kanal: "instagram", format: "story", godzina: "12:30", rodzaj: "wolne", opis: "bezpłatne narzędzie albo dokument w sezonie (jedyna bezpłatna relacja)" },
];

const formatPosta = (post) => (post.type === "carousel" ? "carousel" : post.type === "story" ? "story" : "feed");

function wynik(pozycja, kanal, dzien, wszystkie) {
  const ostatnio = ostatnioPokazany(pozycja.temat, kanal, wszystkie, dzien);
  const dni = ostatnio ? dniMiedzy(ostatnio, dzien) : null;
  const sezon = sezonTematu(pozycja, dzien);
  const punkty = (WAGA[pozycja.priorytet] ?? 10) + (sezon.wSezonie ? 15 : 0) + Math.min(dni ?? 60, 60) / 2;
  const powod = [
    `priorytet ${pozycja.priorytet}${pozycja.dlaczego ? ` (${pozycja.dlaczego})` : ""}`,
    sezon.wSezonie ? `w sezonie: ${sezon.okres.dlaczego}` : null,
    ostatnio ? `ostatnio ${ostatnio}` : "jeszcze nie było",
  ].filter(Boolean);
  return { punkty, powod };
}

function wolny(pozycja, kanal, dzien, wszystkie, zajete, oferta, seria) {
  if (zajete.has(`${kanal}:${pozycja.temat}`)) return false;
  if (blokadaTematu(pozycja, dzien)) return false;
  // Ta sama reguła powtórek co w kontroli (Instagram 21 dni; LinkedIn 120 dni, poradnik i jego dokumenty 28 dni) —
  // liczą się też posty już zaplanowane po tym dniu i tematy wybrane wcześniej w tej propozycji.
  return !powtorkiTematu({ id: null, temat: pozycja.temat, date: dzien }, kanal, wszystkie, oferta, seria).length;
}

function najlepszy(kandydaci, kanal, dzien, wszystkie, zajete, oferta, seria) {
  return kandydaci
    .filter((p) => wolny(p, kanal, dzien, wszystkie, zajete, oferta, seria))
    .map((p) => ({ pozycja: p, ...wynik(p, kanal, dzien, wszystkie) }))
    .sort((a, b) =>
      b.punkty - a.punkty ||
      (kanal === "linkedin" ? kolejnoscGrupyLinkedIn(a.pozycja) - kolejnoscGrupyLinkedIn(b.pozycja) : 0) ||
      a.pozycja.temat.localeCompare(b.pozycja.temat))[0] ?? null;
}

function nastepnyAI(seria, kanal, dzien, wolnyTemat = () => true, pierwsze = () => false) {
  const tematy = [...(seria.tematy ?? [])].sort((x, y) => Number(pierwsze(y)) - Number(pierwsze(x)));
  return tematy.find((t) => !t[kanal] && (!(t.sezon ?? []).length || t.sezon.some((o) => wOkresie(dzien, o))) && wolnyTemat(t)) ?? null;
}

const postSeriiAI = (t, dzien, kanal) => ({ id: `propozycja-${kanal}-ai-${dzien}`, seria: "ai-zawiodlo", temat_serii: t.id, date: dzien, status: "planned" });

export function propozycjaTygodnia(pon, kontekst = {}) {
  const wszystkie = kontekst.wszystkie ?? wczytajPosty();
  const oferta = kontekst.oferta ?? wczytajOferte();
  const seria = kontekst.seria ?? wczytajSerieAI();
  const pozycje = [...oferta.mapa.values()];
  const platne = pozycje.filter((p) => p.platny && p.rodzaj === "dokument");
  const poradniki = pozycje.filter((p) => p.rodzaj === "poradnik");
  const bezplatne = pozycje.filter((p) => !p.platny && p.rodzaj !== "poradnik");
  const subskrypcja = oferta.mapa.get("subskrypcja");
  const parzysty = numerTygodnia(pon) % 2 === 0;
  const zajete = new Set();
  const miejsca = [];
  // Tematy wybrane w tej propozycji liczą się do powtórek kolejnych miejsc (np. poradnik i jego dokument w jednym tygodniu).
  const wybrane = [];
  const dotad = () => [...wszystkie, ...wybrane];
  const spolki = (lista) => lista.filter((p) => spolkowy(p, oferta));

  // Miejsca już zajęte w kolejce (np. zaplanowane wcześniej) zostają; ich tematy liczą się do „zajętych”.
  const istniejace = wszystkie.filter(({ post }) => ZYWE.has(post.status) && !post.usunieto && post.date >= pon && post.date <= dodajDni(pon, 6));
  for (const { kanal, post } of istniejace) if (tematPosta(post)) zajete.add(`${kanal}:${tematPosta(post)}`);

  for (const m of RYTM) {
    const dzien = dodajDni(pon, m.dzien);
    const juz = istniejace.find(({ kanal, post }) => kanal === m.kanal && post.date === dzien && !toWideo(post) &&
      (m.kanal === "linkedin" || (m.format === "story") === (post.type === "story")));
    if (juz) {
      miejsca.push({ ...m, data: dzien, temat: tematPosta(juz.post), zajete: juz.post.id, powod: ["już w kolejce"] });
      continue;
    }
    let wybor = null;
    let seriaAI = null;
    const naj = (lista) => najlepszy(lista, m.kanal, dzien, dotad(), zajete, oferta, seria);
    if (m.rodzaj === "platny") wybor = m.kanal === "linkedin" ? naj(spolki(platne)) ?? naj(platne) : naj(platne);
    else if (m.rodzaj === "poradnik") wybor = naj(poradniki) ?? naj(platne);
    else if (m.rodzaj === "wolne") wybor = naj(bezplatne) ?? naj(platne);
    else if (m.rodzaj === "piatek") {
      if (parzysty) seriaAI = nastepnyAI(seria, "instagram", dzien);
      if (!seriaAI) {
        wybor = (subskrypcja && wolny(subskrypcja, m.kanal, dzien, dotad(), zajete, oferta, seria) && { pozycja: subskrypcja, ...wynik(subskrypcja, m.kanal, dzien, wszystkie) }) ||
          naj(bezplatne.filter((p) => sezonTematu(p, dzien).wSezonie)) ||
          naj(platne);
      }
    } else if (m.rodzaj === "seria-li") {
      // Odcinek AI na LinkedIn tylko wtedy, gdy jego dokument ani poradnik nie był tam w ostatnich 28 dniach.
      if (parzysty) {
        seriaAI = nastepnyAI(
          seria,
          "linkedin",
          dzien,
          (t) => !powtorkiTematu(postSeriiAI(t, dzien, "linkedin"), "linkedin", dotad(), oferta, seria).length,
          (t) => spolkowy(oferta.mapa.get(t.rozwiazanie), oferta),
        );
      }
      // LinkedIn: najpierw poradnik spółkowy, potem dokument spółki, dopiero potem reszta oferty.
      if (!seriaAI) wybor = naj(spolki(poradniki)) ?? naj(spolki(platne)) ?? naj(poradniki) ?? naj(platne);
    }
    if (seriaAI) {
      wybrane.push({ kanal: m.kanal, post: postSeriiAI(seriaAI, dzien, m.kanal) });
      miejsca.push({ ...m, data: dzien, temat: `seria-ai/${seriaAI.id}`, seria: seriaAI, powod: ["seria „AI zawiodło? Decyduje prawnik” — co 2 tygodnie"] });
      continue;
    }
    if (!wybor) {
      miejsca.push({ ...m, data: dzien, temat: null, powod: ["brak tematu spełniającego zasady — zostaw puste i opisz w podsumowaniu"] });
      continue;
    }
    zajete.add(`${m.kanal}:${wybor.pozycja.temat}`);
    wybrane.push({ kanal: m.kanal, post: { id: `propozycja-${m.kanal}-${m.format}-${dzien}`, temat: wybor.pozycja.temat, date: dzien, status: "planned" } });
    miejsca.push({ ...m, data: dzien, temat: wybor.pozycja.temat, tytul: wybor.pozycja.tytul, link: wybor.pozycja.link, fakty: wybor.pozycja.fakty, powod: wybor.powod });
  }

  // Wideo: zatwierdzone urywki, każdy najwyżej raz na 14 dni (rotacja z CLAUDE.md, „Wideo”).
  const wideo = (wczytajJson(path.join(ROOT, "data", "wideo.json"), { filmy: [] }).filmy ?? []).filter((f) => f.typ === "urywek");
  const urywki = wideo.map((f) => {
    const ostatnio = wszystkie.filter(({ post }) => post.video === f.plik && ZYWE.has(post.status)).map(({ post }) => post.date).sort().at(-1) ?? null;
    return { plik: f.plik, temat: f.temat, ostatnio, wolny: !ostatnio || dniMiedzy(ostatnio, pon) >= 14 };
  });
  return { poniedzialek: pon, tydzienParzysty: parzysty, miejsca, urywki };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const dzis = dzisWarszawa();
  const pon = arg ?? dodajDni(poniedzialek(dzis), 7);
  const p = propozycjaTygodnia(pon);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(p, null, 2));
  } else {
    console.log(`Propozycja na tydzień od ${pon} (tydzień ${p.tydzienParzysty ? "parzysty — seria AI w piątek" : "nieparzysty"})`);
    for (const m of p.miejsca) {
      const co = m.zajete ? `[w kolejce: ${m.zajete}]` : m.temat ?? "—";
      console.log(`${m.data} ${m.godzina} ${m.kanal === "linkedin" ? "LinkedIn" : m.format.padEnd(8)} ${co}  ← ${m.powod.join("; ")}`);
    }
    const wolne = p.urywki.filter((u) => u.wolny);
    console.log(`Urywki wideo do relacji (12:45): ${wolne.length ? wolne.map((u) => u.plik).join(", ") : "brak wolnych (każdy był w ostatnich 14 dniach)"}`);
  }
}
