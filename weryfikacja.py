#!/usr/bin/env python3
"""
WALIDACJA danych o zieleni — porównanie 3 niezależnych źródeł:
  1. OSM (zmapowana zieleń)            — co zmapowali ludzie
  2. ESA WorldCover / satelita        — co faktycznie rośnie (Sentinel)
  3. Plan Ogólny UM Opole (strefy SN) — co miasto OFICJALNIE przeznacza na zieleń/rekreację
Odpowiada na pytania:
  - Czy oficjalne strefy zieleni (SN) są faktycznie zielone? (satelita w SN)
  - Czy faktyczna zieleń jest objęta strefą zieleni/otwartą? (chroniona planem)
  - Gdzie 3 źródła się rozjeżdżają (błędy/luki każdego z nich)?
Źródła: OSM (ODbL), ESA WorldCover 2021, Plan Ogólny m. Opola (obowiązuje od 28.11.2025).
"""
import json, math, os
import numpy as np
import rasterio
from rasterio.features import rasterize

D = os.path.join(os.path.dirname(__file__), "dane")
LAT0 = 50.67; MLAT = 111320.0; MLON = 111320.0*math.cos(math.radians(LAT0))
VEG = [10,20,30,90,100]   # roślinność rekreacyjna (drzewa, krzewy, trawy, mokradła, mchy) — bez upraw(40)

def load(n): return json.load(open(os.path.join(D,n+".geojson"),encoding="utf-8"))

print("Wczytuję raster WorldCover i strefy...")
with rasterio.open(os.path.join(D,"worldcover_opole.tif")) as ds:
    arr = ds.read(1); wt = ds.transform
H,W = arr.shape
pix_m2 = abs(wt.a)*MLON * abs(wt.e)*MLAT   # pole piksela w m²

strefy = load("strefy_planistyczne")
dz = load("dzielnice")

def shapes_for(symbols):
    return [(f["geometry"],1) for f in strefy["features"] if f["properties"].get("symbol") in symbols]

sn_ras = rasterize(shapes_for({"SN"}), out_shape=(H,W), transform=wt, fill=0, dtype="uint8").astype(bool)
so_ras = rasterize(shapes_for({"SO"}), out_shape=(H,W), transform=wt, fill=0, dtype="uint8").astype(bool)
sc_ras = rasterize(shapes_for({"SC"}), out_shape=(H,W), transform=wt, fill=0, dtype="uint8").astype(bool)
green_zone = sn_ras | so_ras | sc_ras   # strefy z funkcją zieleni
dist_ras = rasterize([(f["geometry"], f["properties"]["numer"]) for f in dz["features"]],
                     out_shape=(H,W), transform=wt, fill=0, dtype="int32")
city = dist_ras > 0
veg = np.isin(arr, VEG)

def ha(mask): return round(float(mask.sum())*pix_m2/1e4)
def pct(num, den):
    d=float(den.sum()); return round(100*float(num.sum())/d,1) if d else None

# ---- miasto ----
glob = {
  "strefa_SN_ha": ha(sn_ras & city),
  "strefa_SN_proc_miasta": pct(sn_ras & city, city),
  "strefa_otwarta_SO_ha": ha(so_ras & city),
  "satelita_zielen_ha": ha(veg & city),
  "satelita_zielen_proc": pct(veg & city, city),
  # KLUCZOWE walidacje:
  "SN_faktycznie_zielone_proc": pct(veg & sn_ras & city, sn_ras & city),   # ile SN to realna roślinność
  "zielen_w_strefach_zieleni_proc": pct(veg & green_zone & city, veg & city), # ile faktycznej zieleni jest w SN/SO/SC
  "zielen_poza_strefami_proc": pct(veg & ~green_zone & city, veg & city),   # zieleń NIEobjęta strefą (ryzyko)
}

# ---- per dzielnica: 3 źródła ----
osm_green = {f["properties"]["numer"]: f["properties"].get("zielen_proc_powierzchni")
             for f in load("dzielnice_wskazniki")["features"]}
sat_green = {}
try:
    for d in json.load(open(os.path.join(D,"worldcover_dzielnice.json"),encoding="utf-8"))["dzielnice"]:
        sat_green[d["numer"]] = d.get("sat_zielen_proc")
