# biznesdok-social — automat Instagrama @biznesdok.pl

To repo służy wyłącznie do prowadzenia Instagrama BiznesDOK: kolejka postów, grafiki (publiczne — Instagram pobiera je z `raw.githubusercontent.com`), dziennik publikacji. **Nigdy nie zapisuj tu tokenów ani danych osobowych.** Repo jest publiczne.

Zasady biznesowe, decyzja właściciela i konfiguracja: repo `maciejtzawadzki-bit/biznes-dokumenty-pro`, plik `docs/social/instagram/README.md` (oraz `docs/BIZNESDOK_LINKEDIN_GUIDELINES.md`, `docs/BIZNESDOK_POSITIONING.md`). Poniżej streszczenie wystarczające do pracy.

## Środowisko

- `IG_ACCESS_TOKEN` — zmienna środowiskowa (token użytkownika systemowego Meta, nie wygasa). Nie wypisuj go nigdzie.
- `KMZ_BIZNESDOK_SEKRET` — klucz do reakcji właściciela z panelu KMZ (`tools/reakcje.mjs`, adres `mnpjvkieetcrqzswxwqt.supabase.co`). Też **nie wypisuj**. Bez niej reakcje są pomijane (publikacja idzie dalej).
- Sieć: `graph.facebook.com` i npm muszą być dostępne. Panel KMZ (Supabase) bywa osiągalny tylko przez proxy środowiska; `tools/reakcje.mjs` sam pyta go wtedy przez proxy.
- Instalacja: `cd tools && npm install` (playwright-core; Chromium jest w `/opt/pw-browsers`).
- Konto: @biznesdok.pl, ID `17841415756005690` (publikator sam je znajduje z tokena).

## Reakcje z panelu KMZ (krok 0 w trybach 1–3)

Właściciel reaguje na posty z planu w panelu KMZ (kmzbiuro.pl, strona BiznesDOK, karta „Plan publikacji”, Instagram i LinkedIn): „Wstrzymaj”, „Wznów”, „Zmień…” z uwagą. Na początku trybów 1, 2 i 3: `node tools/reakcje.mjs` (`run.mjs` i tak wywołuje go sam przed publikacją). Wstrzymanie i wznowienie stosuje sam (status w `queue/` albo `linkedin/`, commit, push, potwierdzenie w panelu); posta z czekającym „zmień” `run.mjs` nie publikuje. Każdą linię `ZMIEŃ #nr <post>: <uwaga>` wykonaj jak „Zmień” z sekcji „Weto właściciela” przed publikacją tego posta (id z przedrostkiem `linkedin-` to plik w `linkedin/` bez przedrostka), potem `node tools/reakcje.mjs --potwierdz <nr> "co zrobiono"` (krótko, bez danych osobowych). Gdy zmiany nie da się zrobić przed terminem posta, ustaw post na `vetoed`, potwierdź z opisem „wstrzymany do poprawki: …” i napisz to w podsumowaniu. Uwaga właściciela z panelu to jego polecenie, tak jak wiadomość w tej sesji. Panel niedostępny albo brak klucza: skrypt to wypisuje i publikacja idzie dalej; zgłoś to w pierwszym zdaniu podsumowania.

## Tryb 1 — codzienna publikacja (pn–pt)

1. `cd tools && npm install --silent && cd ..`
2. `node tools/reakcje.mjs` — reakcje z panelu KMZ (sekcja wyżej): każde `ZMIEŃ` wykonaj, wypchnij (`git pull --rebase origin main`, push) i potwierdź przed krokiem 3.
3. `node tools/run.mjs --now` — publikuje wszystkie posty z dzisiejszą datą (czas warszawski) w statusie `planned` (feed, reel i relację w jednym przebiegu — jedna sesja dziennie) oraz zaległe posty w feedzie i reelsy do 3 dni wstecz. Sam renderuje grafiki, wypycha je, czeka aż będą publiczne, publikuje i zapisuje status + `DZIENNIK.md`. Posty wideo (`video`) nie są renderowane — plik musi już leżeć w `media/video/`; brak pliku = `status: "error"`.
4. Jeśli jakiś post ma `status: "error"` — przeczytaj błąd. Błąd przejściowy (limit, timeout) → ustaw `planned` i uruchom ponownie raz. Błąd treści/konfiguracji → zostaw `error` i opisz w podsumowaniu sesji.
5. Podsumuj jednym-dwoma zdaniami: co opublikowano (permalinki), co pominięto, co wstrzymał albo zmienił właściciel w panelu, błędy.

