#!/usr/bin/env python3
"""
Analiza "miasta 15-minutowego" i dostępności usług dla Opola.
Dla siatki punktów mieszkaniowych liczy dystans pieszy do najbliższej:
szkoły, przedszkola, sklepu spożywczego, apteki, lekarza, przystanku, sportu, zieleni.
Progi: 800 m (~10 min pieszo), 1200 m (~15 min pieszo).
Dodatkowo: wskaźniki per szkoła (odległość do zieleni/sportu, liczba przystanków w 400 m).
Źródło: OpenStreetMap (ODbL). Dystanse = liniowe (euklidesowe); realny pieszy ~1,2-1,4x dłuższy.
"""
import json, math, os, sys

D = os.path.join(os.path.dirname(__file__), "dane")
LAT0, LON0 = 50.67, 17.92
MLAT = 111320.0
MLON = 111320.0 * math.cos(math.radians(LAT0))
def to_m(lon, lat): return ((lon - LON0) * MLON, (lat - LAT0) * MLAT)

def load(name):
    p = os.path.join(D, name + ".geojson")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"features": []}

def points_m(fc):
    """Punkty w metrach — poligony/linie sprowadzane do centroidu."""
    out = []
    for f in fc["features"]:
        g = f.get("geometry") or {}; t = g.get("type"); c = g.get("coordinates")
        if t == "Point":
            out.append(to_m(*c)); continue
        ring = None
        if t == "Polygon" and c: ring = c[0]
        elif t == "MultiPolygon" and c and c[0]: ring = c[0][0]
        elif t == "LineString" and c: ring = c
        if ring:
            lon = sum(p[0] for p in ring)/len(ring); lat = sum(p[1] for p in ring)/len(ring)
            out.append(to_m(lon, lat))
    return out

def rings_of(feat):
    g = feat.get("geometry") or {}; t = g.get("type"); c = g.get("coordinates"); out = []
    if t == "Polygon" and c: out.append(c[0])
    elif t == "MultiPolygon" and c:
        for poly in c:
            if poly: out.append(poly[0])
    return out
def feat_rings_m(feat): return [[to_m(lon, lat) for lon, lat in r] for r in rings_of(feat)]
def pip(x, y, ring):
    inside = False; n = len(ring); j = n-1
    for i in range(n):
        xi, yi = ring[i]; xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj-xi)*(y-yi)/((yj-yi) or 1e-12)+xi): inside = not inside
        j = i
    return inside
def pip_any(x, y, rings): return any(pip(x, y, r) for r in rings)

