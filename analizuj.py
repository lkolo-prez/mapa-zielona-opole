#!/usr/bin/env python3
"""
Silnik analityczny mapy zieleni Opola — czysty Python (bez zależności).
Liczy wskaźniki dostępności zieleni dla 13 dzielnic + wykrywa "puste plamy".

Metody (udokumentowane, weryfikowalne):
 - rzut równopostaciowy (equirectangular) wokół środka Opola -> metry
 - pole powierzchni: wzór Gaussa (shoelace)
 - przynależność punktu do wieloboku: ray casting
 - dostępność: próbkowanie granic zieleni co 25 m + hash przestrzenny 250 m,
   siatka punktów mieszkaniowych co 120 m, dystans do najbliższej zieleni
Standardy odniesienia:
 - WHO Europe / EEA: teren zielony w zasięgu ~300 m (5 min pieszo) od domu
 - ANGSt (Natural England): min. 2 ha zieleni w promieniu 300 m
 - często cytowany próg 9 m² zieleni / mieszkańca (minimum), 50 m² (cel)
Źródła danych: OpenStreetMap (ODbL) + ArcGIS UM Opole (warstwa "Dzielnice miasta Opole").
"""
import json, math, os, sys

D = os.path.join(os.path.dirname(__file__), "dane")
OUT = os.path.join(os.path.dirname(__file__), "dane")

LAT0, LON0 = 50.67, 17.92
MLAT = 111320.0
MLON = 111320.0 * math.cos(math.radians(LAT0))

def to_m(lon, lat):
    return ((lon - LON0) * MLON, (lat - LAT0) * MLAT)

def load(name):
    p = os.path.join(D, name + ".geojson")
    if not os.path.exists(p):
        print(f"  (brak {name})", file=sys.stderr); return {"features": []}
    return json.load(open(p, encoding="utf-8"))

def rings_of(feat):
    """Zwraca listę zewnętrznych pierścieni (w stopniach) z Polygon/MultiPolygon."""
    g = feat.get("geometry") or {}
    t = g.get("type"); c = g.get("coordinates")
    out = []
    if t == "Polygon" and c:
        out.append(c[0])
    elif t == "MultiPolygon" and c:
        for poly in c:
            if poly: out.append(poly[0])
    return out

def ring_area_centroid_m(ring_deg):
    """Pole (m², dodatnie) i centroid (m) pierścienia."""
    pts = [to_m(lon, lat) for lon, lat in ring_deg]
    if len(pts) < 3: return 0.0, None
    a = 0.0; cx = 0.0; cy = 0.0
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]; x1, y1 = pts[i + 1]
        cross = x0 * y1 - x1 * y0
        a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross
    a *= 0.5
    if abs(a) < 1e-9:
        return 0.0, (sum(p[0] for p in pts)/len(pts), sum(p[1] for p in pts)/len(pts))
    cx /= (6 * a); cy /= (6 * a)
    return abs(a), (cx, cy)

