# biznesdok-social — automat Instagrama @biznesdok.pl i LinkedIna BiznesDOK

To repo służy wyłącznie do prowadzenia Instagrama i strony firmowej LinkedIn BiznesDOK: kolejka postów, grafiki (publiczne — Instagram i Buffer pobierają je z `raw.githubusercontent.com`), dziennik publikacji. **Nigdy nie zapisuj tu tokenów, kluczy ani danych osobowych.** Repo jest publiczne.

Zasady biznesowe, decyzje właściciela i konfiguracja: repo `maciejtzawadzki-bit/biznes-dokumenty-pro` — `docs/social/instagram/README.md`, `docs/BIZNESDOK_LINKEDIN_GUIDELINES.md`, `docs/BIZNESDOK_POSITIONING.md`. Poniżej streszczenie wystarczające do pracy.

**Kierunek (decyzja właściciela 20.10.2026, po audycie treści):** treści mają sprzedawać i być spójne. Płatne dokumenty i Subskrypcja w większości publikacji, cała oferta po kolei, zero powtórek, każdy temat w swoim okresie przydatności, seria „AI zawiodło? Decyduje prawnik” co 2 tygodnie, LinkedIn automatycznie — a wszystko „inteligentnie zaproponowane, zaadresowane, zaplanowane i pilnowane na bieżąco i stale”. Tematy proponuje `tools/propozycja.mjs`, pilnuje `tools/kontrola.mjs` (post z twardą uwagą nie wyjdzie), stan pokazuje `tools/zgodnosc.mjs`.

## Środowisko

- `IG_ACCESS_TOKEN` — zmienna środowiskowa (token użytkownika systemowego Meta, nie wygasa). Nie wypisuj go nigdzie.
- `KMZ_BIZNESDOK_SEKRET` — klucz do reakcji właściciela z panelu KMZ (`tools/reakcje.mjs`, adres `mnpjvkieetcrqzswxwqt.supabase.co`). Też **nie wypisuj**. Bez niej reakcje są pomijane (publikacja idzie dalej).
- `BUFFER_API_KEY` — klucz API Buffera (strona firmowa BiznesDOK na LinkedIn połączona z Bufferem; zakłada właściciel). **Nie wypisuj.** Opcjonalnie `BUFFER_CHANNEL_ID`, gdy w Bufferze jest więcej niż jeden kanał LinkedIn (`node tools/linkedin.mjs --kanaly`). Bez klucza posty LinkedIn czekają w `linkedin/` (status `planned`), a podsumowanie trybu 1 to mówi.
- Sieć: `graph.facebook.com`, `api.buffer.com` i npm muszą być dostępne. Panel KMZ (Supabase) bywa osiągalny tylko przez proxy środowiska; `tools/reakcje.mjs` sam pyta go wtedy przez proxy.
- Instalacja: `cd tools && npm install` (playwright-core). Chromium renderer znajduje sam (`tools/chromium.mjs`): `CHROMIUM_PATH`, potem `PLAYWRIGHT_BROWSERS_PATH`, `/opt/pw-browsers` i `~/.cache/ms-playwright` w układzie `chrome-linux64` i starszym `chrome-linux`, na końcu ścieżka z playwright-core. Gdy żadnej nie ma, `run.mjs` kończy się błędem „Nie znaleziono Chromium…”: wtedy raz `cd tools && npx playwright-core install chromium && cd ..` i ponów `run.mjs`. Nie rób dowiązań ani zmian poza repo (znikają z piaskownicą); gdy instalacja się nie uda, nic nie publikuj i opisz błąd w pierwszym zdaniu podsumowania.
- Konto Instagram: @biznesdok.pl, ID `17841415756005690` (publikator sam je znajduje z tokena).

## Reakcje z panelu KMZ (krok 0 w trybach 1–3)

