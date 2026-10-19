// Testy reakcji z panelu KMZ (tools/reakcje.mjs) bez sieci, plików i gita. Uruchomienie: node --test tools/reakcje.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { zastosuj } from "./reakcje.mjs";

const wpis = (id, status, { date = "2026-10-23", type = "feed", linkedin = false } = {}) => [
  linkedin ? `linkedin-${id}` : id,
  { file: `${linkedin ? "linkedin" : "queue"}/${id}.json`, post: { id, date, type, status }, linkedin },
];
const reakcja = (id, r, post_id, uwaga = null) => ({ id, reakcja: r, post_id, uwaga, kiedy: "2026-10-19T12:00:00Z" });

test("wstrzymaj i wznów zmieniają status; „zmień” czeka na agenta", () => {
  const kolejka = new Map([wpis("a", "planned"), wpis("b", "vetoed"), wpis("c", "planned"), wpis("d", "error")]);
  const { zastosowane, doZmiany, zmienione } = zastosuj(
    [reakcja(1, "wstrzymaj", "a"), reakcja(2, "wznow", "b"), reakcja(3, "zmien", "c", "krótszy nagłówek"), reakcja(4, "wstrzymaj", "d")],
    kolejka,
    "2026-10-19",
  );
  assert.deepEqual(zastosowane, [{ id: 1, wynik: "wstrzymany" }, { id: 2, wynik: "wznowiony" }, { id: 4, wynik: "wstrzymany" }]);
  assert.deepEqual(doZmiany.map((r) => r.id), [3]);
  assert.deepEqual([...zmienione], ["a", "b", "d"]);
  assert.equal(kolejka.get("a").post.status, "vetoed");
  assert.equal(kolejka.get("b").post.status, "planned");
  assert.equal(kolejka.get("c").post.status, "planned");
  assert.equal(kolejka.get("d").post.status, "vetoed");
});

test("bez zmian: opublikowany, zły status, brak posta; Instagram i LinkedIn osobno", () => {
  const kolejka = new Map([
    wpis("a", "published"),
    wpis("b", "planned"),
    wpis("c", "skipped"),
    wpis("2026-10-20-ostateczne-wezwanie-do-zaplaty", "planned", { linkedin: true }),
    wpis("2026-10-13-poradnik", "published", { linkedin: true }),
  ]);
  const { zastosowane, zmienione } = zastosuj(
    [
      reakcja(1, "wstrzymaj", "a"),
      reakcja(2, "wznow", "b"),
      reakcja(3, "wstrzymaj", "c"),
      reakcja(4, "wstrzymaj", "nie-ma"),
      reakcja(5, "wstrzymaj", "linkedin-2026-10-20-ostateczne-wezwanie-do-zaplaty"),
      // id posta LinkedIn bez przedrostka to nie ten post
      reakcja(6, "wstrzymaj", "2026-10-20-ostateczne-wezwanie-do-zaplaty"),
      reakcja(7, "wstrzymaj", "linkedin-2026-10-13-poradnik"),
    ],
    kolejka,
    "2026-10-19",
  );
  assert.deepEqual(zastosowane, [
    { id: 1, wynik: "już opublikowany; usunąć albo poprawić można tylko w aplikacji Instagram" },
    { id: 2, wynik: "bez zmian (status planned)" },
    { id: 3, wynik: "bez zmian (status skipped)" },
    { id: 4, wynik: "nie ma takiego posta w kolejce" },
    { id: 5, wynik: "wstrzymany" },
    { id: 6, wynik: "nie ma takiego posta w kolejce" },
    { id: 7, wynik: "już opublikowany na LinkedIn" },
  ]);
  assert.deepEqual([...zmienione], ["linkedin-2026-10-20-ostateczne-wezwanie-do-zaplaty"]);
  assert.equal(kolejka.get("linkedin-2026-10-20-ostateczne-wezwanie-do-zaplaty").post.status, "vetoed");
});

test("wznów po terminie: wynik zawsze zaczyna się od „wznowiony” i mówi, czy post jeszcze wyjdzie", () => {
  const kolejka = new Map([
    wpis("feed", "vetoed", { date: "2026-10-17" }),
    wpis("stary", "vetoed", { date: "2026-10-15" }),
    wpis("relacja", "vetoed", { date: "2026-10-18", type: "story" }),
    wpis("li", "vetoed", { date: "2026-10-13", linkedin: true }),
  ]);
  const { zastosowane } = zastosuj(
    [reakcja(1, "wznow", "feed"), reakcja(2, "wznow", "stary"), reakcja(3, "wznow", "relacja"), reakcja(4, "wznow", "linkedin-li")],
    kolejka,
    "2026-10-19",
  );
  assert.ok(zastosowane.every((z) => z.wynik.startsWith("wznowiony")));
  assert.match(zastosowane[0].wynik, /wyjdzie przy najbliższej publikacji/);
  assert.match(zastosowane[1].wynik, /pominie/);
  assert.match(zastosowane[2].wynik, /pominie/);
  assert.equal(zastosowane[3].wynik, "wznowiony");
});
