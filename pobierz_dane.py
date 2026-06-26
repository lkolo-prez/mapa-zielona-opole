#!/usr/bin/env python3
"""
Pobiera publiczne dane OpenStreetMap dla Opola (Overpass API) i zapisuje jako GeoJSON.
Źródło danych: OpenStreetMap (c) kontrybutorzy OSM, licencja ODbL.
Pipeline pod mapę zieleni miejskiej (obszar 7 Strategii Młodzieżowej).
"""
import json, time, sys, urllib.request, urllib.parse, os

OUT = os.path.join(os.path.dirname(__file__), "dane")
os.makedirs(OUT, exist_ok=True)

# Opole: relacja OSM 2661906, bbox (S,W,N,E)
BBOX = "50.5876,17.7799,50.7700,18.0327"
REL_ID = 2661906

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

def overpass(q, tries=4):
    """Wykonuje zapytanie Overpass z fallbackiem na mirrory."""
    last = None
    for attempt in range(tries):
        ep = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            data = urllib.parse.urlencode({"data": q}).encode()
            req = urllib.request.Request(ep, data=data,
                  headers={"User-Agent": "opole-zielen-map/1.0 (strategia mlodziezowa)"})
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read().decode("utf-8", "replace")
            if raw.lstrip().startswith("{"):
                return json.loads(raw)
            print(f"  ! {ep}: odpowiedź nie-JSON (przeciążony?), próba {attempt+1}", file=sys.stderr)
        except Exception as e:
            last = e
            print(f"  ! {ep}: {e}, próba {attempt+1}", file=sys.stderr)
        time.sleep(8)
    raise RuntimeError(f"Overpass nieosiągalny: {last}")

def to_geojson(osm, keep_tags=True):
    """Konwertuje Overpass (out geom) na GeoJSON FeatureCollection."""
    feats = []
    for el in osm.get("elements", []):
        t = el.get("type")
        tags = el.get("tags", {}) if keep_tags else {}
        if t == "node" and "lat" in el:
            geom = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}
        elif t == "way" and "geometry" in el:
            coords = [[p["lon"], p["lat"]] for p in el["geometry"]]
            if len(coords) < 2:
                continue
            closed = coords[0] == coords[-1] and len(coords) >= 4
            if closed:
                geom = {"type": "Polygon", "coordinates": [coords]}
            else:
                geom = {"type": "LineString", "coordinates": coords}
        elif t == "relation" and "members" in el:
            outers = []
            for m in el["members"]:
                if m.get("type") == "way" and "geometry" in m and m.get("role") in ("outer", ""):
                    ring = [[p["lon"], p["lat"]] for p in m["geometry"]]
                    if len(ring) >= 3:
                        if ring[0] != ring[-1]:
                            ring.append(ring[0])
                        outers.append([ring])
            if not outers:
                continue
            geom = {"type": "MultiPolygon", "coordinates": outers}
        else:
            continue
        feats.append({"type": "Feature", "properties": {**tags, "_id": f"{t}/{el['id']}"}, "geometry": geom})
    return {"type": "FeatureCollection", "features": feats}

def save(name, fc):
    path = os.path.join(OUT, name + ".geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False)
    print(f"  -> {name}.geojson : {len(fc['features'])} obiektów ({os.path.getsize(path)//1024} KB)")
    return len(fc["features"])

# Definicje warstw: nazwa -> fragment zapytania Overpass
LAYERS = {
    "granica": f'relation({REL_ID});',
    "parki": f'(way["leisure"="park"]({BBOX});relation["leisure"="park"]({BBOX}););',
    "lasy": f'(way["landuse"="forest"]({BBOX});way["natural"="wood"]({BBOX});relation["landuse"="forest"]({BBOX});relation["natural"="wood"]({BBOX}););',
    "zielen_pozostala": f'(way["leisure"="garden"]({BBOX});way["leisure"="nature_reserve"]({BBOX});way["landuse"="grass"]({BBOX});way["landuse"="meadow"]({BBOX});way["landuse"="recreation_ground"]({BBOX});way["landuse"="village_green"]({BBOX});way["natural"="grassland"]({BBOX});way["natural"="scrub"]({BBOX}););',
    "place_zabaw": f'(node["leisure"="playground"]({BBOX});way["leisure"="playground"]({BBOX}););',
    "boiska_sport": f'(way["leisure"="pitch"]({BBOX});way["leisure"="sports_centre"]({BBOX});way["leisure"="stadium"]({BBOX}););',
    "drzewa": f'node["natural"="tree"]({BBOX});',
    "aleje_drzew": f'way["natural"="tree_row"]({BBOX});',
    "mieszkaniowe": f'(way["landuse"="residential"]({BBOX});relation["landuse"="residential"]({BBOX}););',
    "szkoly": f'(node["amenity"="school"]({BBOX});way["amenity"="school"]({BBOX});node["amenity"="college"]({BBOX});way["amenity"="college"]({BBOX});node["amenity"="university"]({BBOX});way["amenity"="university"]({BBOX}););',
    "woda": f'(way["natural"="water"]({BBOX});relation["natural"="water"]({BBOX});way["waterway"="riverbank"]({BBOX}););',
}

def main():
    counts = {}
    for name, body in LAYERS.items():
        print(f"[{name}] pobieram...")
        q = f"[out:json][timeout:90];({body});out geom;"
        try:
            osm = overpass(q)
            fc = to_geojson(osm)
            counts[name] = save(name, fc)
        except Exception as e:
            print(f"  !! BŁĄD warstwy {name}: {e}", file=sys.stderr)
            counts[name] = None
        time.sleep(3)
    with open(os.path.join(OUT, "_podsumowanie.json"), "w", encoding="utf-8") as f:
        json.dump(counts, f, ensure_ascii=False, indent=2)
    print("\nPodsumowanie:", json.dumps(counts, ensure_ascii=False))

if __name__ == "__main__":
    main()