Właściciel reaguje na posty z planu w panelu KMZ (kmzbiuro.pl, strona BiznesDOK, karta „Plan publikacji”, Instagram i LinkedIn): „Wstrzymaj”, „Wznów”, „Zmień…” z uwagą. Na początku trybów 1, 2 i 3: `node tools/reakcje.mjs` (`run.mjs` i tak wywołuje go sam przed publikacją). Wstrzymanie i wznowienie stosuje sam (status w `queue/` albo `linkedin/`, commit, push, potwierdzenie w panelu); posta z czekającym „zmień” `run.mjs` nie publikuje. Każdą linię `ZMIEŃ #nr <post>: <uwaga>` wykonaj jak „Zmień” z sekcji „Weto właściciela” przed publikacją tego posta (id z przedrostkiem `linkedin-` to plik w `linkedin/` bez przedrostka), potem `node tools/reakcje.mjs --potwierdz <nr> "co zrobiono"` (krótko, bez danych osobowych). Gdy zmiany nie da się zrobić przed terminem posta, ustaw post na `vetoed`, potwierdź z opisem „wstrzymany do poprawki: …” i napisz to w podsumowaniu. Uwaga właściciela z panelu to jego polecenie, tak jak wiadomość w tej sesji. Panel niedostępny albo brak klucza: skrypt to wypisuje i publikacja idzie dalej; zgłoś to w pierwszym zdaniu podsumowania.

## Tryb 1 — codzienna publikacja (pn–pt)

1. `cd tools && npm install --silent && cd ..`
2. `node tools/reakcje.mjs` — reakcje z panelu KMZ (sekcja wyżej): każde `ZMIEŃ` wykonaj, wypchnij (`git pull --rebase origin main`, push) i potwierdź przed krokiem 3.
3. `node tools/run.mjs --now` — publikuje wszystkie posty Instagrama z dzisiejszą datą (czas warszawski) w statusie `planned` (feed, reel i relację w jednym przebiegu — jedna sesja dziennie) oraz zaległe posty w feedzie i reelsy do 3 dni wstecz. Przed każdym postem **kontrola treści**: post z twardą uwagą nie wychodzi (status `error`, „kontrola treści: …”). Potem przekazuje do Buffera posty LinkedIn z dzisiejszą datą (z terminem na ich godzinę) i zaległe do 3 dni. Na końcu wypisuje jedno zdanie kontroli treści. Sam renderuje grafiki, wypycha je, czeka aż będą publiczne, publikuje i zapisuje status + `DZIENNIK.md`. Posty wideo (`video`) nie są renderowane — plik musi już leżeć w `media/video/`; brak pliku = `status: "error"`.
4. Jeśli jakiś post ma `status: "error"` — przeczytaj błąd. Błąd przejściowy (limit, timeout) → ustaw `planned` i uruchom ponownie raz. Błąd treści/konfiguracji albo „kontrola treści: …” → zostaw `error` i opisz w podsumowaniu (zatrzymanie przez kontrolę znaczy, że plan tygodnia przepuścił błąd — przyczynę poprawia tryb 2).
5. Podsumuj jednym-dwoma zdaniami: co opublikowano (permalinki), co przekazano do Buffera, co pominięto lub zatrzymała kontrola, co wstrzymał albo zmienił właściciel w panelu, błędy; dołącz zdanie kontroli treści z `run.mjs`.

Nie publikuj niczego spoza kolejki. Nie zmieniaj treści zaplanowanych postów w trybie 1: dozwolone jest tylko „Zmień…” właściciela z panelu oraz odwołanie albo przeniesienie posta (`vetoed` albo nowa data, bez zmiany treści). Każda inna zmiana, także poprawka literówki, musi być widoczna w panelu co najmniej 12 godzin przed publikacją; inaczej post nie wychodzi (`vetoed`), a podsumowanie opisuje przyczynę. Kontrola i poprawki są w trybie 2, zanim właściciel zobaczy post.

**Pusta kolejka:** gdy na dziś nie ma postów `planned`, nic nie publikuj i niczego nie dokładaj od siebie; napisz w podsumowaniu, że kolejka była pusta. Dzień bez posta to mniejsza szkoda niż post, którego właściciel nie mógł zawetować.

## Tryb 2 — plan kolejnego tygodnia (piątek): dwa tygodnie naprzód