def point_in_ring_m(x, y, ring_m):
    """Ray casting w metrach."""
    inside = False; n = len(ring_m); j = n - 1
    for i in range(n):
        xi, yi = ring_m[i]; xj, yj = ring_m[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside

def feat_rings_m(feat):
    return [[to_m(lon, lat) for lon, lat in r] for r in rings_of(feat)]

def point_in_feature_m(x, y, rings_m):
    return any(point_in_ring_m(x, y, r) for r in rings_m)

# ---------- wczytanie ----------
print("Wczytuję dane...")
dziel = load("dzielnice")
parki = load("parki")
lasy = load("lasy")
zielen = load("zielen_pozostala")
drzewa = load("drzewa")
miesz = load("mieszkaniowe")
place = load("place_zabaw")
boiska = load("boiska_sport")

granica = load("granica")

def green_cat(props):
    """Klasyfikacja zieleni wg dostępności rekreacyjnej."""
    if props.get("leisure") == "park":
        return "park"
    if props.get("landuse") == "forest" or props.get("natural") == "wood":
        return "las"
    if (props.get("leisure") in ("garden", "nature_reserve", "common")
            or props.get("landuse") in ("grass", "recreation_ground", "village_green")):
        return "urzadzona"
    return "naturalna"  # meadow, grassland, scrub — tereny nieurządzone

green_layers = [("park", parki), ("las", lasy), ("zielen", zielen)]

# Przygotuj dzielnice: rings w metrach + atrybuty
districts = []
for f in dziel["features"]:
    p = f["properties"]
    rm = feat_rings_m(f)
    if not rm: continue
    # bbox
    xs = [pt[0] for r in rm for pt in r]; ys = [pt[1] for r in rm for pt in r]
    area = sum(ring_area_centroid_m(r)[0] for r in rings_of(f))
    districts.append({
        "feat": f, "rings_m": rm,
        "bbox": (min(xs), min(ys), max(xs), max(ys)),
        "nazwa": p.get("nazwa"), "numer": p.get("numer"),
        "ludnosc": p.get("ludnosc_26") or p.get("ludnosc_25") or 0,
        "gestosc": p.get("gestosc_26"),
        "mlodziez": p.get("proc_w_przed_prod_26"),  # liczba w wieku przedprodukcyjnym
        "sr_wieku": p.get("sr_wieku_26"),
        "obciazenie": p.get("obciazenie_demo_26"),
        "area_m2": area,
        "green_m2": 0.0, "trees": 0, "parks": 0, "playgrounds": 0,
    })
print(f"  dzielnic: {len(districts)}")

def find_district(x, y):
    for d in districts:
        bx0, by0, bx1, by1 = d["bbox"]
        if bx0 <= x <= bx1 and by0 <= y <= by1 and point_in_feature_m(x, y, d["rings_m"]):
            return d
    return None

# granica miasta (do przycięcia danych z bbox)
city_rings = []
city_bbox = None
for f in granica["features"]:
    for r in feat_rings_m(f):
        city_rings.append(r)
if city_rings:
    xs = [p[0] for r in city_rings for p in r]; ys = [p[1] for r in city_rings for p in r]
    city_bbox = (min(xs), min(ys), max(xs), max(ys))
def in_city(x, y):
    # Granica z relacji OSM (out geom) bywa pocięta na odcinki, więc jako maskę
    # miasta używamy sumy 13 dzielnic (pokrywają cały obszar administracyjny).
    return find_district(x, y) is not None

# rozszerz słownik dzielnic o kategorie zieleni
for d in districts:
    d["g_park"] = 0.0; d["g_urz"] = 0.0; d["g_las"] = 0.0; d["g_nat"] = 0.0

# ---------- zieleń: pole PRZYCIĘTE geometrycznie do granic dzielnic (POPRAWKA audyt #7) ----------
# Zamiast liczyć cały poligon po centroidzie, przecinamy go z geometrią każdej dzielnicy (shapely)
# i sumujemy tylko część wewnątrz miasta. To eliminuje zawyżenie dla poligonów granicznych.
print("Liczę powierzchnię zieleni (geometryczne przycięcie do dzielnic, shapely)...")
from shapely.geometry import Polygon as ShpPoly
from shapely.ops import unary_union
from shapely import STRtree

# geometrie dzielnic w metrach
for d in districts:
    polys = [ShpPoly(r) for r in d["rings_m"] if len(r) >= 4]
    polys = [p.buffer(0) for p in polys if p.is_valid or True]
    d["geom"] = unary_union(polys) if polys else None
    d["gbounds"] = d["geom"].bounds if d["geom"] is not None else None
dist_with_geom = [d for d in districts if d["geom"] is not None]

CATKEY = {"park":"park","urzadzona":"urz","las":"las","naturalna":"nat"}
green_tot = {"park": 0.0, "urzadzona": 0.0, "las": 0.0, "naturalna": 0.0}
green_for_access = []
for kind, layer in green_layers:
    for f in layer["features"]:
        cat0 = green_cat(f.get("properties", {}))
        for r in rings_of(f):
            if len(r) < 4: continue
            rm = [to_m(lon, lat) for lon, lat in r]
            green_for_access.append(rm)
            gp = ShpPoly(rm)
            if not gp.is_valid: gp = gp.buffer(0)
            if gp.is_empty or gp.area <= 0: continue
            gb = gp.bounds
            counted_park = False
            for d in dist_with_geom:
                db = d["gbounds"]
                if gb[2] < db[0] or gb[0] > db[2] or gb[3] < db[1] or gb[1] > db[3]:
                    continue  # bboxy się nie pokrywają
                inter = gp.intersection(d["geom"])
                a = inter.area
                if a <= 0: continue
                green_tot[cat0] += a
                d["green_m2"] += a
                d["g_" + CATKEY[cat0]] += a
                if cat0 == "park" and not counted_park:
                    d["parks"] += 1; counted_park = True
total_green = sum(green_tot.values())
dostepna = green_tot["park"] + green_tot["urzadzona"]
print(f"  zieleń w mieście: {total_green/1e6:.2f} km² (parki {green_tot['park']/1e4:.0f} ha, "
      f"urządzona {green_tot['urzadzona']/1e4:.0f} ha, lasy {green_tot['las']/1e4:.0f} ha, "
      f"naturalna {green_tot['naturalna']/1e4:.0f} ha); pierścieni do analizy dostępu: {len(green_for_access)}")

# ---------- drzewa ----------
print("Przypisuję drzewa do dzielnic...")
tree_pts_m = []
for f in drzewa["features"]:
    g = f.get("geometry") or {}
    if g.get("type") != "Point": continue
    lon, lat = g["coordinates"]; x, y = to_m(lon, lat)
    tree_pts_m.append((x, y))
    d = find_district(x, y)
    if d: d["trees"] += 1
print(f"  drzew (OSM): {len(tree_pts_m)}")

# place zabaw -> dzielnica
for f in place["features"]:
    g = f.get("geometry") or {}
    if g.get("type") == "Point":
        x, y = to_m(*g["coordinates"])
    else:
        rs = rings_of(f)
        if not rs: continue
        x, y = ring_area_centroid_m(rs[0])[1]
    d = find_district(x, y)
    if d: d["playgrounds"] += 1

# ---------- dostępność: hash przestrzenny granic zieleni ----------
print("Buduję hash przestrzenny zieleni (próbkowanie co 25 m)...")
CELL = 250.0
SAMPLE = 25.0
ghash = {}
def add_pt(x, y):
    key = (int(x // CELL), int(y // CELL))
    ghash.setdefault(key, []).append((x, y))

for ring in green_for_access:
    for i in range(len(ring) - 1):
        x0, y0 = ring[i]; x1, y1 = ring[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(seg // SAMPLE))
        for k in range(n + 1):
            t = k / n
            add_pt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
print(f"  punktów granic zieleni: {sum(len(v) for v in ghash.values())} w {len(ghash)} komórkach")

def nearest_green(x, y, maxr=1200):
    cx, cy = int(x // CELL), int(y // CELL)
    best = 1e18
    rad = 0
    while rad * CELL <= maxr + CELL:
        found_any = False
        for ix in range(cx - rad, cx + rad + 1):
            for iy in range(cy - rad, cy + rad + 1):
                if rad > 0 and abs(ix - cx) != rad and abs(iy - cy) != rad:
                    continue  # tylko pierścień
                for (px, py) in ghash.get((ix, iy), ()):
                    found_any = True
                    dd = (px - x) ** 2 + (py - y) ** 2
                    if dd < best: best = dd
        if best < 1e17 and rad >= 1:
            break
        rad += 1
        if rad * CELL > maxr + CELL:
            break
    return math.sqrt(best) if best < 1e17 else None

# ---------- siatka punktów mieszkaniowych ----------
print("Generuję siatkę mieszkaniową i liczę dostępność...")
STEP = 120.0
under500 = []  # puste plamy
samples = 0; w300 = 0; w500 = 0
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
            if point_in_feature_m(x, y, rm) and in_city(x, y):   # tylko w granicach miasta
                dist = nearest_green(x, y)
                samples += 1
                if dist is None: dist = 9999
                if dist <= 300: w300 += 1
                if dist <= 500: w500 += 1
                else:
                    # punkt w stopniach z powrotem
                    lon = LON0 + x / MLON; lat = LAT0 + y / MLAT
                    under500.append((round(lon, 6), round(lat, 6), round(dist)))
            y += STEP
        x += STEP
print(f"  punktów mieszkaniowych: {samples}; <300m: {w300}; <500m: {w500}; puste plamy(>500m): {len(under500)}")

# ---------- zapisy ----------
# 1) dzielnice wzbogacone
feats = []
for d in districts:
    f = json.loads(json.dumps(d["feat"]))  # kopia
    lud = d["ludnosc"] or 0
    gm2pc = (d["green_m2"] / lud) if lud else None
    dost = d["g_park"] + d["g_urz"]
    dostpc = (dost / lud) if lud else None
    mlodz = d["mlodziez"] or 0
    f["properties"] = {
        "nazwa": d["nazwa"], "numer": d["numer"], "ludnosc": lud,
        "gestosc": d["gestosc"], "sr_wieku": d["sr_wieku"],
        "mlodziez_liczba": mlodz,
        "mlodziez_proc": round(100 * mlodz / lud, 1) if lud else None,
        "obciazenie_demo": d["obciazenie"],
        "powierzchnia_km2": round(d["area_m2"] / 1e6, 2),
        "zielen_ha": round(d["green_m2"] / 1e4, 1),
        "zielen_proc_powierzchni": round(100 * d["green_m2"] / d["area_m2"], 1) if d["area_m2"] else None,
        "zielen_m2_na_os": round(gm2pc, 1) if gm2pc is not None else None,
        "zielen_dostepna_ha": round(dost / 1e4, 1),
        "zielen_dostepna_m2_na_os": round(dostpc, 1) if dostpc is not None else None,
        "parki_ha": round(d["g_park"] / 1e4, 1),
        "lasy_ha": round(d["g_las"] / 1e4, 1),
        "drzewa": d["trees"],
        "drzewa_na_1000": round(1000 * d["trees"] / lud, 1) if lud else None,
        "parki": d["parks"], "place_zabaw": d["playgrounds"],
    }
    feats.append(f)
json.dump({"type": "FeatureCollection", "features": feats},
          open(os.path.join(OUT, "dzielnice_wskazniki.geojson"), "w", encoding="utf-8"),
          ensure_ascii=False)

# 2) puste plamy
pp = {"type": "FeatureCollection", "features": [
    {"type": "Feature", "properties": {"dist_do_zieleni_m": dist},
     "geometry": {"type": "Point", "coordinates": [lon, lat]}}
    for lon, lat, dist in under500]}
json.dump(pp, open(os.path.join(OUT, "puste_plamy.geojson"), "w", encoding="utf-8"), ensure_ascii=False)

# 3) podsumowanie miasta
total_pop = sum((d["ludnosc"] or 0) for d in districts)
total_trees = sum(d["trees"] for d in districts)
total_youth = sum((d["mlodziez"] or 0) for d in districts)
summary = {
    "ludnosc_total": total_pop,
    "mlodziez_total": total_youth,
    "mlodziez_proc": round(100 * total_youth / total_pop, 1) if total_pop else None,
    "zielen_km2": round(total_green / 1e6, 2),
    "zielen_ha": round(total_green / 1e4, 0),
    "zielen_m2_na_os": round(total_green / total_pop, 1) if total_pop else None,
    "zielen_dostepna_ha": round(dostepna / 1e4, 0),
    "zielen_dostepna_m2_na_os": round(dostepna / total_pop, 1) if total_pop else None,
    "parki_ha": round(green_tot["park"] / 1e4, 0),
    "lasy_ha": round(green_tot["las"] / 1e4, 0),
    "zielen_naturalna_ha": round(green_tot["naturalna"] / 1e4, 0),
    "drzewa_osm": len(tree_pts_m),
    "drzewa_w_dzielnicach": total_trees,
    "drzewa_na_1000": round(1000 * total_trees / total_pop, 1) if total_pop else None,
    "dostepnosc_probek": samples,
    "dostepnosc_300m_proc": round(100 * w300 / samples, 1) if samples else None,
    "dostepnosc_500m_proc": round(100 * w500 / samples, 1) if samples else None,
    "puste_plamy_punkty": len(under500),
    "puste_plamy_proc": round(100 * len(under500) / samples, 1) if samples else None,
    "parki_osm": len(parki["features"]),
    "place_zabaw_osm": len(place["features"]),
    "boiska_osm": len(boiska["features"]),
}
json.dump(summary, open(os.path.join(OUT, "podsumowanie_analiza.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

print("\n=== PODSUMOWANIE ===")
print(json.dumps(summary, ensure_ascii=False, indent=2))
print("\nRanking dzielnic wg m² zieleni / mieszkańca:")
rank = sorted([f["properties"] for f in feats], key=lambda p: (p["zielen_m2_na_os"] or -1))
for p in rank:
    print(f"  {str(p['numer']):>4} {str(p['nazwa'])[:22]:22} | "
          f"ludn {p['ludnosc']:>6} | zieleń/os {str(p['zielen_m2_na_os']):>7} m² | "
          f"drzewa/1000 {str(p['drzewa_na_1000']):>6} | młodzież {str(p['mlodziez_proc'])}%")