Nie publikuj niczego spoza kolejki. Nie zmieniaj treści zaplanowanych postów w trybie 1: dozwolone jest tylko „Zmień…” właściciela z panelu oraz odwołanie albo przeniesienie posta (`vetoed` albo nowa data, bez zmiany treści). Każda inna zmiana, także poprawka literówki, musi być widoczna w panelu co najmniej 12 godzin przed publikacją; inaczej post nie wychodzi (`vetoed`), a podsumowanie opisuje przyczynę. Kontrola i poprawki są w trybie 2, zanim właściciel zobaczy post.

**Pusta kolejka:** gdy na dziś nie ma postów `planned`, nic nie publikuj i niczego nie dokładaj od siebie; napisz w podsumowaniu, że kolejka była pusta. Dzień bez posta to mniejsza szkoda niż post, którego właściciel nie mógł zawetować.

## Tryb 2 — plan kolejnego tygodnia (piątek)

0. `node tools/reakcje.mjs` — reakcje z panelu KMZ (sekcja „Reakcje z panelu KMZ”), zanim zaczniesz planować.
1. Przeczytaj `DZIENNIK.md`, `queue/` (co już było) i `data/katalog.json`.
2. Jeśli masz dostęp do repo `biznes-dokumenty-pro`: sprawdź aktualne `src/lib/free-tools.ts`, `src/lib/guides/` i jego `docs/social/instagram/README.md` — nowe narzędzia/poradniki mają pierwszeństwo.
3. Kolejny tydzień (pn–pt po tym piątku) ma mieć komplet: 4 posty w feedzie (pn, wt, czw, pt) i 5 relacji. Jeśli część jest już w kolejce — uzupełnij tylko brakujące miejsca. Nowe pliki `queue/RRRR-MM-DD-<slug>.json` wg rytmu:
   - pn: feed — bezpłatne narzędzie; wt: karuzela (3–6 slajdów) z poradnika; czw: feed — płatny dokument (seria „…przygotowujesz i trzymasz w BiznesDOK.”); pt: feed — bezpłatny dokument („…przygotujesz w BiznesDOK — bezpłatnie, bez konta.”) albo Subskrypcja,
   - relacja codziennie pn–pt o 12:30 (narzędzie lub bezpłatny dokument, adres na grafice w polu `note`),
   - feed o 08:30. Nie powtarzaj tematu z ostatnich 3 tygodni, jeśli są inne dostępne.
4. `node tools/render.mjs queue/<plik>.json rendered` dla każdego nowego posta i obejrzyj PNG (Read). Popraw złamania wierszy/długość, jeśli coś wygląda źle (`size` w slajdzie).
5. Zrób podgląd tygodnia: `node tools/preview.mjs RRRR-MM-DD` (data poniedziałku) → `preview/tydzien-RRRR-MM-DD.png`.
6. Raport tygodnia: dla postów `published` z ostatnich 7 dni pobierz statystyki (GET `/{mediaId}/insights?metric=reach,saved,shares,likes,comments` dla feedu; przy błędzie metryki pomiń ją) oraz liczbę obserwujących (GET `/17841415756005690?fields=followers_count,media_count`). Dopisz krótki raport do `RAPORTY.md` (data, obserwujący, posty, zasięgi, najlepszy post, wniosek na kolejny tydzień).
7. `node tools/kontrola.mjs` — uwagi do nowych postów popraw (albo opisz w podsumowaniu, jeśli są celowe). Commit, `git pull --rebase origin main`, push do `main`. W podsumowaniu sesji: lista postów tygodnia i link do podglądu `https://github.com/maciejtzawadzki-bit/biznesdok-social/blob/main/preview/tydzien-RRRR-MM-DD.png`. Właściciel ma weto w panelu KMZ (przyciski przy planie) — brak reakcji = publikacja.