**Plan sięga dwa tygodnie naprzód** (decyzja właściciela 28.10.2026: „agent BiznesDOK układa w piątek dwa tygodnie zamiast jednego, więc zawsze widzisz 7–14 dni” — „reszta ok”). W piątek planujesz **dwa kolejne tygodnie** (od najbliższego poniedziałku do niedzieli tydzień później), tylko brakujące miejsca: tydzień, który został zaplanowany w poprzedni piątek jako drugi, zwykle jest już pełny i zostaje bez zmian, a dochodzi nowy drugi tydzień. Gdy polecenie piątkowe mówi „plan kolejnego tygodnia” albo „posty na kolejny tydzień”, chodzi o ten tryb, czyli o dwa kolejne tygodnie. Weto działa jak dotąd: każdy post jest w panelu KMZ od piątku, więc na długo przed granicą 12 godzin przed publikacją.

0. `node tools/reakcje.mjs` — reakcje z panelu KMZ (sekcja „Reakcje z panelu KMZ”), zanim zaczniesz planować.
1. Przeczytaj `DZIENNIK.md`, `RAPORTY.md`, `data/oferta.json` (tematy, priorytety, okresy, **fakty**), `data/seria-ai.json` i `data/wideo.json`.
2. Jeśli masz dostęp do repo `biznes-dokumenty-pro`: sprawdź `src/lib/free-tools.ts`, `src/lib/guides/` i `docs/social/instagram/README.md`. Nowy poradnik albo dokument, którego nie ma w `data/oferta.json`, **nie trafia do planu** — opisz go w podsumowaniu (prowadzący dopisuje go do oferty z faktami i okresem).
3. `node tools/propozycja.mjs` — propozycja tematów na każde miejsce rytmu dwóch kolejnych tygodni (sekcja „Rytm tygodnia”; tematy pierwszego tygodnia liczą się do powtórek drugiego): najpierw płatne dokumenty i Subskrypcja, cała oferta po kolei, bez powtórki tematu (Instagram 21 dni, LinkedIn 120 dni), z pierwszeństwem tematów w ich okresie przydatności, seria AI w tygodnie parzyste; na LinkedIn najpierw dokumenty spółki. Bierz te tematy. Zamiana tematu tylko z powodem (np. ważna nowość) — zapisz go w podsumowaniu. Miejsca już zajęte w kolejce zostają.
4. Dla każdego miejsca utwórz plik `queue/RRRR-MM-DD-<slug>.json` (feed 08:30, relacja 12:30) — pole `temat` z propozycji, `link` z oferty. Tekst grafiki i opis **tylko z faktów tematu** (`fakty` w `data/oferta.json`, w serii AI — `fakt` i `zrodlo`) i według „Zasad treści”. Nie powtarzaj hasła, które już było na grafice.
5. `node tools/render.mjs queue/<plik>.json rendered` dla każdego nowego posta i obejrzyj PNG (Read). Popraw złamania wierszy i długość (`size` w slajdzie), jeśli coś wygląda źle.
6. Wideo: sekcja „Wideo w trybie 2” niżej (wolne urywki wypisuje `propozycja.mjs`).
7. `node tools/kontrola.mjs` — **żadnej uwagi „BLOKUJE”** (takiego posta publikator nie wypuści) i żadnej uwagi do obu planowanych tygodni (od piątku skrypt pokazuje też tydzień po kolejnym); miękkie uwagi popraw albo świadomie zostaw (widać je w panelu).
8. Podgląd: `node tools/preview.mjs RRRR-MM-DD` osobno dla poniedziałku każdego z dwóch tygodni → `preview/tydzien-RRRR-MM-DD.png` (dwa pliki).
9. Raport tygodnia: dla postów `published` z ostatnich 7 dni pobierz statystyki (GET `/{mediaId}/insights?metric=reach,saved,shares,likes,comments` dla feedu; przy błędzie metryki pomiń ją) oraz liczbę obserwujących (GET `/17841415756005690?fields=followers_count,media_count`). Dopisz do `RAPORTY.md`: data, obserwujący, posty, zasięgi, najlepszy post, wniosek na kolejny tydzień, a pod spodem wynik `node tools/zgodnosc.mjs` (zgodność treści).
10. Gdy wykorzystasz temat serii AI, wpisz datę w jego polu `instagram` albo `linkedin` w `data/seria-ai.json`.
11. Commit, `git pull --rebase origin main`, push do `main`. W podsumowaniu sesji: lista postów obu tygodni (nowe oddzielone od tych, które już były w kolejce), zdanie z `zgodnosc.mjs --krotko` i linki do obu podglądów `https://github.com/maciejtzawadzki-bit/biznesdok-social/blob/main/preview/tydzien-RRRR-MM-DD.png`. Właściciel ma weto w panelu KMZ (przyciski przy planie) — brak reakcji = publikacja.

