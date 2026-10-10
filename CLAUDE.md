# biznesdok-social — automat Instagrama @biznesdok.pl

To repo służy wyłącznie do prowadzenia Instagrama BiznesDOK: kolejka postów, grafiki (publiczne — Instagram pobiera je z `raw.githubusercontent.com`), dziennik publikacji. **Nigdy nie zapisuj tu tokenów ani danych osobowych.** Repo jest publiczne.

Zasady biznesowe, decyzja właściciela i konfiguracja: repo `maciejtzawadzki-bit/biznes-dokumenty-pro`, plik `docs/social/instagram/README.md` (oraz `docs/BIZNESDOK_LINKEDIN_GUIDELINES.md`, `docs/BIZNESDOK_POSITIONING.md`). Poniżej streszczenie wystarczające do pracy.

## Środowisko

- `IG_ACCESS_TOKEN` — zmienna środowiskowa (token użytkownika systemowego Meta, nie wygasa). Nie wypisuj go nigdzie.
- Sieć: `graph.facebook.com` i npm muszą być dostępne.
- Instalacja: `cd tools && npm install` (playwright-core; Chromium jest w `/opt/pw-browsers`).
- Konto: @biznesdok.pl, ID `17841415756005690` (publikator sam je znajduje z tokena).

## Tryb 1 — codzienna publikacja (pn–pt)

1. `cd tools && npm install --silent && cd ..`
2. `node tools/run.mjs --now` — publikuje wszystkie posty z dzisiejszą datą (czas warszawski) w statusie `planned` (feed i relację w jednym przebiegu — jedna sesja dziennie) oraz zaległe posty w feedzie do 3 dni wstecz. Sam renderuje grafiki, wypycha je, czeka aż będą publiczne, publikuje i zapisuje status + `DZIENNIK.md`.
3. Jeśli jakiś post ma `status: "error"` — przeczytaj błąd. Błąd przejściowy (limit, timeout) → ustaw `planned` i uruchom ponownie raz. Błąd treści/konfiguracji → zostaw `error` i opisz w podsumowaniu sesji.
4. Podsumuj jednym-dwoma zdaniami: co opublikowano (permalinki), co pominięto, błędy.

Nie publikuj niczego spoza kolejki. Nie zmieniaj treści zaplanowanych postów w trybie 1 (poza oczywistą literówką).

## Tryb 2 — plan kolejnego tygodnia (piątek)

1. Przeczytaj `DZIENNIK.md`, `queue/` (co już było) i `data/katalog.json`.
2. Jeśli masz dostęp do repo `biznes-dokumenty-pro`: sprawdź aktualne `src/lib/free-tools.ts`, `src/lib/guides/` i jego `docs/social/instagram/README.md` — nowe narzędzia/poradniki mają pierwszeństwo.
3. Kolejny tydzień (pn–pt po tym piątku) ma mieć komplet: 4 posty w feedzie (pn, wt, czw, pt) i 5 relacji. Jeśli część jest już w kolejce — uzupełnij tylko brakujące miejsca. Nowe pliki `queue/RRRR-MM-DD-<slug>.json` wg rytmu:
   - pn: feed — bezpłatne narzędzie; wt: karuzela (3–6 slajdów) z poradnika; czw: feed — płatny dokument (seria „…przygotowujesz i trzymasz w BiznesDOK.”); pt: feed — bezpłatny dokument („…przygotujesz w BiznesDOK — bezpłatnie, bez konta.”) albo Subskrypcja,
   - relacja codziennie pn–pt o 12:30 (narzędzie lub bezpłatny dokument, adres na grafice w polu `note`),
   - feed o 08:30. Nie powtarzaj tematu z ostatnich 3 tygodni, jeśli są inne dostępne.
4. `node tools/render.mjs queue/<plik>.json rendered` dla każdego nowego posta i obejrzyj PNG (Read). Popraw złamania wierszy/długość, jeśli coś wygląda źle (`size` w slajdzie).
5. Zrób podgląd tygodnia: `node tools/preview.mjs RRRR-MM-DD` (data poniedziałku) → `preview/tydzien-RRRR-MM-DD.png`.
6. Raport tygodnia: dla postów `published` z ostatnich 7 dni pobierz statystyki (GET `/{mediaId}/insights?metric=reach,saved,shares,likes,comments` dla feedu; przy błędzie metryki pomiń ją) oraz liczbę obserwujących (GET `/17841415756005690?fields=followers_count,media_count`). Dopisz krótki raport do `RAPORTY.md` (data, obserwujący, posty, zasięgi, najlepszy post, wniosek na kolejny tydzień).
7. Commit + push do `main`. W podsumowaniu sesji: lista postów tygodnia i link do podglądu `https://github.com/maciejtzawadzki-bit/biznesdok-social/blob/main/preview/tydzien-RRRR-MM-DD.png`. Właściciel ma weto — brak odpowiedzi = publikacja.

## Tryb 3 — LinkedIn: post na kolejny tydzień (piątek, razem z trybem 2)

