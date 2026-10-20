// Testy zasad LinkedIna (decyzja właściciela 20.10.2026 po powtórce wezwania): głównie dokumenty spółki,
// temat wraca po 120 dniach, poradnik i jego dokumenty nie bliżej niż 28 dni. Instagram bez zmian (21 dni).
// Uruchamia CI: node --test tools/*.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { ocenPost } from "./kontrola.mjs";
import { propozycjaTygodnia } from "./propozycja.mjs";
import { powiazaneTematy, spolkowy } from "./tematy.mjs";

const pozycje = [
  { temat: "ostateczne-wezwanie-do-zaplaty", rodzaj: "dokument", platny: true, priorytet: "A", grupa: "Płatności i należności", link: "https://biznesdok.pl/ostateczne-wezwanie-do-zaplaty", fakty: [] },
  { temat: "umowa-zlecenia", rodzaj: "dokument", platny: true, priorytet: "A", grupa: "Zlecenia", link: "https://biznesdok.pl/dokument/umowa-zlecenia", fakty: [] },
  { temat: "uchwala-o-powolaniu-czlonka-zarzadu", rodzaj: "dokument", platny: true, priorytet: "B", grupa: "Spółka — zarząd", link: "https://biznesdok.pl/dokument/uchwala-o-powolaniu-czlonka-zarzadu", fakty: [] },
  { temat: "ksiega-udzialow", rodzaj: "dokument", platny: true, priorytet: "C", grupa: "Spółka — wspólnicy i udziały", link: "https://biznesdok.pl/dokument/ksiega-udzialow", fakty: [] },
  { temat: "poradniki/zmiana-czlonka-zarzadu-sp-z-o-o", rodzaj: "poradnik", platny: false, priorytet: "B", grupa: "Poradniki", link: "https://biznesdok.pl/poradniki/zmiana-czlonka-zarzadu-sp-z-o-o", prowadzi_do: ["uchwala-o-powolaniu-czlonka-zarzadu"], fakty: [] },
  { temat: "poradniki/jak-odzyskac-pieniadze-za-fakture", rodzaj: "poradnik", platny: false, priorytet: "A", grupa: "Poradniki", link: "https://biznesdok.pl/poradniki/jak-odzyskac-pieniadze-za-fakture", prowadzi_do: ["ostateczne-wezwanie-do-zaplaty"], fakty: [] },
];
const oferta = { pozycje, mapa: new Map(pozycje.map((p) => [p.temat, p])) };
const seria = { tematy: [] };

const post = (id, date, temat, zmiany = {}) => ({
  id,
  date,
  time: "09:00",
  type: "feed",
  status: "planned",
  temat,
  link: oferta.mapa.get(temat).link,
  slides: [{ layout: "headline", text: `Hasło ${id}` }],
  caption: "Opis.",
  ...zmiany,
});
const wpis = (kanal, p) => ({ kanal, post: p });

test("LinkedIn: ten sam temat po 51 dniach blokuje, na Instagramie nie", () => {
  const stary = post("stary", "2026-08-30", "ostateczne-wezwanie-do-zaplaty", { status: "published" });
  const nowy = post("nowy", "2026-10-20", "ostateczne-wezwanie-do-zaplaty");
  const li = ocenPost(nowy, "linkedin", "2026-10-20", { wszystkie: [wpis("linkedin", stary)], oferta, seria });
  assert.ok(li.twarde.some((u) => u.startsWith("powtórka tematu") && u.includes("2026-08-30")), li.twarde.join("; "));
  const ig = ocenPost(nowy, "instagram", "2026-10-20", { wszystkie: [wpis("instagram", stary)], oferta, seria });
  assert.ok(!ig.twarde.some((u) => u.startsWith("powtórka tematu")), ig.twarde.join("; "));
});

test("LinkedIn: poradnik i dokument, do którego prowadzi, bliżej niż 28 dni — blokuje; po 35 dniach — nie", () => {
  const dokument = post("dok", "2026-10-20", "ostateczne-wezwanie-do-zaplaty", { status: "published" });
  const blisko = post("por1", "2026-10-22", "poradniki/jak-odzyskac-pieniadze-za-fakture");
  const daleko = post("por2", "2026-11-24", "poradniki/jak-odzyskac-pieniadze-za-fakture");
  const kontekst = { wszystkie: [wpis("linkedin", dokument)], oferta, seria };
  assert.ok(ocenPost(blisko, "linkedin", "2026-10-20", kontekst).twarde.some((u) => u.includes("ostateczne-wezwanie-do-zaplaty 2026-10-20")));
  assert.ok(!ocenPost(daleko, "linkedin", "2026-10-20", kontekst).twarde.some((u) => u.startsWith("powtórka tematu")));
});

test("tematy powiązane i profil spółkowy", () => {
  assert.deepEqual([...powiazaneTematy("ostateczne-wezwanie-do-zaplaty", oferta)], ["poradniki/jak-odzyskac-pieniadze-za-fakture"]);
  assert.ok(spolkowy(oferta.mapa.get("ksiega-udzialow"), oferta));
  assert.ok(spolkowy(oferta.mapa.get("poradniki/zmiana-czlonka-zarzadu-sp-z-o-o"), oferta));
  assert.ok(!spolkowy(oferta.mapa.get("poradniki/jak-odzyskac-pieniadze-za-fakture"), oferta));
  assert.ok(!spolkowy(oferta.mapa.get("umowa-zlecenia"), oferta));
});