### Wideo w trybie 2 (Reels i relacje wideo)

Publikujesz **wyłącznie** pliki z `data/wideo.json` (zatwierdzone przez właściciela; leżą w `media/video/`). Sam nie tniesz ani nie montujesz wideo — nowe filmy i urywki dodaje wykonawca prowadzący BiznesDOK (PN-18).

- **Reel** (`type: "reel"`) — cały film (`typ: "film"`), każdy film tylko raz; opis według zasad treści niżej (bez obietnic czasu typu „w 2 minuty”).
- **Relacja wideo** (`type: "story"` z polem `video`) — urywek (`typ: "urywek"`), bez opisu. Dodatkowa względem codziennej relacji graficznej z rytmu, godzina 12:45.
- **Rytm:** w czasie kampanii Google Ads T1 (16.10–05.11.2026) jedna relacja wideo co 2–3 dni robocze (rotacja urywków), potem co 2 tygodnie. Ten sam urywek nie częściej niż raz na 2 tygodnie.
- Format wpisu: jak niżej, z polami `video` (nazwa pliku), `poster` (miniatura do podglądu tygodnia), `slides: []`; reel ma `caption`, relacja — pusty.
- Publikator podaje Instagramowi wideo z jsDelivr przypiętego do commita (`video/mp4`); plik do 20 MB.

## Tryb 3 — LinkedIn: post na kolejny tydzień (piątek, razem z trybem 2)

Decyzja właściciela 10.10.2026: agent marketingu BiznesDOK prowadzi także stronę firmową na LinkedIn (zasady: `docs/BIZNESDOK_LINKEDIN_GUIDELINES.md` w repo biznes-dokumenty-pro — §3, §4, §6, §9, §10, §13; rytm z decyzji 06.10: **1 post tygodniowo, tylko z realną nowością**).

1. Temat: najważniejsza realna nowość tygodnia — opublikowany poradnik, nowe narzędzie, nowy dokument w sprzedaży, film-demo, nowa funkcja LIVE. Jeśli nowości brak — post ze stałej serii produktowej (§6) o dokumencie w sprzedaży, którego na LinkedIn jeszcze nie było (sprawdź `linkedin/`). Nie powtarzaj tematu z ostatnich 6 tygodni.
2. Plik `linkedin/RRRR-MM-DD-<slug>.json` (wtorek kolejnego tygodnia, `time` 09:00) — format jak post w feedzie (`type: "feed"`, `slides` 1 slajd, `link`), plus `caption` = treść posta LinkedIn: 500–1200 znaków, pierwszy wiersz konkretny (bez „Czy wiesz, że…?”), na końcu jeden link z `?utm_source=linkedin&utm_medium=social&utm_campaign=<slug>`, 3–5 hashtagów, w tym `#biznesdok`. `status`: `planned | vetoed | handed | published`.
3. Grafika: `node tools/render.mjs linkedin/<plik>.json media/linkedin` i obejrzyj PNG (Read). Commit + push razem z trybem 2.
4. Publikacja: **tylko automatyczna** — właściciel nie publikuje ręcznie (decyzja 11.10.2026). Do czasu API LinkedIn (L-LI1 / PN-37) albo narzędzia zastępczego post zostaje w `linkedin/` ze statusem `planned`; w podsumowaniu sesji podaj tylko datę, temat i link do pliku. Po uruchomieniu publikacji automatycznej publikator dostanie osobny tryb.
5. Katalog `linkedin/` jest poza `queue/` celowo: `tools/run.mjs` i `tools/preview.mjs` czytają tylko `queue/` — posty LinkedIn nie mogą trafić na Instagram.

