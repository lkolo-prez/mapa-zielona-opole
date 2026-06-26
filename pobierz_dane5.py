#!/usr/bin/env python3
"""Pobieracz #5: służby, przemysł, siłownie, maszty telekom, energetyka, atrakcje, ochrona przyrody."""
import json, time, sys, os
from pobierz_dane import overpass, to_geojson, save, BBOX
from pobierz_dane2 import centroidize
B = BBOX
OUT = os.path.join(os.path.dirname(__file__), "dane")

JOBS = [
    ("sluzby", f'(node["amenity"~"fire_station|police|hospital|ambulance_station"]({B});way["amenity"~"fire_station|police|hospital"]({B}););', True),
    ("silownie_zewn", f'(node["leisure"="fitness_station"]({B});way["leisure"="fitness_station"]({B}););', True),
    ("silownie_wewn", f'(node["leisure"="fitness_centre"]({B});way["leisure"="fitness_centre"]({B});node["sport"="fitness"]({B}););', True),
    ("przemysl", f'(way["landuse"="industrial"]({B});way["building"~"industrial|warehouse"]({B});way["man_made"="works"]({B});relation["landuse"="industrial"]({B}););', True),
    ("maszty_telekom", f'(node["man_made"~"mast|tower"]["tower:type"="communication"]({B});node["tower:type"="communication"]({B});node["communication:mobile_phone"="yes"]({B});way["man_made"="tower"]["tower:type"="communication"]({B}););', True),
    ("energetyka", f'(node["power"~"tower|substation|transformer"]({B});way["power"="substation"]({B});way["power"="line"]({B});way["power"="minor_line"]({B}););', False),
    ("atrakcje", f'(node["tourism"~"attraction|artwork|viewpoint|theme_park|zoo|gallery"]({B});way["tourism"~"attraction|theme_park|zoo"]({B}););', True),
    ("centra_handlowe", f'(node["shop"~"mall|department_store"]({B});way["shop"~"mall|department_store"]({B});node["amenity"="marketplace"]({B}););', True),
    ("ochrona_przyrody", f'(way["boundary"="protected_area"]({B});relation["boundary"="protected_area"]({B});way["leisure"="nature_reserve"]({B});relation["leisure"="nature_reserve"]({B}););', True),
    ("waly_przeciwpow", f'(way["man_made"="dyke"]({B});way["man_made"="embankment"]({B});way["embankment"="yes"]({B}););', False),
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
    json.dump(counts, open(os.path.join(OUT,"_podsumowanie5.json"),"w",encoding="utf-8"), ensure_ascii=False, indent=2)
    print("Razem5:", json.dumps(counts, ensure_ascii=False))

if __name__ == "__main__":
    main()
