#!/usr/bin/env python3
"""Pobiera sieć pieszą/drogową OSM Opola (highway walkable) pod routing sieciowy.
Zapisuje surowe geometrie linii do dane/siec_piesza.geojson."""
import json, os, sys
from pobierz_dane import overpass, to_geojson, save, BBOX

B = BBOX
OUT = os.path.join(os.path.dirname(__file__), "dane")
# drogi, po których chodzi pieszy (z wykluczeniem autostrad/ekspresowych)
HW = "footway|path|pedestrian|steps|living_street|residential|service|unclassified|tertiary|tertiary_link|secondary|secondary_link|primary|primary_link|track|cycleway|road"
q = f'[out:json][timeout:180];(way["highway"~"^({HW})$"]({B}););out geom;'

print("Pobieram sieć pieszą (to może chwilę potrwać)...")
osm = overpass(q, tries=6)
fc = to_geojson(osm)
# zostaw tylko linie + minimalne tagi (highway, foot, bicycle) by zmniejszyć rozmiar
slim = {"type":"FeatureCollection","features":[]}
for f in fc["features"]:
    if f["geometry"]["type"] != "LineString": continue
    p = f.get("properties",{})
    slim["features"].append({"type":"Feature",
        "properties":{"highway":p.get("highway"),"foot":p.get("foot"),"bicycle":p.get("bicycle"),
                      "name":p.get("name")},
        "geometry":f["geometry"]})
save("siec_piesza", slim)
print(f"Sieć: {len(slim['features'])} odcinków")