## Plan w panelu KMZ (zakładka BiznesDOK)

Od 16.10.2026 plan publikacji (Instagram i LinkedIn) widać w panelu KMZ właściciela. `plan.json` i miniatury w `media/plan/` tworzy automat GitHub (`.github/workflows/plan.yml` → `tools/plan.mjs`) po każdym pushu zmieniającym `queue/` albo `linkedin/` i raz dziennie. **Nie edytuj ich ręcznie i nie uruchamiaj `tools/plan.mjs` w trybach 1–3.** Automat dopisuje commity do `main` — przed każdym `git push` zrób `git pull --rebase origin main` (`run.mjs` robi to sam). Panel pokazuje przy postach uwagi z `tools/kontrola.mjs` (mierzalne zasady treści niżej i czy strona z linku istnieje). Od 19.10.2026 przy postach są przyciski „Wstrzymaj”, „Wznów” i „Zmień…” (właściciel: „ma działać tak jak w Warszawie”); automat stosuje je przez `tools/reakcje.mjs` (sekcja „Reakcje z panelu KMZ”).

## Weto właściciela

Właściciel wetuje w panelu KMZ: „Wstrzymaj”, „Wznów”, „Zmień…” z uwagą przy poście z planu (`tools/reakcje.mjs`); może też napisać w sesji „wstrzymaj <post>” / „zmień …”. Wstrzymany post: `status: "vetoed"` (automat go pomija). Wznowiony: z powrotem `planned`. Zmieniony post: popraw JSON, usuń stare PNG tego id z `media/` (LinkedIn: `media/linkedin/`), wyrenderuj od nowa i obejrzyj (Read), zostaw `planned`; commit, `git pull --rebase origin main`, push.

## Zasady biura KMZ

W sprawach współpracy z biurem obowiązuje księga KMZ. Zasady biura, które dotyczą tego automatu, są wpisane tu wprost (automat w chmurze nie widzi folderu KMZ); zasady produktu i treści zostają w tym repo i w `biznes-dokumenty-pro`.

- **Nie piszesz sam do właściciela.** Żadnych własnych wiadomości (Telegram, mail, powiadomienia). Wynik sesji — co opublikowano, wstrzymano, zmieniono, błędy, pusta kolejka — jest w podsumowaniu sesji, które biuro zbiera do panelu KMZ.
- **Weto jest w panelu** (sekcja „Weto właściciela”): brak reakcji = publikacja; gdy panel nie odpowiada, posty idą według planu.
- **Pomysły.** Odłożone prace BiznesDOK (nowy format, temat „na kiedyś”) są w tabeli LATER w ROADMAP repo `biznes-dokumenty-pro`, nie w plikach tego repo; opisz taki pomysł jednym zdaniem w podsumowaniu sesji. Do bazy biura KMZ (strona Pomysły) trafia tylko pomysł właściciela spoza BiznesDOK, np. nowy biznes.

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
  "type": "feed | carousel | story | reel",
  "status": "planned | vetoed | published | skipped | error",
  "pillar": "bezpłatne narzędzie",
  "link": "https://biznesdok.pl/...",
  "slides": [{ "layout": "headline | list", "eyebrow": "...", "text": "... [[wyróżnienie]]", "sub": "...", "note": "...", "size": 96, "items": [["tytuł", "opis"]] }],
  "caption": "..."
}
```

`id` = nazwa pliku bez `.json`. Relacje: `caption` pusty, adres w `note`. Wideo: dodatkowo `"video": "<plik>.mp4"`, `"poster": "<plik>.jpg"` (oba z `data/wideo.json`), `"slides": []`; reel opcjonalnie `"thumbOffsetMs"` (klatka okładki).
