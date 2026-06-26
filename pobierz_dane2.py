#!/usr/bin/env python3
"""
Pobieracz #2: transport, usługi, firmy, zdrowie, kultura — pod analizę "miasta 15-minutowego".
Źródło: OpenStreetMap (ODbL). Dane punktowe (centroidy dla obiektów powierzchniowych).
"""
import json, time, sys, os
from pobierz_dane import overpass, to_geojson, save, BBOX

OUT = os.path.join(os.path.dirname(__file__), "dane")

def centroidize(fc):
    """Zamienia poligony/linie na punkty (centroid) — lżejsze warstwy POI."""
    import statistics
    out = []
    for f in fc["features"]:
        g = f["geometry"]; t = g["type"]
        if t == "Point":
            out.append(f); continue
        if t == "Polygon":
            ring = g["coordinates"][0]
        elif t == "LineString":
            ring = g["coordinates"]
        elif t == "MultiPolygon":
            ring = g["coordinates"][0][0]
        else:
            continue
        lon = sum(p[0] for p in ring) / len(ring)
        lat = sum(p[1] for p in ring) / len(ring)
        out.append({"type": "Feature", "properties": f["properties"],
                    "geometry": {"type": "Point", "coordinates": [round(lon,6), round(lat,6)]}})
    return {"type": "FeatureCollection", "features": out}

B = BBOX
LAYERS = {
    # --- transport ---
    "przystanki_bus": f'(node["highway"="bus_stop"]({B});node["public_transport"="platform"]["bus"="yes"]({B}););',
    "stacje_kolej": f'(node["railway"="station"]({B});node["railway"="halt"]({B});way["railway"="station"]({B});node["railway"="tram_stop"]({B}););',
    "taxi": f'node["amenity"="taxi"]({B});',
    "rowery_miejskie": f'(node["amenity"="bicycle_rental"]({B});way["amenity"="bicycle_rental"]({B}););',
    "stojaki_rowerowe": f'node["amenity"="bicycle_parking"]({B});',
    "parkingi": f'(node["amenity"="parking"]({B});way["amenity"="parking"]({B}););',
    "lotnicze": f'(node["aeroway"="helipad"]({B});way["aeroway"="helipad"]({B});node["aeroway"="aerodrome"]({B});way["aeroway"="aerodrome"]({B}););',
    # --- usługi codzienne / 15-min ---
    "sklepy_spozywcze": f'(node["shop"~"supermarket|convenience|bakery|greengrocer|grocery"]({B});way["shop"~"supermarket|convenience|bakery|greengrocer|grocery"]({B}););',
    "sklepy_pozostale": f'(node["shop"]({B});way["shop"]({B}););',
    "zdrowie": f'(node["amenity"~"pharmacy|doctors|clinic|hospital|dentist"]({B});way["amenity"~"pharmacy|doctors|clinic|hospital|dentist"]({B}););',
    "przedszkola_zlobki": f'(node["amenity"~"kindergarten|childcare"]({B});way["amenity"~"kindergarten|childcare"]({B}););',
    "gastronomia": f'(node["amenity"~"cafe|restaurant|fast_food|bar|pub|ice_cream"]({B});way["amenity"~"cafe|restaurant|fast_food|bar|pub|ice_cream"]({B}););',
    "kultura_mlodziez": f'(node["amenity"~"library|theatre|cinema|arts_centre|community_centre|youth_centre"]({B});way["amenity"~"library|theatre|cinema|arts_centre|community_centre|youth_centre"]({B});node["tourism"="museum"]({B});way["tourism"="museum"]({B});node["leisure"~"sports_centre|fitness_centre"]({B}););',
    "uslugi_publiczne": f'(node["amenity"~"townhall|post_office|bank|police|courthouse"]({B});way["amenity"~"townhall|post_office|bank|police"]({B});node["office"="government"]({B}););',
    "firmy_biura": f'(node["office"]({B});way["office"]({B}););',
}

def main():
    counts = {}
    for name, body in LAYERS.items():
        print(f"[{name}] pobieram...")
        q = f"[out:json][timeout:120];({body});out center;"
        try:
            osm = overpass(q)
            # out center -> way ma 'center'; przerób na punkt
            for el in osm.get("elements", []):
                if el.get("type") == "way" and "center" in el and "geometry" not in el:
                    el["type"] = "node"
                    el["lat"] = el["center"]["lat"]; el["lon"] = el["center"]["lon"]
            fc = to_geojson(osm)
            fc = centroidize(fc)
            counts[name] = save(name, fc)
        except Exception as e:
            print(f"  !! BŁĄD {name}: {e}", file=sys.stderr)
            counts[name] = None
        time.sleep(3)
    with open(os.path.join(OUT, "_podsumowanie2.json"), "w", encoding="utf-8") as f:
        json.dump(counts, f, ensure_ascii=False, indent=2)
    print("\nPodsumowanie2:", json.dumps(counts, ensure_ascii=False))

if __name__ == "__main__":
    main()
