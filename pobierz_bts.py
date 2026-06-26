#!/usr/bin/env python3
"""
Nadajniki / stacje bazowe (BTS) wszystkich operatorów w Opolu.
Źródło: SI2PEM — System Informacyjny o instalacjach wytwarzających pole elektromagnetyczne
(si2pem.gov.pl, dane rządowe; operatorzy mają obowiązek rejestracji). Filtr: venue_city=Opole
+ inkorporowane miejscowości (dzielnice). Dane publiczne.
"""
import json, os, time, urllib.request, urllib.parse, collections

OUT = os.path.join(os.path.dirname(__file__), "dane")
BASE = "https://si2pem.gov.pl/api/installations/?venue_city="
# Opole + miejscowości włączone w granice miasta (osobne nazwy w adresach)
CITIES = ["Opole","Czarnowąsy","Borki","Brzezie","Groszowice","Grotowice","Grudzice",
          "Gosławice","Kolonia Gosławicka","Krzanowice","Malina","Półwieś","Sławice",
          "Świerkle","Winów","Wrzoski","Wróblin","Wójtowa Wieś","Zakrzów","Żerkowice",
          "Bierkowice","Chmielowice","Dobrzeń Mały","Szczepanowice"]

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent":"opole-strategia/1.0","Accept":"application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

stations = {}   # base_station.id -> rekord
for city in CITIES:
    url = BASE + urllib.parse.quote(city)
    n0 = len(stations)
    page = 0
    while url and page < 20:
        try:
            d = fetch(url)
        except Exception as e:
            print(f"  ! {city}: {e}"); break
        for it in d.get("results", []):
            bs = it.get("base_station") or {}
            sid = bs.get("id")
            if sid is None: continue
            try: lat=float(bs["latitude"]); lon=float(bs["longitude"])
            except Exception: continue
            stations[sid] = {"operator": bs.get("operator") or it.get("entity"),
                             "nazwa": bs.get("identity_name"), "adres": bs.get("address"),
                             "miasto": bs.get("venue_city") or city, "lat":lat, "lon":lon}
        url = d.get("next"); page += 1; time.sleep(0.3)
    got = len(stations)-n0
    if got: print(f"  {city}: +{got}")

feats = [{"type":"Feature",
          "properties":{"operator":s["operator"],"nazwa":s["nazwa"],"adres":s["adres"],"miasto":s["miasto"]},
          "geometry":{"type":"Point","coordinates":[round(s["lon"],6),round(s["lat"],6)]}}
         for s in stations.values()]
fc = {"type":"FeatureCollection","features":feats}
json.dump(fc, open(os.path.join(OUT,"bts_nadajniki.geojson"),"w",encoding="utf-8"), ensure_ascii=False)

ops = collections.Counter(s["operator"] for s in stations.values())
print(f"\nRazem stacji bazowych: {len(stations)}")
for op,c in ops.most_common(): print(f"  {op}: {c}")