### Wideo w trybie 2 (Reels i relacje wideo)

Publikujesz **wyłącznie** pliki z `data/wideo.json` (zatwierdzone przez właściciela; leżą w `media/video/`). Sam nie tniesz ani nie montujesz wideo — nowe filmy i urywki dodaje wykonawca prowadzący BiznesDOK (PN-18).

- **Reel** (`type: "reel"`) — cały film (`typ: "film"`), każdy film tylko raz; opis według zasad treści niżej (bez obietnic czasu typu „w 2 minuty”, bez pytania na start).
- **Relacja wideo** (`type: "story"` z polem `video`) — urywek (`typ: "urywek"`), bez opisu. Dodatkowa względem codziennej relacji graficznej z rytmu, godzina 12:45.
- **Rytm:** w czasie kampanii Google Ads T1 (16.10–05.11.2026) jedna relacja wideo co 2–3 dni robocze (rotacja urywków), potem co 2 tygodnie. Ten sam urywek nie częściej niż raz na 2 tygodnie.
- Format wpisu: jak niżej, z polami `video` (nazwa pliku), `poster` (miniatura do podglądu tygodnia), `slides: []`; reel ma `caption`, relacja — pusty.
- Publikator podaje Instagramowi wideo z jsDelivr przypiętego do commita (`video/mp4`); plik do 20 MB.

## Tryb 3 — LinkedIn: posty na dwa kolejne tygodnie (piątek, razem z trybem 2)

Jak w trybie 2: plan sięga dwa tygodnie naprzód (decyzja właściciela 28.10.2026), więc w piątek uzupełniasz brakujące posty LinkedIn w obu kolejnych tygodniach (do 4 postów: wtorek i czwartek każdego tygodnia). Jeśli w `linkedin/` jest już plik na dany dzień, nie tworzysz drugiego.

Decyzje właściciela: 06.10 i 10.10.2026 — agent marketingu prowadzi stronę firmową na LinkedIn; 20.10.2026 — „linkedin trzeba wreszcie zautomatyzować”, więcej i częściej płatnych dokumentów; 20.10.2026 po powtórce wezwania — „na linkedinie … głównie o takich dok. zarządowych, spółkowych” i bez powtórek. Zasady: `docs/BIZNESDOK_LINKEDIN_GUIDELINES.md` w repo biznes-dokumenty-pro (§3, §4, §6, §9, §10, §13) i „Zasady treści” niżej.