class Hash:
    """Hash przestrzenny punktów -> najbliższy sąsiad."""
    def __init__(self, pts, cell=400.0):
        self.cell = cell; self.h = {}
        for (x, y) in pts:
            self.h.setdefault((int(x//cell), int(y//cell)), []).append((x, y))
    def nearest(self, x, y, maxr=4000):
        c = self.cell; cx, cy = int(x//c), int(y//c); best = 1e18; rad = 0
        while rad*c <= maxr+c:
            for ix in range(cx-rad, cx+rad+1):
                for iy in range(cy-rad, cy+rad+1):
                    if rad > 0 and abs(ix-cx) != rad and abs(iy-cy) != rad: continue
                    for (px, py) in self.h.get((ix, iy), ()):
                        dd = (px-x)**2+(py-y)**2
                        if dd < best: best = dd
            if best < 1e17 and rad >= 1: break
            rad += 1
        return math.sqrt(best) if best < 1e17 else None
    def count_within(self, x, y, r):
        c = self.cell; cx, cy = int(x//c), int(y//c); rad = int(r//c)+1; n = 0
        for ix in range(cx-rad, cx+rad+1):
            for iy in range(cy-rad, cy+rad+1):
                for (px, py) in self.h.get((ix, iy), ()):
                    if (px-x)**2+(py-y)**2 <= r*r: n += 1
        return n

print("Wczytuję dane POI...")
szkoly = load("szkoly")
cats = {
    "szkola": points_m(szkoly),
    "przedszkole": points_m(load("przedszkola_zlobki")),
    "sklep_spoz": points_m(load("sklepy_spozywcze")),
    "apteka_lekarz": points_m(load("zdrowie")),
    "przystanek": points_m(load("przystanki_bus")),
    "sport": points_m(load("boiska_sport")),
    "plac_zabaw": points_m(load("place_zabaw")),
    "kultura": points_m(load("kultura_mlodziez")),
}
# zieleń: użyj centroidów parków + zieleni urządzonej jako "wejść do zieleni"
green_pts = []
for lay in ("parki", "zielen_pozostala"):
    for f in load(lay)["features"]:
        for r in rings_of(f):
            pm = [to_m(lon, lat) for lon, lat in r]
            if pm:
                green_pts.append((sum(p[0] for p in pm)/len(pm), sum(p[1] for p in pm)/len(pm)))
cats["zielen"] = green_pts
for k, v in cats.items():
    print(f"  {k}: {len(v)}")

hashes = {k: Hash(v) for k, v in cats.items() if v}

# kategorie liczone do wyniku "15-min" (codzienne potrzeby)
CORE = ["szkola", "sklep_spoz", "apteka_lekarz", "przystanek", "zielen", "sport"]
T10, T15 = 800.0, 1200.0

print("Siatka mieszkaniowa + dostępność...")
miesz = load("mieszkaniowe")
# maska miasta (granica administracyjna = suma dzielnic) — pomijamy tereny spoza miasta
_dz = []
for f in load("dzielnice")["features"]:
    rm = feat_rings_m(f)
    if not rm: continue
    xs=[p[0] for r in rm for p in r]; ys=[p[1] for r in rm for p in r]
    _dz.append((rm,(min(xs),min(ys),max(xs),max(ys))))
def in_city(x,y):
    for rm,b in _dz:
        if b[0]<=x<=b[2] and b[1]<=y<=b[3] and pip_any(x,y,rm): return True
    return False
STEP = 120.0
grid_feats = []
agg = {k: [] for k in cats}       # dystanse
within10 = {k: 0 for k in CORE}
within15 = {k: 0 for k in CORE}
score_hist = [0]*(len(CORE)+1)
samples = 0
for f in miesz["features"]:
    rm = feat_rings_m(f)
    if not rm: continue
    pts = [p for r in rm for p in r]
    bx0 = min(p[0] for p in pts); by0 = min(p[1] for p in pts)
    bx1 = max(p[0] for p in pts); by1 = max(p[1] for p in pts)
    x = bx0
    while x <= bx1:
        y = by0
        while y <= by1:
            if pip_any(x, y, rm) and in_city(x, y):   # tylko w granicach miasta
                samples += 1
                dists = {}
                for k in cats:
                    h = hashes.get(k)
                    dists[k] = h.nearest(x, y) if h else None
                score = 0
                for k in CORE:
                    dd = dists[k]
                    if dd is not None and dd <= T10: within10[k] += 1
                    if dd is not None and dd <= T15: within15[k] += 1; score += 1
                    if dd is not None: agg[k].append(dd)
                for k in cats:
                    if k not in CORE and dists[k] is not None: agg[k].append(dists[k])
                score_hist[score] += 1
                lon = LON0 + x/MLON; lat = LAT0 + y/MLAT
                grid_feats.append({"type": "Feature",
                    "properties": {"score15": score,
                                   **{f"d_{k}": (round(dists[k]) if dists[k] is not None else None) for k in cats}},
                    "geometry": {"type": "Point", "coordinates": [round(lon,6), round(lat,6)]}})
            y += STEP
        x += STEP
print(f"  próbek: {samples}")

def avg(lst): return round(sum(lst)/len(lst)) if lst else None
def med(lst):
    if not lst: return None
    s = sorted(lst); n = len(s); return round((s[n//2] if n%2 else (s[n//2-1]+s[n//2])/2))

summary = {
    "progi_m": {"10min": T10, "15min": T15},
    "probek": samples,
    "srednia_odleglosc_m": {k: avg(agg[k]) for k in cats},
    "mediana_odleglosc_m": {k: med(agg[k]) for k in cats},
    # mianownik = WSZYSTKIE próbki mieszkaniowe (nieosiągalne = poza zasięgiem) — spójne z analizą sieciową
    "dostepnosc_10min_proc": {k: round(100*within10[k]/samples, 1) for k in CORE} if samples else {},
    "dostepnosc_15min_proc": {k: round(100*within15[k]/samples, 1) for k in CORE} if samples else {},
    "rozklad_liczby_uslug_15min": {str(i): score_hist[i] for i in range(len(score_hist))},
    "proc_pelne_15min_miasto": round(100*score_hist[len(CORE)]/samples, 1) if samples else None,
    "kategorie_core": CORE,
}
json.dump(summary, open(os.path.join(D, "podsumowanie15.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
# zapis siatki (zredukuj rozmiar - bez pełnej precyzji)
json.dump({"type": "FeatureCollection", "features": grid_feats},
          open(os.path.join(D, "dostepnosc15.geojson"), "w", encoding="utf-8"), ensure_ascii=False)

# ---- per szkoła ----
print("Wskaźniki per szkoła...")
school_feats = []
for f in szkoly["features"]:
    g = f.get("geometry") or {}
    if g.get("type") != "Point": continue
    x, y = to_m(*g["coordinates"])
    pr = f.get("properties", {})
    def nd(cat):
        h = hashes.get(cat);
        if not h: return None
        d = h.nearest(x, y); return round(d) if d is not None else None
    rec = {"type": "Feature", "geometry": g, "properties": {
        "nazwa": pr.get("name"), "typ": pr.get("amenity"),
        "do_zieleni_m": nd("zielen"),
        "do_sportu_m": nd("sport"),
        "do_placu_zabaw_m": nd("plac_zabaw"),
        "przystanki_400m": hashes["przystanek"].count_within(x, y, 400) if "przystanek" in hashes else None,
        "do_apteki_lekarza_m": nd("apteka_lekarz"),
    }}
    school_feats.append(rec)
json.dump({"type": "FeatureCollection", "features": school_feats},
          open(os.path.join(D, "szkoly_wskazniki.geojson"), "w", encoding="utf-8"), ensure_ascii=False)

print("\n=== 15-MIN MIASTO ===")
print(json.dumps(summary, ensure_ascii=False, indent=2))
print(f"\nSzkół z wskaźnikami: {len(school_feats)}")
sf = [s["properties"] for s in school_feats]
print("Średnia odl. szkoły do zieleni:", avg([s["do_zieleni_m"] for s in sf if s["do_zieleni_m"]]), "m")
print("Średnia odl. szkoły do sportu:", avg([s["do_sportu_m"] for s in sf if s["do_sportu_m"]]), "m")
print("Średnio przystanków w 400 m od szkoły:",
      round(sum(s["przystanki_400m"] for s in sf if s["przystanki_400m"] is not None)/max(1,len(sf)), 1))
