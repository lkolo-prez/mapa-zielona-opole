# Notatka robocza — Obszar 7: Zielona przestrzeń i dobrostan
### Spotkanie zespołu ds. Strategii Młodzieżowej · 1 lipca 2026, MBP ul. Minorytów 4

Materiał towarzyszący: **interaktywna mapa analityczna** (`mapa-zielona-opole/index.html`).
Wszystkie liczby pochodzą z danych publicznych (OSM, ArcGIS UM Opole, GUS) — są weryfikowalne i naniesione na mapę.

---

## 1. Punkt wyjścia — fakty, nie tezy

**Zieleń jest, i jest jej dużo — problemem jest rozmieszczenie i jakość, nie ilość.**

| Wskaźnik | Wartość | Odniesienie |
|---|---|---|
| Tereny zielone łącznie | ~3 370 ha (≈22% powierzchni miasta) | — |
| Zieleń urządzona / mieszkańca | **74 m²** | min. cytowane 9 m², cel 50 m² → **spełnione** |
| Dostępność zieleni ≤300 m (pieszo, w mieście) | **98,6%** terenów mieszkaniowych | standard WHO/EEA: ~300 m |
| Dostępność zieleni ≤500 m | 99,9% | — |
| „Puste plamy" (>500 m od zieleni, w granicach miasta) | **1 punkt** (0,1%) | analiza przycięta do granic miasta |
| Drzewa (OSM) | 4 895 (niedoszacowane) | 29,6 / 1000 mieszk. |

## 2. Gdzie są realne braki (do interwencji)

- **Zieleń jest wszędzie, problemem jest jej JAKOŚĆ i OCHRONA** — w mieście zostaje tylko 1 „pusta plama". Za to: tylko **56% oficjalnych stref zieleni jest faktycznie zielone**, a **~50% realnej zieleni leży poza strefami zieleni** (niechronione planem). To są realne tematy, nie brak zieleni jako takiej.
- **Nierówność „drzewiasta":** gęste śródmieście (dz. IV) ma **1,1 drzewa / 1000 mieszk.**, peryferie kilkadziesiąt. Centrum = priorytet nasadzeń i cienia (adaptacja do upałów).
- **Dostęp pieszo po realnej sieci (mediana):** zieleń 2,9 min, przystanek 3,7 min — bardzo dobrze. Ale **żłobek 23 min** (tylko 19% terenów w 15 min) i apteka/lekarz 9,6 min (66% w 15 min). Żłobki i opieka zdrowotna to realne luki.
- **Pełne „miasto 15-minutowe" (6/6 usług pieszo): 39,5%** terenów mieszkaniowych — reszta wymaga dojazdu.

## 3. Kontekst demograficzny (10 lat, bez tezy)

- Ludność (zameldowani): **126 231 → 116 628 (−7,6%)**; projekcja trendu 2030: ~112 300.
- Starzenie: średni wiek **43,1 → 46,0 lat**.
- **Dzielnica XIII rośnie** (+30% ludności, +72% młodzieży) — tu popyt na infrastrukturę dla młodych będzie rósł.
- Rdzeń miasta (III, VIII, X) wyludnia się i starzeje.
- *Uwaga: GUS podaje dla całego miasta 128 140 (01.06.2026) — inna metodologia niż zameldowania w dzielnicach.*

## 4. Czego NIE wiemy z danych otwartych (uczciwie)

1. **Stan techniczny obiektów** (place zabaw, boiska, parki) — brak. Tylko proxy: nawierzchnia, oświetlenie (cząstkowo).
   → *propozycja: strategia tworzy rejestr stanu przestrzeni dla młodych.*
2. **Natężenie ruchu / „popular times" (Google/Apple)** — zastrzeżone. Zamiennik: mapy hałasu UM Opole 2022, liczniki MZD.
3. **Trasy aktywności (Strava)** — w mapie jest publiczny podgląd heatmapy; surowe trasy = **Strava Metro** (bezpłatne dla samorządu na wniosek).
4. **Rejony szkół, pełny rejestr firm** — do pozyskania z UM / GUS REGON.

## 5. Pytania do dyskusji na spotkaniu

1. Czy „puste plamy" pokrywają się z miejscami, gdzie młodzież faktycznie bywa? (weryfikacja terenowa)
2. Priorytet: **dosadzać drzewa w centrum** (cień, klimat) czy **urządzać zieleń na peryferiach** (nowe osiedla)?
3. Czy w dzielnicy XIII (rosnącej) infrastruktura nadąża za napływem młodych rodzin?
4. „Strefy bez telefonu i hałasu" — gdzie są dziś najcichsze, zielone miejsca? (warstwa do dołożenia z map hałasu)
5. Czy miasto wystąpi o **Strava Metro**, by poznać realne trasy ruchu młodych?

---
*Pełna metodyka i źródła: `README.md`. Mapa: uruchom `python3 -m http.server` w katalogu i otwórz `index.html`.*
