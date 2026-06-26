# 🌳 Opole — mapa analityczna: zielona przestrzeń i dobrostan

Interaktywna mapa pod **Strategię Młodzieżową Miasta Opola — Obszar 7** (zielona przestrzeń miejska i dobrostan). Przygotowana na spotkanie zespołu **1 lipca 2026** (MBP, ul. Minorytów 4).

Pokazuje, **gdzie w Opolu jest zieleń i infrastruktura, a gdzie są braki**, na realnych, publicznych i weryfikowalnych danych — żeby dyskusja opierała się na faktach, a nie na tezach.

> 🌍 **Wersja publiczna (GitHub Pages):** _link pojawi się tu po publikacji._ Aplikacja jest w 100% statyczna (HTML+JS+GeoJSON), więc działa za darmo na GitHub Pages.

## Jak edytować i opublikować zmiany

Repo jest tak proste, jak to możliwe — czysty front-end + dane jako pliki:
- **Treści/teksty/opisy** → edytuj `index.html` i `app.js` (opisy wskaźników są w obiekcie `METRIC_DESC`, pojęcia w `CONCEPTS`, źródła w `SOURCES_FULL`).
- **Dane** → pliki w `dane/*.geojson` i `dane/*.json`. Aby je odświeżyć, uruchom skrypty Pythona (patrz „Pliki i pipeline").
- **Publikacja** → po `git push` na gałąź `main` GitHub Pages **automatycznie** zaktualizuje stronę (zwykle w 1–2 min).

```bash
# typowy cykl edycji:
git add -A && git commit -m "opis zmiany" && git push
```

## Jak uruchomić

```bash
cd mapa-zielona-opole
python3 -m http.server 8765
# otwórz http://127.0.0.1:8765/index.html
```
Aplikacja działa lokalnie (Leaflet wgrany w `vendor/`); internet potrzebny tylko do podkładów mapowych (w tym satelitarnego).

## Co pokazuje mapa

| Zakładka | Zawartość |
|---|---|
| 🗺 **Mapa** | Warstwy (zieleń, drzewa, transport, usługi) + choropleta dzielnic z **suwakiem czasu 2017→2030** i projekcją trendu |
| 📈 **Demografia** | Zmiana ludności i struktury wieku 2017–2026, projekcja do 2030, wykres miasto vs. dzielnica |
| 🌳 **Zieleń** | Bilans zieleni, m²/mieszkańca, dostępność 300/500 m, ranking dzielnic |
| 🚶 **15-min** | Czy w 15 min pieszo jest: szkoła, sklep, przystanek, zieleń, sport, zdrowie; średnie odległości |
| 📡 **Satelita** | **Drugi, niezależny zbiór zieleni** z satelity (ESA WorldCover 10 m) + porównanie „ile zieleni gubi OSM" + nakładka na mapę |
| 💰 **Ekonomia** | Ceny mieszkań (zł/m², +73% w 5 lat), wynagrodzenia, firmy wg wielkości, wskaźnik dostępności mieszkaniowej — GUS BDL |
| 🧭 **Analizy** | **Dystans po realnej sieci** (1,43× dłuższy niż prosta), izochrony 5/10/15 min, **indeks deprywacji** per dzielnica, priorytet równości, **optymalne lokalizacje** nowych żłobków/parków (max-coverage), flagi pewności danych |
| ✅ **Weryfikacja** | **Walidacja zieleni z 3 niezależnych źródeł** (OSM vs satelita vs Plan Ogólny UM): czy strefy zieleni są faktycznie zielone (56%), ile realnej zieleni jest poza planem/niechronione (50%). Honest błędy każdego źródła |

**Większy zoom + ground-truth:** oficjalne **ortofotomapy miejskie** (UM Opole 2019, Sentinel-2 2024) jako podkład do zoomu 21 i wizualnej weryfikacji. **Karta dzielnicy (PDF):** klik dzielnicy → pełny raport do druku/zapisu. **Tryb prezentacji:** 23 kroki w 8 sekcjach, dane na żywo, sterowanie klawiaturą, auto-play.
| ❓ **Metoda** | Jak czytać mapę, jak liczymy odległości, **tryb demonstracji** (klik → bufory 300/500 m + linie do najbliższej zieleni/usług) |
| 📋 **Źródła** | Rejestr źródeł z datami + uczciwa lista luk w danych |

**Interaktywność:** każdy obiekt (klik) pokazuje *co to jest, typ jednostki, adres, kontakt, rejestry (RSPO/REGON) i źródło* (z linkiem do OSM). Szkoły są **klasyfikowane i kolorowane wg typu** (podstawowa/liceum/technikum/uczelnia/przedszkole/artystyczna/językowa). Onboarding przy starcie. Podkłady: jasny/ciemny/OSM/**satelita Esri**/**Sentinel-2 cloudless**.

**Grafika i przejrzystość:** pływająca **legenda aktywnych warstw** na mapie · **symbol (kolor+kształt) przy każdej warstwie** w panelu · **suwaki przezroczystości** (choropleta + warstwy + satelita + podkłady) · **wartości wskaźnika na dzielnicach** (przełącznik) · **podpowiedzi po najechaniu** na punkty + podświetlanie · opis ℹ️ każdego wskaźnika. **Podkłady:** jasny/ciemny/Voyager/OSM/Esri ulice/topo/etykiety/satelita Esri/Sentinel-2/ortofoto UM **oraz „Bez podkładu" (ciemny/jasny)** — dane bez tła. **Sterowanie mapą:** pełny ekran, reset widoku, ukryj panel. Zakładki **💡 Wnioski** i **📖 Objaśnienia**.

**Wizualizacje strategiczne:**
- ⭐ **Indeks zieleni i dobrostanu** (0–100) per dzielnica — złożenie zieleni satelitarnej, zieleni/os i drzew.
- 🎯 **Mapa bivariate „młodzież × deficyt zieleni"** — ciemny róg = priorytet inwestycji (dużo młodych, mało zieleni).
- 🚶 **Izochrony interaktywne dla CAŁEGO miasta** — w zakładce Metoda włącz „Izochrona z punktu" i kliknij gdziekolwiek: graf sieci pieszej (100,5 tys. węzłów) ładuje się w przeglądarce i liczy Dijkstrą zasięg 5/10/15 min pieszo z dowolnego punktu (z szacunkiem ha). Idealne do oceny propozycji lokalizacji (np. nowego parku/żłobka).
- ▶ **Tryb prezentacji** — 7 kroków-wniosków prowadzących przez mapę pod spotkanie.
- Etykiety dzielnic, podświetlanie po najechaniu, suwak przezroczystości nakładki satelitarnej, tryb demonstracji odległości.

## Najważniejsze ustalenia (do dyskusji)

- **Zieleń:** ~3 370 ha terenów zielonych; **74 m² zieleni urządzonej / mieszkańca** (znacznie powyżej cytowanego minimum 9 m²). 
- **Dostępność (w granicach miasta):** **98,6% terenów mieszkaniowych ma zieleń w zasięgu 300 m**, 99,9% w 500 m — w samym Opolu zieleń jest niemal wszędzie w zasięgu. Realne luki to nie *coverage* zieleni, lecz **jakość zieleni, ochrona planistyczna i dostęp do usług** (żłobki ~23 min pieszo!). *Uwaga: analizy siatkowe są przycięte do granicy administracyjnej miasta — tereny sąsiednich gmin pominięte.*
- **Drzewa:** 4 895 drzew w OSM (dane niedoszacowane — patrz luki). Skrajne różnice między dzielnicami: gęsto zabudowane śródmieście (dz. IV) ma **1,1 drzewa/1000 mieszk.**, podczas gdy dzielnice peryferyjne — kilkadziesiąt.
- **Demografia:** ludność Opola spada (**126 231 → 116 628 zameldowanych, −7,6%** w 10 lat), miasto się starzeje (śr. wiek **43,1 → 46,0 lat**). Dzielnica XIII rośnie (+30% ludności, +72% młodzieży) — rozwojowa; rdzeń (III, VIII, X) się wyludnia i starzeje.
- **Stan techniczny obiektów:** **brak w danych otwartych** — to luka, którą strategia może zaadresować (rejestr stanu przestrzeni dla młodych).

## Pliki i pipeline

```
pobierz_dane.py     → dane/*.geojson  (OSM: granica, zieleń, drzewa, mieszkania, szkoły, woda)
pobierz_dane2/3.py  → dane/*.geojson  (OSM: transport, usługi, firmy, zdrowie, kultura)
pobierz_dane4.py    → dane/*.geojson  (OSM: ścieżki rowerowe, chodniki, cmentarze, działki ogr., komfort)
pobierz_dane5.py    → dane/*.geojson  (OSM: służby, przemysł, energetyka, maszty, siłownie, atrakcje, wały)
satelita.py         → dane/worldcover_*.{png,tif,json}  (ESA WorldCover 10 m — DRUGI zbiór zieleni)
ekonomia.py         → dane/ekonomia.json  (GUS BDL: ceny mieszkań, płace, firmy wg wielkości)
edukacja.py         → dane/{zlobki,przedszkola,szkoly_podstawowe/srednie/wyzsze}.geojson + dostepnosc_edukacja.json
pobierz_siec.py     → dane/siec_piesza.geojson  (sieć dróg/chodników OSM pod routing)
router.py           → moduł: graf pieszy + Dijkstra (100,5 tys. węzłów)
analiza_siec.py     → dane/dostepnosc_siec.{json,geojson}, izochrony.geojson  (dystans SIECIOWY, izochrony)
analiza_strategia.py→ dane/strategia_analiza.json, lokalizacje_{zlobki,parki}.geojson  (deprywacja, max-coverage)
weryfikacja.py      → dane/weryfikacja_zielen.json, strefy_zieleni_plan.geojson  (walidacja 3 źródeł zieleni)
pobierz_bts.py      → dane/bts_nadajniki.geojson  (136 stacji BTS z SI2PEM, wszyscy operatorzy)
analiza_zasieg.py   → dane/podsumowanie_zasieg.json, zasieg_biale_plamy.geojson  (białe plamy zasięgu)
demografia.py       → dane/demografia.json        (seria 2017–2026 + projekcja 2030)
analizuj.py         → dane/dzielnice_wskazniki.geojson, puste_plamy.geojson, podsumowanie_analiza.json
analizuj15.py       → dane/dostepnosc15.geojson, szkoly_wskazniki.geojson, podsumowanie15.json
index.html + app.js → interaktywna mapa
```
> `satelita.py` wymaga `pip install rasterio pillow numpy` (czyta wycinek Opola z chmurowego COG na AWS S3).
Pełne odtworzenie: `python3 pobierz_dane.py && python3 pobierz_dane2.py && python3 pobierz_dane3.py && python3 demografia.py && python3 analizuj.py && python3 analizuj15.py`

## Warstwy urzędowe „na żywo" (bez pobierania — WMS/ArcGIS)

W zakładce Mapa → „Warstwy urzędowe": pobierane bezpośrednio z serwerów publicznych:
- 🌊 **Strefy powodziowe**, 📐 **Plan miasta / MPZP**, 🏞 **Strefy uchwały krajobrazowej** — ArcGIS UM Opole (reprojekcja z EPSG:2177 do mapy w locie).
- 📦 **Działki** i 🏠 **budynki ewidencyjne** — GUGiK / Krajowa Integracja Ewidencji Gruntów (widoczne po przybliżeniu).
- 🛡 **Ochrona przyrody** (parki narodowe/krajobrazowe, Natura 2000, pomniki) — GDOŚ Geoserwis.

## Źródła danych

- **OpenStreetMap** (© kontrybutorzy OSM, licencja ODbL) — przez Overpass API. Stan: 25.06.2026.
- **ESA WorldCover 10 m** (Sentinel-1/2, 2021) — drugi, niezależny zbiór zieleni z satelity.
- **ArcGIS UM Opole** — dzielnice + demografia 2017–2026; powódź, MPZP, krajobraz (na żywo).
- **GUGiK KIEG** — działki i budynki ewidencyjne (WMS). **GDOŚ** — ochrona przyrody (WMS).
- **GUS** — kontrolna liczba ludności miasta (128 140 os., 01.06.2026).

Dalsze pomysły na dane i wizualizacje strategiczne: **[POMYSLY-DANE-I-WIZUALIZACJE.md](POMYSLY-DANE-I-WIZUALIZACJE.md)**.

## Kontrola jakości — audyt metodologii

Cała metodyka analiz przeszła **wieloagentowy, adwersaryjny audyt** (23 agentów: 5 niezależnych audytorów modułów + weryfikacja każdego znaleziska). Wykryto i **naprawiono 13 realnych błędów** (5 zgłoszeń odrzucono jako fałszywe alarmy), m.in.:
- dystans liczony w linii prostej zaniżał o ~43% → wprowadzono **dystans po realnej sieci pieszej** (router OSM);
- statystyki satelitarne liczone po prostokącie bbox (z polami poza miastem) → **maska administracyjna miasta** (zabudowa skorygowana 10,5% → 19,3%);
- powierzchnia zieleni liczona po centroidzie → **przycięcie geometryczne do granic** (shapely);
- brak placówki (nieosiągalna) liczony jako „dostęp 0 m" → **kara = najgorszy dostęp** w indeksie deprywacji;
- popyt w optymalizacji lokalizacji **ważony udziałem młodzieży**; walidacja spójności danych demograficznych 2026; dokumentacja jednostek GUS.

To realizuje wymóg „wnioski bez błędów" — metodyka jest jawna i zwalidowana.

## Metodyka (skrót)

- Rzut równopostaciowy wokół środka Opola → metry; pole pow. wzorem Gaussa; przynależność punktu do wieloboku (ray casting).
- Dostępność: granice zieleni próbkowane co 25 m + hash przestrzenny; siatka terenów mieszkaniowych co 120 m → dystans do najbliższej zieleni/usługi.
- Zieleń przycięta do granic miasta (maska = suma 13 dzielnic), rozdzielona na: parki, zieleń urządzoną, lasy, zieleń naturalną.
- **Redukcja błędu/tezy:** dłuższy horyzont (10 lat); rok 2024 (struktura wieku) odrzucony jako niespójny (walidacja sumy grup ≈100%); rozróżnienie danych pewnych od niedoszacowanych; jawny rejestr luk.

## Standardy odniesienia

- **WHO Europe / EEA** — teren zielony w zasięgu ~300 m (≈5 min pieszo) od domu.
- **ANGSt (Natural England)** — min. 2 ha dostępnej zieleni w promieniu 300 m.
- **Miasto 15-minutowe** (C. Moreno) — codzienne potrzeby w 15 min pieszo/rowerem.

## Luki danych (uczciwie) i jak je domknąć

- **Natężenie ruchu / „popular times" (Google, Apple)** — zastrzeżone, brak otwartego API. Zamiast tego: **mapy hałasu UM Opole 2022** (pochodne ruchu, dostępne w ArcGIS miasta), liczniki MZD, GDDKiA.
- **Trasy aktywności (Strava/Endomondo)** — w mapie dodano *publiczny podgląd* heatmapy Strava; surowe, anonimowe trasy to **Strava Metro** (bezpłatne dla samorządów na wniosek). Endomondo zamknięte (2021).
- **Rejony szkół podstawowych** — uchwała Rady Miasta; do pozyskania z UM jako warstwa GIS.
- **Pełny rejestr firm** — GUS REGON/BIR (API) + CEIDG; w mapie pokazano podzbiór z OSM.
- **Stan techniczny obiektów** — rejestry MZD (zieleń/drogi) i MOSiR (sport) + audyt terenowy.

## Tryb „live" / optymalizacja (następny krok)

Obecny pipeline jest wolny przez **limity publicznego Overpass API**. Aby liczyć w sekundach, nie godzinach:
1. **Lokalny ekstrakt OSM** — pobrać `opolskie.osm.pbf` z Geofabrik i odpytywać lokalnie (osmium/ogr2ogr/DuckDB-spatial) — bez limitów, sekundy.
2. **Bezpośrednie warstwy ArcGIS UM Opole** (FeatureServer) — oficjalne dane na żywo, bez pośrednika.
3. **Pre-generowane PMTiles / wektorowe kafle** — statyczny hosting, błyskawiczny render dużych warstw.
4. **Analizy po stronie przeglądarki** (Turf.js) lub w DuckDB-spatial — przeliczanie buforów/dostępności na żądanie.
5. **Cache + odświeżanie przyrostowe** zamiast pełnego pobierania za każdym razem.