1. Dwa posty tygodniowo, godzina 09:00: **wtorek** — dokument spółki (zarząd, zgromadzenia wspólników, wspólnicy i udziały; sprawozdania w ich okresie), **czwartek** — na zmianę poradnik (najpierw spółkowy) i seria AI. Inne dokumenty na LinkedIn dopiero, gdy dokumenty spółki są wykorzystane. Tematy daje `node tools/propozycja.mjs` (miejsca „LinkedIn”). Na LinkedIn temat nie wraca przez 120 dni (pełne koło), a tematy powiązane nie wchodzą bliżej niż 28 dni od siebie: poradnik i dokumenty, do których prowadzi, oraz odcinek serii AI i jego dokument (`rozwiazanie`) albo poradnik (`zrodlo`). Ten sam temat może być na Instagramie i LinkedInie. Historia LinkedIna jest w `linkedin/` — także posty opublikowane ręcznie przed automatem.
2. Plik `linkedin/RRRR-MM-DD-<slug>.json` — format jak post w feedzie (`type: "feed"`, `slides` 1 slajd, `link`, `temat`), plus `caption` = treść posta LinkedIn: 500–1200 znaków, pierwsze zdanie mówi, co robi BiznesDOK (bez pytania), na końcu jeden link z `?utm_source=linkedin&utm_medium=social&utm_campaign=<slug>`, 3–5 hashtagów, w tym `#biznesdok`. `status`: `planned | vetoed | handed | published | error`.
3. Grafika: `node tools/render.mjs linkedin/<plik>.json media/linkedin` i obejrzyj PNG (Read). Commit + push razem z trybem 2.
4. Publikacja: **automatyczna** — tryb 1 (`run.mjs` → `tools/linkedin.mjs`) przekazuje post do Buffera rano w dniu publikacji z terminem 09:00 (status `handed`). Przy kolejnym przebiegu sprawdza w Bufferze wynik: post wyszedł → `published` z linkiem (`permalink`, widać w panelu), Buffer zgłosił błąd albo po dobie od terminu nadal nic → `error` z powodem — wtedy opisz to w pierwszym zdaniu podsumowania. Bez `BUFFER_API_KEY` post czeka (`planned`) — napisz to w podsumowaniu; właściciel nie publikuje ręcznie (decyzja 11.10.2026).
5. Katalog `linkedin/` jest poza `queue/` celowo: Instagram czyta tylko `queue/` — posty LinkedIn nie mogą trafić na Instagram.

## Rytm tygodnia

| Dzień | Feed Instagram (08:30) | Relacja (12:30) | LinkedIn (09:00) |
|---|---|---|---|
| pn | płatny dokument (najpierw priorytet A) | płatny dokument | — |
| wt | karuzela z poradnika w sezonie (prowadzi do płatnych dokumentów) | płatny dokument | dokument spółki |
| śr | płatny dokument | płatny dokument | — |
| czw | płatny dokument („…przygotujesz w BiznesDOK” i kiedy się przyda) | płatny dokument | poradnik spółkowy albo seria AI (na zmianę) |
| pt | tydzień parzysty: seria „AI zawiodło? Decyduje prawnik”; nieparzysty: Subskrypcja albo bezpłatne narzędzie/dokument w sezonie | bezpłatne narzędzie albo dokument w sezonie — jedyna bezpłatna relacja w tygodniu | — |

Wideo (12:45): rotacja zatwierdzonych urywków (sekcja „Wideo w trybie 2”). Proporcje pilnowane przez kontrolę: płatne dokumenty i Subskrypcja co najmniej 60% publikacji graficznych w tygodniu, bezpłatne najwyżej 2, seria AI co 2 tygodnie, Subskrypcja co najmniej raz na 2 tygodnie, karuzela z poradnika co tydzień (gdy jest poradnik w sezonie).

## Oferta i okresy przydatności (`data/oferta.json`)

Jedno źródło tematów: każdy dokument, narzędzie, poradnik i Subskrypcja z `temat`, `rodzaj`, `platny`, `priorytet` (A — najpierw: reklamy, ruch, wyższy koszyk; B — normalnie; C — rzadziej), `sezon` (okresy MM-DD, w których temat jest szczególnie przydatny; mogą przechodzić przez Nowy Rok), `tylko_w_sezonie` (poza okresem temat nie wychodzi), `wstrzymany` (powód — temat nie wychodzi), `wazne_do` (np. stawki na dany rok) i `fakty` — zdania spisane ze stron BiznesDOK, **jedyne fakty wolne do użycia w postach** (poza opublikowanymi poradnikami w karuzelach). Plik aktualizuje wykonawca prowadzący w dniu zmiany oferty (nowy dokument w sprzedaży, wycofanie, nowy poradnik, zmiana kampanii) — automat go nie zmienia, tylko zgłasza braki w podsumowaniu.

## Seria „AI zawiodło? Decyduje prawnik” (`data/seria-ai.json`)

