#!/usr/bin/env python3
"""Pobieracz #4: infrastruktura piesza/rowerowa, zieleń uzupełniająca, komfort."""
import json, time, sys, os
from pobierz_dane import overpass, to_geojson, save, BBOX
from pobierz_dane2 import centroidize
B = BBOX
OUT = os.path.join(os.path.dirname(__file__), "dane")

JOBS = [
    ("sciezki_rowerowe", f'(way["highway"="cycleway"]({B});way["bicycle"="designated"]["highway"="path"]({B});way["cycleway"~"track|lane"]({B}););', False),
    ("dzialki_ogrody", f'(way["landuse"="allotments"]({B});relation["landuse"="allotments"]({B}););', True),
    ("cmentarze", f'(way["landuse"="cemetery"]({B});way["amenity"="grave_yard"]({B}););', True),
    ("komfort", f'(node["amenity"="bench"]({B});node["amenity"="drinking_water"]({B});node["amenity"="shelter"]({B});node["leisure"="picnic_table"]({B});node["amenity"="fountain"]({B}););', False),
    ("chodniki_piesze", f'(way["highway"="footway"]({B});way["highway"="pedestrian"]({B}););', False),
]

def main():
    counts = {}
    for name, body, cent in JOBS:
        if os.path.exists(os.path.join(OUT, name + ".geojson")):
            print(f"[{name}] już jest"); continue
        print(f"[{name}] pobieram...")
        out = "out center;" if cent else "out geom;"
        q = f"[out:json][timeout:90];({body});{out}"
        try:
            osm = overpass(q, tries=6)
            if cent:
                for el in osm.get("elements", []):
                    if el.get("type")=="way" and "center" in el and "geometry" not in el:
                        el["type"]="node"; el["lat"]=el["center"]["lat"]; el["lon"]=el["center"]["lon"]
            fc = to_geojson(osm)
            if cent: fc = centroidize(fc)
            counts[name] = save(name, fc)
        except Exception as e:
            print(f"  !! {name}: {e}", file=sys.stderr); counts[name]=None
        time.sleep(5)
    json.dump(counts, open(os.path.join(OUT,"_podsumowanie4.json"),"w",encoding="utf-8"), ensure_ascii=False, indent=2)
    print("Razem4:", json.dumps(counts, ensure_ascii=False))

if __name__ == "__main__":
    main()
