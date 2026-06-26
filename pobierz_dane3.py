#!/usr/bin/env python3
"""Lekki dociąg brakujących warstw usług (po timeoutach na publicznym Overpass).
Najcięższe zbiory (wszystkie sklepy/firmy) pobieramy jako węzły (gros POI to węzły)."""
import json, time, sys, os
from pobierz_dane import overpass, to_geojson, save, BBOX
from pobierz_dane2 import centroidize
B = BBOX
OUT = os.path.join(os.path.dirname(__file__), "dane")

# (nazwa, zapytanie, czy_centroid)
JOBS = [
    ("sklepy_spozywcze", f'(node["shop"~"supermarket|convenience|bakery|greengrocer|grocery"]({B});way["shop"~"supermarket|convenience|bakery"]({B}););', True),
    ("zdrowie", f'(node["amenity"~"pharmacy|doctors|clinic|hospital|dentist"]({B});way["amenity"~"clinic|hospital"]({B}););', True),
    ("przedszkola_zlobki", f'(node["amenity"~"kindergarten|childcare"]({B});way["amenity"~"kindergarten|childcare"]({B}););', True),
    ("kultura_mlodziez", f'(node["amenity"~"library|theatre|cinema|arts_centre|community_centre|youth_centre"]({B});way["amenity"~"library|theatre|community_centre"]({B});node["tourism"="museum"]({B});node["leisure"~"sports_centre|fitness_centre"]({B}););', True),
    ("uslugi_publiczne", f'(node["amenity"~"townhall|post_office|bank|police|courthouse"]({B});node["office"="government"]({B}););', True),
    ("gastronomia", f'node["amenity"~"cafe|restaurant|fast_food|bar|pub|ice_cream"]({B});', False),
    ("sklepy_pozostale", f'node["shop"]({B});', False),   # tylko węzły — lekko
    ("firmy_biura", f'node["office"]({B});', False),       # tylko węzły — lekko
]

def run():
    counts = {}
    for name, body, cent in JOBS:
        if os.path.exists(os.path.join(OUT, name + ".geojson")):
            print(f"[{name}] już jest, pomijam"); continue
        print(f"[{name}] pobieram...")
        q = f"[out:json][timeout:60];({body});out center;"
        try:
            osm = overpass(q, tries=6)
            for el in osm.get("elements", []):
                if el.get("type") == "way" and "center" in el and "geometry" not in el:
                    el["type"] = "node"; el["lat"] = el["center"]["lat"]; el["lon"] = el["center"]["lon"]
            fc = to_geojson(osm)
            fc = centroidize(fc)
            counts[name] = save(name, fc)
        except Exception as e:
            print(f"  !! {name}: {e}", file=sys.stderr); counts[name] = None
        time.sleep(5)
    print("Dociąg:", json.dumps(counts, ensure_ascii=False))
    # zapis łącznego podsumowania2
    s2 = {}
    for n in ["przystanki_bus","stacje_kolej","taxi","rowery_miejskie","stojaki_rowerowe","parkingi","lotnicze",
              "sklepy_spozywcze","sklepy_pozostale","zdrowie","przedszkola_zlobki","gastronomia","kultura_mlodziez","uslugi_publiczne","firmy_biura"]:
        p = os.path.join(OUT, n + ".geojson")
        s2[n] = len(json.load(open(p))["features"]) if os.path.exists(p) else None
    json.dump(s2, open(os.path.join(OUT, "_podsumowanie2.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("Razem warstwy 2:", json.dumps(s2, ensure_ascii=False))

if __name__ == "__main__":
    run()