Decyzja właściciela 29.09.2026 (LINKEDIN_GUIDELINES §9), wykonanie od 20.10.2026: Instagram — piątkowy post w tygodnie parzyste, LinkedIn — czwartek w tygodnie parzyste. Post ma pola `"seria": "ai-zawiodlo"` i `"temat_serii": "<id>"`. Wprost nazywamy typowy kłopot (`blad`) — bez wyśmiewania, bez nazw konkretnych narzędzi AI, bez straszenia i obietnic wyniku; poprawna informacja wyłącznie z `fakt` (źródło: `zrodlo`); na końcu jedno rozwiązanie w BiznesDOK (`rozwiazanie`) i puenta: technologia ułatwia, decyduje prawnik. Każdy temat raz na kanał (data w `instagram` / `linkedin`). Tylko w tej serii wolno pisać o AI.

## Kontrola i pilnowanie (`tools/kontrola.mjs`)

**Twarde uwagi — post nie wyjdzie** (publikator go zatrzyma, CI pokaże błąd, panel KMZ pokazuje „BLOKUJE”):
- ten sam temat w tym samym kanale w ciągu 21 dni na Instagramie i 120 dni na LinkedIn (dokument, narzędzie, poradnik; także relacja tego samego dnia co post w feedzie), na LinkedIn także tematy powiązane bliżej niż 28 dni (poradnik i jego dokumenty, odcinek serii AI i jego dokument albo poradnik), i to samo hasło na grafice co wcześniej;
- temat spoza `data/oferta.json`, wstrzymany, nieaktualny albo poza okresem (`tylko_w_sezonie`);
- pierwsze zdanie grafiki albo opisu jest pytaniem (poza serią AI) — zaczynamy od tego, co robi BiznesDOK;
- AI poza serią „AI zawiodło?” i nazwy konkretnych narzędzi AI (zawsze);
- zakazane zwroty („Masz problem?”, „Mamy rozwiązanie”, „Czy wiesz, że…?”, „startujemy”, „rewolucjonizujemy”, obietnica gwarancji), obietnica czasu („w minutę”, „oszczędzasz…”);
- „każdy dokument” (poza Subskrypcją) — nie wszystkie dokumenty mają te same funkcje; identyfikator i weryfikacja przy bezpłatnym dokumencie (bezpłatne nie mają ID); „…trzymasz” albo „na swoim koncie” przy bezpłatnym.

**Miękkie uwagi** (do poprawy w trybie 2): skrót bez rozwinięcia (NZW, ZZW, KRS, MSiG, RDF, ZUS RIA), stary wzór „przygotowujesz i trzymasz”, kwoty w złotych, hasztagi, „Link w bio → …”, brak adresu na relacji, długość i link z UTM na LinkedIn, minięty termin.

**Stan na bieżąco:** `node tools/zgodnosc.mjs` (raport do `RAPORTY.md` w trybie 2; `--krotko` — jedno zdanie, wypisuje je też `run.mjs`). `node tools/check.mjs` (CI przy każdym pushu) odrzuca zaplanowane posty z twardą uwagą i błędy w `data/oferta.json` i `data/seria-ai.json`.

## Plan w panelu KMZ (zakładka BiznesDOK)

Od 16.10.2026 plan publikacji (Instagram i LinkedIn) widać w panelu KMZ właściciela. `plan.json` i miniatury w `media/plan/` tworzy automat GitHub (`.github/workflows/plan.yml` → `tools/plan.mjs`) po każdym pushu zmieniającym `queue/`, `linkedin/` albo `data/` i raz dziennie. **Nie edytuj ich ręcznie i nie uruchamiaj `tools/plan.mjs` w trybach 1–3.** Automat dopisuje commity do `main` — przed każdym `git push` zrób `git pull --rebase origin main` (`run.mjs` robi to sam). Panel pokazuje przy postach uwagi z `tools/kontrola.mjs` (najpierw „BLOKUJE: …”) i czy strona z linku istnieje. Od 19.10.2026 przy postach są przyciski „Wstrzymaj”, „Wznów” i „Zmień…” (właściciel: „ma działać tak jak w Warszawie”); automat stosuje je przez `tools/reakcje.mjs` (sekcja „Reakcje z panelu KMZ”).

