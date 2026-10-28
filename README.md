# biznesdok-social

Automat profilu Instagram **@biznesdok.pl** i strony firmowej LinkedIn BiznesDOK: kolejka postów (`queue/`, `linkedin/`), grafiki w stylu brandbooka (`media/`, `preview/`), dziennik publikacji (`DZIENNIK.md`).

Publikacja: Instagram przez oficjalne Instagram Graph API, LinkedIn przez Buffer (oficjalny partner LinkedIn; klucz w zmiennej `BUFFER_API_KEY` środowiska automatu). Zasady treści i tryby pracy: [CLAUDE.md](CLAUDE.md). Decyzje właściciela i konfiguracja Meta: repo `biznes-dokumenty-pro`, `docs/social/instagram/README.md`.

Tematy i fakty do postów: `data/oferta.json` (cała oferta z priorytetami i okresami przydatności), seria „AI zawiodło? Decyduje prawnik”: `data/seria-ai.json`, zatwierdzone filmy: `data/wideo.json`. Propozycja tematów na dwa kolejne tygodnie (plan sięga 7–14 dni naprzód, decyzja właściciela 28.10.2026): `tools/propozycja.mjs`; kontrola treści (post z twardą uwagą nie wyjdzie): `tools/kontrola.mjs`; stan zgodności: `tools/zgodnosc.mjs` (decyzja właściciela 20.10.2026).

Plan publikacji dla panelu KMZ (`plan.json`, miniatury w `media/plan/`) tworzy automat GitHub `.github/workflows/plan.yml` (`tools/plan.mjs`, uwagi z `tools/kontrola.mjs`).

Reakcje właściciela z panelu KMZ przy planie („Wstrzymaj”, „Wznów”, „Zmień…”) odbiera i potwierdza `tools/reakcje.mjs` (wywołuje go też `tools/run.mjs` przed publikacją); klucz w zmiennej `KMZ_BIZNESDOK_SEKRET` środowiska automatu, nigdy w repo.

Repo jest publiczne, bo Instagram i Buffer pobierają grafiki z publicznego adresu. Nie zawiera tokenów, kluczy ani danych osobowych.

Fonty Instrument Sans i Instrument Serif: SIL Open Font License (`tools/fonts/`).
