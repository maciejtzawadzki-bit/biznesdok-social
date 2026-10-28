// Raport zgodności (pilnowanie na bieżąco, decyzja właściciela 20.10.2026): co wyszło w ostatnich 7 dniach
// i co jest zaplanowane na kolejne 14 (plan sięga dwa tygodnie naprzód, decyzja 28.10.2026) — proporcje, powtórki,
// blokady, sezon i pokrycie oferty.
// Tryb 2 dopisuje wynik do RAPORTY.md (biuro KMZ zbiera go do porannego meldunku); tryb 1 podaje wiersz podsumowania.
// Użycie: node tools/zgodnosc.mjs [RRRR-MM-DD dzień odniesienia, domyślnie dziś] [--krotko]
import { ocenPost, START_PROPORCJI, uwagiTygodnia } from "./kontrola.mjs";
import {
  blokadaTematu,
  dodajDni,
  dzisWarszawa,
  poniedzialek,
  powtorkiTematu,
  sezonTematu,
  tematPosta,
  toWideo,
  wczytajOferte,
  wczytajPosty,
  wczytajSerieAI,
  ZYWE,
} from "./tematy.mjs";

export function raportZgodnosci(dzis = dzisWarszawa(), kontekst = {}) {
  const wszystkie = kontekst.wszystkie ?? wczytajPosty();
  const oferta = kontekst.oferta ?? wczytajOferte();
  const seria = kontekst.seria ?? wczytajSerieAI();
  const k = { wszystkie, oferta, seria };
  const od = dodajDni(dzis, -7);
  const doDnia = dodajDni(dzis, 14);
  const ig = wszystkie.filter((x) => x.kanal === "instagram" && ZYWE.has(x.post.status) && !x.post.usunieto);
  const wyszlo = ig.filter((x) => x.post.status === "published" && x.post.date >= od && x.post.date < dzis);
  const plan = wszystkie.filter((x) => x.post.status === "planned" && !x.post.usunieto && x.post.date >= dzis && x.post.date <= doDnia);
  const rodzaj = (post) => {
    if (post.seria === "ai-zawiodlo") return "seria AI";
    if (toWideo(post)) return "wideo";
    const poz = oferta.mapa.get(tematPosta(post));
    if (!poz) return "spoza oferty";
    if (poz.rodzaj === "poradnik") return "poradnik";
    if (poz.rodzaj === "subskrypcja") return "Subskrypcja";
    return poz.platny ? "płatny dokument" : poz.rodzaj === "narzedzie" ? "bezpłatne narzędzie" : "bezpłatny dokument";
  };
  const liczby = (lista) => lista.reduce((m, x) => ((m[rodzaj(x.post)] = (m[rodzaj(x.post)] ?? 0) + 1), m), {});
  const powtorki = wyszlo.filter((x) => powtorkiTematu(x.post, "instagram", wszystkie.filter((y) => y.post.status === "published")).length);
  const blokady = plan.map((x) => ({ x, twarde: ocenPost(x.post, x.kanal, x.post.date, k).twarde })).filter((b) => b.twarde.length);
  const platne = [...oferta.mapa.values()].filter((p) => p.platny && !blokadaTematu(p, dzis));
  const ostatnie28 = new Set(ig.filter((x) => x.post.date >= dodajDni(dzis, -28) && x.post.date <= doDnia).map((x) => tematPosta(x.post)));
  const niepokazane = platne.filter((p) => !ostatnie28.has(p.temat));
  const wSezonie = [...oferta.mapa.values()].filter((p) => sezonTematu(p, dzis).wSezonie && !blokadaTematu(p, dzis));
  return {
    dzis,
    wyszlo: liczby(wyszlo),
    plan: liczby(plan.filter((x) => x.kanal === "instagram")),
    linkedin: plan.filter((x) => x.kanal === "linkedin").length,
    powtorki: powtorki.map((x) => x.post.id),
    blokady: blokady.map((b) => `${b.x.kanal === "linkedin" ? "LinkedIn " : ""}${b.x.post.id}: ${b.twarde.join("; ")}`),
    // Tydzień po kolejnym — tylko gdy ma już posty (piątkowy plan na dwa tygodnie powstaje po porannej publikacji).
    tygodnie: [0, 7, 14]
      .map((n) => dodajDni(poniedzialek(dzis), n))
      .filter((pon, i) => i < 2 || ig.some((x) => x.post.date >= pon && x.post.date <= dodajDni(pon, 6)))
      .map((pon) => ({ pon, uwagi: uwagiTygodnia(pon, k) })),
    niepokazane: niepokazane.map((p) => p.temat),
    wSezonie: wSezonie.map((p) => p.temat),
    platnychWOfercie: platne.length,
  };
}

const opisLiczb = (m) => Object.entries(m).map(([k, v]) => `${k} ${v}`).join(", ") || "brak";

export function raportMarkdown(r) {
  const linie = [
    `### Zgodność treści (${r.dzis})`,
    `- Wyszło (7 dni): ${opisLiczb(r.wyszlo)}.`,
    `- Plan (14 dni): Instagram — ${opisLiczb(r.plan)}; LinkedIn — ${r.linkedin}.`,
    `- Powtórki tematu w 21 dni wśród opublikowanych: ${r.powtorki.length ? r.powtorki.join(", ") : "0"}.`,
    `- Posty zablokowane przez kontrolę: ${r.blokady.length ? r.blokady.join(" | ") : "0"}.`,
    ...r.tygodnie.map((t) => `- Tydzień od ${t.pon}: ${t.pon < START_PROPORCJI ? `proporcje liczone od ${START_PROPORCJI}` : t.uwagi.length ? t.uwagi.join("; ") : "proporcje zgodne"}.`),
    `- Płatne dokumenty bez publikacji w 28 dniach: ${r.niepokazane.length} z ${r.platnychWOfercie}${r.niepokazane.length ? ` (${r.niepokazane.join(", ")})` : ""}.`,
    `- Tematy w sezonie: ${r.wSezonie.length ? r.wSezonie.join(", ") : "brak"}.`,
  ];
  return linie.join("\n");
}

export function raportKrotki(r) {
  const problemy = r.powtorki.length + r.blokady.length + r.tygodnie.reduce((n, t) => n + t.uwagi.length, 0);
  return problemy
    ? `Kontrola treści: ${r.blokady.length} zablokowanych, ${r.powtorki.length} powtórek, ${r.tygodnie.reduce((n, t) => n + t.uwagi.length, 0)} uwag do proporcji.`
    : "Kontrola treści: bez uwag.";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const r = raportZgodnosci(arg ?? dzisWarszawa());
  console.log(process.argv.includes("--krotko") ? raportKrotki(r) : raportMarkdown(r));
}