## Weto właściciela

Właściciel wetuje w panelu KMZ: „Wstrzymaj”, „Wznów”, „Zmień…” z uwagą przy poście z planu (`tools/reakcje.mjs`); może też napisać w sesji „wstrzymaj <post>” / „zmień …”. Wstrzymany post: `status: "vetoed"` (automat go pomija). Wznowiony: z powrotem `planned`. Zmieniony post: popraw JSON, usuń stare PNG tego id z `media/` (LinkedIn: `media/linkedin/`), wyrenderuj od nowa i obejrzyj (Read), zostaw `planned`; commit, `git pull --rebase origin main`, push. Post usunięty z planu: `status: "vetoed"` i pole `usunieto` z datą i powodem (znika z panelu).

## Zasady biura KMZ

W sprawach współpracy z biurem obowiązuje księga KMZ. Zasady biura, które dotyczą tego automatu, są wpisane tu wprost (automat w chmurze nie widzi folderu KMZ); zasady produktu i treści zostają w tym repo i w `biznes-dokumenty-pro`.

- **Nie piszesz sam do właściciela.** Żadnych własnych wiadomości (Telegram, mail, powiadomienia). Wynik sesji — co opublikowano, wstrzymano, zmieniono, błędy, pusta kolejka, zdanie kontroli treści — jest w podsumowaniu sesji, które biuro zbiera do panelu KMZ.
- **Weto jest w panelu** (sekcja „Weto właściciela”): brak reakcji = publikacja; gdy panel nie odpowiada, posty idą według planu.
- **Pomysły.** Odłożone prace BiznesDOK (nowy format, temat „na kiedyś”) są w tabeli LATER w ROADMAP repo `biznes-dokumenty-pro`, nie w plikach tego repo; opisz taki pomysł jednym zdaniem w podsumowaniu sesji. Do bazy biura KMZ (strona Pomysły) trafia tylko pomysł właściciela spoza BiznesDOK, np. nowy biznes.

## Zasady treści (obowiązkowe — publikacja jest automatyczna)