test("propozycja: LinkedIn we wtorek i w czwartek tematy spółki — mimo wyższego priorytetu innych — i nie powiązane ze sobą", () => {
  // 2026-11-02 — tydzień nieparzysty (w czwartek poradnik zamiast serii AI).
  const p = propozycjaTygodnia("2026-11-02", { wszystkie: [], oferta, seria });
  const li = p.miejsca.filter((m) => m.kanal === "linkedin");
  const wtorek = li.find((m) => m.data === "2026-11-03");
  const czwartek = li.find((m) => m.data === "2026-11-05");
  assert.ok(spolkowy(oferta.mapa.get(wtorek.temat), oferta), `wtorek: ${wtorek.temat}`);
  assert.ok(spolkowy(oferta.mapa.get(czwartek.temat), oferta), `czwartek: ${czwartek.temat}`);
  // Wtorek bierze uchwałę o powołaniu, więc czwartkowy poradnik o zmianie zarządu (prowadzi do niej) czeka 28 dni.
  assert.notEqual(czwartek.temat, wtorek.temat);
  assert.ok(!powiazaneTematy(wtorek.temat, oferta).has(czwartek.temat), `${wtorek.temat} ↔ ${czwartek.temat}`);
});

test("propozycja: czwartek 22.10 po wtorkowym wezwaniu — poradnik spółkowy, nie poradnik o wezwaniu", () => {
  const wezwanie = post("2026-10-20-ostateczne-wezwanie-do-zaplaty", "2026-10-20", "ostateczne-wezwanie-do-zaplaty", { status: "published" });
  const p = propozycjaTygodnia("2026-10-19", { wszystkie: [wpis("linkedin", wezwanie)], oferta, seria });
  const czwartek = p.miejsca.find((m) => m.kanal === "linkedin" && m.data === "2026-10-22");
  assert.equal(czwartek.temat, "poradniki/zmiana-czlonka-zarzadu-sp-z-o-o");
});

test("propozycja: LinkedIn bierze inne dokumenty dopiero, gdy spółkowe są zajęte", () => {
  const zajete = [
    wpis("linkedin", post("a", "2026-10-06", "uchwala-o-powolaniu-czlonka-zarzadu", { status: "published" })),
    wpis("linkedin", post("b", "2026-10-13", "ksiega-udzialow", { status: "published" })),
  ];
  const p = propozycjaTygodnia("2026-11-02", { wszystkie: zajete, oferta, seria });
  const wtorek = p.miejsca.find((m) => m.kanal === "linkedin" && m.data === "2026-11-03");
  assert.ok(wtorek.temat && !spolkowy(oferta.mapa.get(wtorek.temat), oferta), `wtorek: ${wtorek.temat}`);
});

const seriaZTematami = {
  tematy: [
    { id: "krs", fakt: "…", zrodlo: "https://biznesdok.pl/poradniki/zmiana-czlonka-zarzadu-sp-z-o-o", rozwiazanie: "uchwala-o-powolaniu-czlonka-zarzadu" },
    { id: "przedawnienie", fakt: "…", zrodlo: "https://biznesdok.pl/poradniki/jak-odzyskac-pieniadze-za-fakture", rozwiazanie: "ostateczne-wezwanie-do-zaplaty" },
    { id: "zlecenie", fakt: "…", zrodlo: "https://biznesdok.pl/dokument/umowa-zlecenia", rozwiazanie: "umowa-zlecenia" },
  ],
};

test("LinkedIn: odcinek serii AI tydzień po poradniku, z którego bierze fakt — blokuje", () => {
  const poradnik = post("por", "2026-10-22", "poradniki/zmiana-czlonka-zarzadu-sp-z-o-o", { status: "published" });
  const odcinek = post("ai", "2026-10-29", "poradniki/zmiana-czlonka-zarzadu-sp-z-o-o", { seria: "ai-zawiodlo", temat_serii: "krs", caption: "Decyduje prawnik.", slides: [{ layout: "headline", text: "Decyduje prawnik." }] });
  const wynik = ocenPost(odcinek, "linkedin", "2026-10-29", { wszystkie: [wpis("linkedin", poradnik)], oferta, seria: seriaZTematami });
  assert.ok(wynik.twarde.some((u) => u.startsWith("powtórka tematu") && u.includes("poradniki/zmiana-czlonka-zarzadu-sp-z-o-o")), wynik.twarde.join("; "));
});

test("propozycja: w tygodniu serii AI na LinkedIn odcinek bez powiązania z postami z ostatnich 28 dni", () => {
  // 2026-10-26 — tydzień parzysty (w czwartek seria AI). 22.10 był poradnik o zmianie zarządu, 20.10 wezwanie.
  const wszystkie = [
    wpis("linkedin", post("w", "2026-10-20", "ostateczne-wezwanie-do-zaplaty", { status: "published" })),
    wpis("linkedin", post("p", "2026-10-22", "poradniki/zmiana-czlonka-zarzadu-sp-z-o-o", { status: "planned" })),
  ];
  const p = propozycjaTygodnia("2026-10-26", { wszystkie, oferta, seria: seriaZTematami });
  const czwartek = p.miejsca.find((m) => m.kanal === "linkedin" && m.data === "2026-10-29");
  assert.equal(czwartek.temat, "seria-ai/zlecenie");
});