Decyzja właściciela 10.10.2026: agent marketingu BiznesDOK prowadzi także stronę firmową na LinkedIn (zasady: `docs/BIZNESDOK_LINKEDIN_GUIDELINES.md` w repo biznes-dokumenty-pro — §3, §4, §6, §9, §10, §13; rytm z decyzji 06.10: **1 post tygodniowo, tylko z realną nowością**).

1. Temat: najważniejsza realna nowość tygodnia — opublikowany poradnik, nowe narzędzie, nowy dokument w sprzedaży, film-demo, nowa funkcja LIVE. Jeśli nowości brak — post ze stałej serii produktowej (§6) o dokumencie w sprzedaży, którego na LinkedIn jeszcze nie było (sprawdź `linkedin/`). Nie powtarzaj tematu z ostatnich 6 tygodni.
2. Plik `linkedin/RRRR-MM-DD-<slug>.json` (wtorek kolejnego tygodnia, `time` 09:00) — format jak post w feedzie (`type: "feed"`, `slides` 1 slajd, `link`), plus `caption` = treść posta LinkedIn: 500–1200 znaków, pierwszy wiersz konkretny (bez „Czy wiesz, że…?”), na końcu jeden link z `?utm_source=linkedin&utm_medium=social&utm_campaign=<slug>`, 3–5 hashtagów, w tym `#biznesdok`. `status`: `planned | vetoed | handed | published`.
3. Grafika: `node tools/render.mjs linkedin/<plik>.json media/linkedin` i obejrzyj PNG (Read). Commit + push razem z trybem 2.
4. Publikacja: **do czasu dostępu do API LinkedIn publikuje właściciel** — w podsumowaniu sesji podaj gotową treść posta i link do PNG (`https://github.com/maciejtzawadzki-bit/biznesdok-social/blob/main/media/linkedin/<id>-01.png`), datę i godzinę publikacji. Post z poprzedniego tygodnia ze statusem `planned` oznacz jako `handed` (przekazany właścicielowi). Po uzyskaniu API (L-LI1 / PN-37) publikator dostanie osobny tryb.
5. Katalog `linkedin/` jest poza `queue/` celowo: `tools/run.mjs` i `tools/preview.mjs` czytają tylko `queue/` — posty LinkedIn nie mogą trafić na Instagram.

## Weto właściciela

Właściciel może napisać w dowolnej sesji „wstrzymaj <post>” / „zmień …”. Wstrzymany post: `status: "vetoed"` (automat go pomija). Zmieniony post: popraw JSON, usuń stare PNG z `media/` dla tego id, zostaw `planned`.

## Zasady treści (obowiązkowe — publikacja jest automatyczna)

1. **Główna obietnica (zablokowana):** „Dokumenty przygotowane przez prawników. Dopasowane technologią.” Wspierająca: „Ty podajesz dane. BiznesDOK przygotowuje resztę.”
2. **Tylko to, co LIVE:** dokumenty z `data/katalog.json` o statusie `active`, narzędzia i poradniki opublikowane na biznesdok.pl. Zapowiedzi nie reklamujemy jako dostępnych.
3. **Fakty prawne wyłącznie z opublikowanych treści BiznesDOK** (poradniki, strony narzędzi, opisy produktów). Nie formułuj nowych tez prawnych, terminów ani kwot.
4. **Bez cen, kodów rabatowych i niezweryfikowanych liczb/czasów** („w minutę”, „oszczędzasz godzinę”).
5. **Ton:** konkretny, profesjonalny, prosty, pewny siebie bez zadęcia. Product-first: znane zadanie → prostszy sposób z BiznesDOK → praca zdjęta z klienta → treść od prawników → CTA. Zakazane: „Masz problem?”, „Mamy rozwiązanie”, „Czy wiesz, że…?”, „startujemy”, „rewolucjonizujemy”, tłumaczenie oczywistego celu dokumentu, obietnice wyniku prawnego, sugerowanie indywidualnej porady prawnej.
6. **AI nie jest autorem dokumentów** — nie pisz, że dokumenty tworzy AI. Treść przygotowują prawnicy (Katarzyna Zawadzka Legal Consulting), technologia uzupełnia dane.
7. **Grafiki tylko z `tools/render.mjs`** (brandbook: paper, Instrument Serif, clause highlight `[[...]]`, lockup BD prawy dół). Bez zdjęć, stocków, ikon, grafik AI, nowych kolorów i sloganów.
8. **Opis:** wnosi coś nowego względem grafiki, kończy się jednym CTA („Link w bio → Narzędzia / Poradniki / Dokumenty”) i 5–8 hashtagami, w tym `#biznesdok`.

## Format posta (queue/*.json)

```json
{
  "id": "2026-10-05-kalkulator-wynagrodzen",
  "date": "2026-10-05", "time": "08:30",
  "type": "feed | carousel | story",
  "status": "planned | vetoed | published | skipped | error",
  "pillar": "bezpłatne narzędzie",
  "link": "https://biznesdok.pl/...",
  "slides": [{ "layout": "headline | list", "eyebrow": "...", "text": "... [[wyróżnienie]]", "sub": "...", "note": "...", "size": 96, "items": [["tytuł", "opis"]] }],
  "caption": "..."
}
```

`id` = nazwa pliku bez `.json`. Relacje: `caption` pusty, adres w `note`.