1. **Główna obietnica (zablokowana):** „Dokumenty przygotowane przez prawników. Dopasowane technologią.” Wspierająca: „Ty podajesz dane. BiznesDOK przygotowuje resztę.” Profil ma pokazywać przede wszystkim dokumenty przygotowane przez prawnika, które sprzedajemy — bezpłatne narzędzia są dodatkiem, nie główną treścią.
2. **Tylko to, co LIVE i w ofercie:** tematy wyłącznie z `data/oferta.json` (bez `wstrzymany`, w sezonie, gdy `tylko_w_sezonie`). Zapowiedzi nie reklamujemy.
3. **Fakty wyłącznie z pola `fakty` w ofercie** (spisane ze stron BiznesDOK) i z opublikowanych poradników (karuzele). Nie formułuj nowych tez prawnych, terminów, kwot ani funkcji. Nie uogólniaj funkcji na wszystkie dokumenty („każdy dokument…”).
4. **Bez cen, kodów rabatowych i niezweryfikowanych liczb/czasów** („w minutę”, „oszczędzasz godzinę”).
5. **Ton:** konkretny, profesjonalny, prosty, pewny siebie bez zadęcia. **Pierwsze zdanie mówi, co robi BiznesDOK** — bez pytania na start (wyjątek: seria AI). Product-first: znane zadanie → prostszy sposób z BiznesDOK → praca zdjęta z klienta → treść od prawników → CTA. Zakazane: „Masz problem?”, „Mamy rozwiązanie”, „Czy wiesz, że…?”, „startujemy”, „rewolucjonizujemy”, tłumaczenie oczywistego celu dokumentu, obietnice wyniku prawnego, sugerowanie indywidualnej porady prawnej.
6. **AI nie jest autorem dokumentów** — nie piszemy o AI poza serią „AI zawiodło? Decyduje prawnik”. Treść przygotowują prawnicy (Katarzyna Zawadzka Legal Consulting), technologia uzupełnia dane.
7. **Bez powtórek:** ten sam temat nie wraca na Instagramie przez 21 dni, a na LinkedIn przez 120 dni; to samo hasło na grafice — nigdy. Każdy temat ma swój okres przydatności (`sezon`) — w sezonie ma pierwszeństwo.
8. **Serie stałe:** płatny dokument — „[Dokument] przygotujesz w BiznesDOK.” i w podtytule, kiedy się przyda, albo konkretna korzyść; gdy jest miejsce: „Po zakupie dokument zostaje na Twoim koncie.” Bezpłatny — „[Dokument] przygotujesz w BiznesDOK — bezpłatnie, bez konta.” (nigdy „na swoim koncie” przy bezpłatnym). Wzoru „przygotowujesz i trzymasz” już nie używamy (audyt zrozumiałości, przyjęty przez właściciela 26.10.2026: „trzymasz” jest niejasne, a powtarzany wzór zlewa posty).
9. **Grafiki tylko z `tools/render.mjs`** (brandbook: paper, Instrument Serif, clause highlight `[[...]]`, lockup BD prawy dół). Bez zdjęć, stocków, ikon, grafik AI, nowych kolorów i sloganów.
10. **Opis:** wnosi coś nowego względem grafiki, kończy się jednym CTA („Link w bio → Narzędzia / Poradniki / Dokumenty”) i 5–8 hashtagami, w tym `#biznesdok`.
11. **Zrozumiałość dla laika** (audyt zrozumiałości, przyjęty przez właściciela 26.10.2026). Piszemy dla przedsiębiorcy, który nie zna prawa pracy ani spółek:
    - termin fachowy w tytule, a w pierwszym zdaniu jego rozwinięcie po „czyli” albo myślniku, najlepiej jako „co się zmienia dla mnie” (np. „Wypowiedzenie zmieniające, czyli pismo, w którym proponujesz pracownikowi nowe warunki pracy lub płacy”);
    - skrót rozwijamy przy pierwszym użyciu w poście: nadzwyczajne zgromadzenie wspólników (NZW), Krajowy Rejestr Sądowy (KRS), Monitor Sądowy i Gospodarczy (MSiG), Repozytorium Dokumentów Finansowych (RDF), raport informacyjny ZUS RIA; na relacji, gdzie miejsca brak, lepiej pełna nazwa bez skrótu;
    - każdy post mówi, kiedy się przyda („Gdy pracownik zgadza się na…”, „Gdy wspólnicy odwołują…”), a nie tylko, co to za dokument; termin podaje, od czego się liczy („15 dni od zatwierdzenia”), a urząd albo rejestr nazywa wprost;
    - rozwinięcie i „kiedy się przyda” bierzemy wyłącznie z faktów oferty i opublikowanych poradników (punkt 3) — nie dopisujemy własnych definicji prawnych; gdy w faktach brak prostego wyjaśnienia, zostaw sam termin z kontekstem z faktów i zgłoś brak w podsumowaniu.

## Format posta (queue/*.json)

```json
{
  "id": "2026-10-26-umowa-o-wspolpracy-biznesowej",
  "date": "2026-10-26", "time": "08:30",
  "type": "feed | carousel | story | reel",
  "status": "planned | vetoed | published | skipped | error",
  "pillar": "płatny dokument",
  "temat": "umowa-o-wspolpracy-biznesowej",
  "link": "https://biznesdok.pl/...",
  "slides": [{ "layout": "headline | list", "eyebrow": "...", "text": "... [[wyróżnienie]]", "sub": "...", "note": "...", "size": 96, "items": [["tytuł", "opis"]] }],
  "caption": "..."
}
```

`id` = nazwa pliku bez `.json`. `temat` = `temat` z `data/oferta.json` (gdy brak — liczy się ścieżka linku). Seria AI: `"seria": "ai-zawiodlo"`, `"temat_serii": "<id z data/seria-ai.json>"`, `link` do rozwiązania. Relacje: `caption` pusty, adres w `note`. Wideo: dodatkowo `"video": "<plik>.mp4"`, `"poster": "<plik>.jpg"` (oba z `data/wideo.json`), `"slides": []`; reel opcjonalnie `"thumbOffsetMs"` (klatka okładki).
