# Pomysły: dane i wizualizacje strategiczne (Opole, Obszar 7)

Katalog dziedzin danych przydatnych dla strategii młodzieżowej — co już mamy, co da się dodać i jak to pokazać. Podzielone na: ✅ wdrożone · 🟡 dostępne, do dodania · 🔴 zastrzeżone / wymaga wniosku.

## A. Zieleń i środowisko
- ✅ Zieleń OSM (parki, lasy, skwery, drzewa, place zabaw) + **drugi zbiór z satelity (ESA WorldCover)** i porównanie „ile OSM gubi".
- ✅ Dostępność zieleni 300/500 m, puste plamy, m²/mieszkańca.
- ✅ Ochrona przyrody (GDOŚ): parki narodowe/krajobrazowe, Natura 2000, pomniki przyrody.
- 🟡 **NDVI / kondycja roślinności** z Sentinel-2 (zmiana w czasie, susza miejska) — wymaga przetwarzania rastrów (mamy już rasterio).
- 🟡 **Wyspa ciepła** (LST z Landsat/Sentinel-3) — gdzie najgoręcej latem → priorytet zacienienia.
- 🟡 **Korony drzew z LiDAR** (chmura punktów jest w ArcGIS Opola — „Chmura_punktów_z_2024") → realne zadrzewienie zamiast punktów OSM.

## B. Demografia i dobrostan
- ✅ Ludność/gęstość/wiek per dzielnica 2017–2026 + projekcja 2030.
- 🟡 **Mapa zameldowań w siatce** (jeśli UM udostępni adresowo) → realne „obszary o największym zaludnieniu".
- 🟡 Dane o zdrowiu psychicznym/aktywności z poprzednich spotkań strategii (powiązać warstwowo).

## C. Mobilność i 15-minutowe miasto
- ✅ Przystanki, kolej, taxi, rowery, parkingi, ścieżki rowerowe, chodniki; analiza 15-min.
- ✅ **Dostępność wg poziomu edukacji** (osobno: żłobki, przedszkola, podstawowe, średnie, wyższe) + sklepy pierwszej potrzeby — mediana/średnia/% w 800 m + per dzielnica. Wniosek: żłobki = największa luka (mediana ~3 km).
- ✅ Lądowiska/lotnisko.
- ✅ **Izochrony** (5/10/15 min pieszo) — własny router na grafie OSM (Dijkstra, 100,5 tys. węzłów); dystans sieciowy zamiast liniowego (realna droga 1,43× dłuższa). Dla MZK/rowerem — do rozszerzenia.
- ✅ **Indeks deprywacji** wielodomenowy + **optymalne lokalizacje** nowych żłobków/parków (max-coverage) + flagi pewności danych.
- 🟡 **GTFS rozkład jazdy MZK Opole** → częstotliwość kursów = jakość transportu, nie tylko obecność przystanku.
- 🔴 Natężenie ruchu Google/Apple → zamiennik: mapy hałasu UM Opole 2022 (są w ArcGIS), liczniki MZD.
- 🔴 Trasy Strava/aktywność → publiczny podgląd heatmapy (już w mapie); surowe trasy = Strava Metro (wniosek samorządu).

## D. Planowanie i ryzyka
- ✅ **Strefy powodziowe** (UM Opole), **wały** (OSM).
- ✅ **Plan miasta / MPZP** i **strefy uchwały krajobrazowej** (UM Opole, na żywo).
- ✅ **Działki i budynki ewidencyjne** (GUGiK KIEG).
- 🟡 **Tereny inwestycyjne / rewitalizacja** (ArcGIS Opole ma „mesh dla obszaru rewitalizacji").
- 🟡 **Susze** — IMGW Stop Suszy (regionalnie).

## E. Infrastruktura i bezpieczeństwo
- ✅ Służby (straż/policja/szpitale), przemysł/hale, energetyka (linie/stacje), maszty telekom.
- ✅ Siłownie plenerowe i w budynkach, obiekty sportowe z rodzajem sportu.
- ✅ Komfort: ławki, woda pitna, wiaty, fontanny.
- 🟡 **Czas dojazdu służb** (izochrony OSRM) — krytyczne dla bezpieczeństwa.
- ✅ **Stacje BTS wszystkich operatorów** (SI2PEM, 136 stacji) + **białe plamy zasięgu** (proxy: odległość do najbliższego nadajnika). Realny zasięg (moc/anteny) — dane operatorów/UKE.
- 🔴 Prędkości łączy / pokrycie per operator — UKE internet.gov.pl (na wniosek/ograniczone).

## F. Kultura, sport, rozrywka, młodzież
- ✅ Kultura/rekreacja, atrakcje/sztuka, centra handlowe, gastronomia.
- 🟡 **Wydarzenia/aktywności dla młodzieży** (kalendarze MDK, klubów) — warstwa czasowa.
- 🟡 Mała architektura: artwork, fontanny, miejsca spotkań (OSM tourism=artwork — częściowo).

## G. Ekonomia i dostępność mieszkaniowa (zakładka 💰)
- ✅ **Ceny mieszkań** (mediana zł/m², wolny rynek + wg liczby izb) 2019–2024 — GUS BDL API.
- ✅ **Wynagrodzenia** brutto + relacja do średniej krajowej; **firmy wg klas wielkości** (mikro/małe/średnie/duże).
- ✅ **Wskaźnik dostępności**: ile m² za miesięczną pensję, lata pracy na 50 m².
- 🟡 **Ceny gruntów per działka** — RCiWN / dane.gov.pl (na wniosek; brak czystego API).
- 🟡 Bezrobocie rejestrowane, struktura PKD firm — GUS BDL (do dołożenia).

## Opcje wizualizacji (pod decyzje strategiczne)
1. **Choropleta + suwak czasu** (jest) — zmiana wskaźnika 2017→2030 per dzielnica.
2. **Heatmapa deficytu** — siatka kolorowana „ilu usług brakuje w 15 min" (jest: wynik 15-min).
3. **Izochrony** — wielokąty zasięgu czasowego od szkół/służb (do dodania, OSRM).
4. **Mapa bivariate** — np. „gęstość młodzieży × deficyt zieleni" = gdzie inwestować najpierw.
5. **Slider porównawczy (swipe)** — OSM vs satelita, albo 2017 vs 2026 obok siebie.
6. **Wskaźnik syntetyczny dobrostanu** — złożenie zieleni + dostępności + bezpieczeństwa w jeden ranking dzielnic.
7. **Tryb prezentacji** — sekwencja „historii" (storymap) prowadząca przez wnioski na spotkaniu.
8. **Eksport raportu PDF per dzielnica** — karta z kluczowymi liczbami dla każdej dzielnicy.

## Status wdrożenia (uczciwie)
**Wdrożone ✅:** choropleta + suwak czasu · heatmapa deficytu (15-min) · mapa bivariate · indeks dobrostanu · tryb prezentacji · suwak przezroczystości satelity (zamiast pełnego swipe) · zakładka Ekonomia · bogate popupy z klasyfikacją typów szkół/jednostek · etykiety dzielnic, hover, demonstracja odległości.

**Zostaje (🟡 roadmap):** izochrony OSRM (realne 15-min/dojazd służb) · pełny swipe OSM↔satelita obok siebie · eksport PDF per dzielnica · NDVI/wyspa ciepła z Sentinela · korony drzew z LiDAR · GTFS MZK · warstwa rewitalizacji · ceny gruntów per działka (RCiWN).

## Priorytety (rekomendacja)
Największa wartość dla strategii przy najmniejszym koszcie:
1. **Izochrony pieszo/rowerem** (realne 15-min miasto) — OSRM lokalnie.
2. **Wskaźnik syntetyczny dobrostanu** per dzielnica (ranking do dyskusji).
3. **Mapa bivariate „młodzież × deficyt zieleni"** — kieruje inwestycje tam, gdzie jest najwięcej młodych i najmniej zieleni.
4. **Wyspa ciepła / NDVI z Sentinel-2** — argument klimatyczny pod nasadzenia.