except Exception: pass

per=[]
for f in dz["features"]:
    n=f["properties"]["numer"]; nazwa=f["properties"]["nazwa"]
    sel = dist_ras==n; tot=float(sel.sum())
    if tot==0: continue
    sn_p = pct(sn_ras & sel, sel)
    # satelita liczona z RASTRA (spójnie z metryką "poza strefami"), nie z innego pliku
    sat_p = pct(veg & sel, sel)
    osm_p = osm_green.get(n)
    sn_veg = pct(veg & sn_ras & sel, sn_ras & sel)
    # POPRAWKA (audyt): poprawna metryka — % powierzchni dzielnicy to zieleń POZA WSZYSTKIMI strefami
    # zieleni (SN+SO+SC). Wcześniejsze sat%−SN% mieszało wymiary i ignorowało SO/SC.
    veg_poza = pct(veg & ~green_zone & sel, sel)
    veg_chron = pct(veg & green_zone & sel, veg & sel)  # ile faktycznej zieleni jest objęte strefą (chronione)
    per.append({"numer":n,"nazwa":nazwa,
        "plan_SN_proc":sn_p,            # oficjalna strefa zieleni SN (% powierzchni dzielnicy)
        "satelita_zielen_proc":sat_p,   # faktyczna zieleń satelitarna (% powierzchni dzielnicy)
        "osm_zielen_proc":osm_p,        # zmapowana zieleń OSM (% powierzchni)
        "SN_faktycznie_zielone_proc":sn_veg,        # ile strefy SN to realna zieleń
        "zielen_chroniona_proc":veg_chron,          # % faktycznej zieleni objętej strefą zieleni/otwartą
        "zielen_poza_strefami_proc":veg_poza})      # % POWIERZCHNI dzielnicy = zieleń poza strefami (niechroniona)

out={"globalne":glob,"dzielnice":per,
     "zrodla":{"plan":"Plan Ogólny m. Opola, strefy planistyczne (obowiązuje 28.11.2025)",
               "satelita":"ESA WorldCover 10 m 2021","osm":"OpenStreetMap"},
     "uwaga":"Strefa SN = OFICJALNE PRZEZNACZENIE na zieleń/rekreację (nie pomiar pokrycia). "
             "Satelita/OSM = FAKTYCZNE pokrycie. Rozbieżności wskazują: zieleń niechronioną planem "
             "lub strefy zieleni jeszcze niezagospodarowane."}
json.dump(out, open(os.path.join(D,"weryfikacja_zielen.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=2)

# warstwa map: tylko strefy zieleni (SN+SO+SC) — lżejsza
zielen_plan={"type":"FeatureCollection","features":[
    {"type":"Feature","properties":{"symbol":f["properties"]["symbol"],"nazwa":f["properties"].get("nazwa"),
        "oznaczenie":f["properties"].get("oznaczenie"),
        "min_bio_czynna_proc":f["properties"].get("minudzialpowierzchnibiologicznieczynnej")},
     "geometry":f["geometry"]}
    for f in strefy["features"] if f["properties"].get("symbol") in ("SN","SO","SC")]}
json.dump(zielen_plan, open(os.path.join(D,"strefy_zieleni_plan.geojson"),"w",encoding="utf-8"),ensure_ascii=False)

print("\n=== WALIDACJA ZIELENI: 3 ŹRÓDŁA ===")
print(json.dumps(glob, ensure_ascii=False, indent=2))
print("\nPer dzielnica: plan SN% | satelita% | OSM% | SN faktycznie zielone% | zieleń poza strefami(% pow.)")
for r in sorted(per, key=lambda x:-(x['zielen_poza_strefami_proc'] or -99)):
    print(f"  {str(r['numer']):>4} {str(r['nazwa'])[:6]:6} | plan {str(r['plan_SN_proc']):>5} | sat {str(r['satelita_zielen_proc']):>5} | "
          f"osm {str(r['osm_zielen_proc']):>5} | SN-ziel {str(r['SN_faktycznie_zielone_proc']):>5} | pozastref {str(r['zielen_poza_strefami_proc']):>6}")
