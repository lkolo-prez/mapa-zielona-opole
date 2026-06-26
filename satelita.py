#!/usr/bin/env python3
"""
DRUGI, NIEZALEŻNY ZBIÓR ZIELENI — z danych satelitarnych.
Źródło: ESA WorldCover 10 m v200 (2021) — klasyfikacja pokrycia terenu z satelitów
Sentinel-1/2 (© ESA WorldCover project / Contains modified Copernicus Sentinel data).
Odczyt okienkowy bezpośrednio z chmurowego COG na AWS S3 (tylko wycinek Opola).

Wynik:
  dane/worldcover_opole.tif       — wycinek klas dla Opola (zapis kontrolny)
  dane/worldcover_green.png       — nakładka roślinności (do L.imageOverlay)
  dane/worldcover_bounds.json     — granice nakładki + legenda klas
  dane/worldcover_dzielnice.json  — % pokrycia klas per dzielnica + porównanie z OSM
"""
import os, json
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.features import rasterize
from PIL import Image

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")

D = os.path.dirname(__file__)
DANE = os.path.join(D, "dane")
COG = "/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N48E015_Map.tif"
BBOX = (17.77, 50.58, 18.04, 50.77)  # W,S,E,N — Opole

# Klasy ESA WorldCover
CLASSES = {10:"Drzewa (las/zadrzewienia)",20:"Zarośla/krzewy",30:"Trawy/łąki",40:"Uprawy rolne",
           50:"Zabudowa/teren utwardzony",60:"Grunt odkryty",70:"Śnieg/lód",80:"Woda",
           90:"Mokradła zielne",95:"Namorzyny",100:"Mchy/porosty"}
COLORS = {10:(20,107,26),20:(143,188,77),30:(182,227,107),40:(233,215,116),
          90:(111,208,192),100:(200,220,160)}   # roślinność -> kolor; reszta przezroczysta
VEG = {10,20,30,40,90,100}            # cała roślinność
GREEN_AMENITY = {10,20,30,90,100}     # zieleń "rekreacyjna" (bez upraw rolnych)

print("Otwieram chmurowy COG ESA WorldCover (vsicurl)...")
with rasterio.open(COG) as ds:
    win = from_bounds(*BBOX, transform=ds.transform)
    arr = ds.read(1, window=win)
    wt = ds.window_transform(win)
    print(f"  wycinek: {arr.shape} px, CRS {ds.crs}")
    # zapis kontrolny TIF
    prof = ds.profile.copy()
    prof.update(height=arr.shape[0], width=arr.shape[1], transform=wt,
                compress="deflate", count=1)
    with rasterio.open(os.path.join(DANE, "worldcover_opole.tif"), "w", **prof) as dst:
        dst.write(arr, 1)

H, W = arr.shape
left, top = wt.c, wt.f
right = left + W * wt.a
bottom = top + H * wt.e  # wt.e ujemne
bounds = {"south": min(top, bottom), "north": max(top, bottom),
          "west": left, "east": right}

# --- nakładka PNG (roślinność) ---
rgba = np.zeros((H, W, 4), dtype=np.uint8)
for cls, col in COLORS.items():
    m = arr == cls
    rgba[m, 0] = col[0]; rgba[m, 1] = col[1]; rgba[m, 2] = col[2]
    rgba[m, 3] = 200 if cls in (10,) else 165 if cls in (20,30,90,100) else 120
Image.fromarray(rgba, "RGBA").save(os.path.join(DANE, "worldcover_green.png"))
print(f"  nakładka PNG: {W}x{H}")

# --- rasteryzacja granic dzielnic (najpierw — potrzebna do maski miasta) ---
dz = json.load(open(os.path.join(DANE, "dzielnice.geojson"), encoding="utf-8"))
shapes = []
meta = []
for i, f in enumerate(dz["features"], start=1):
    shapes.append((f["geometry"], i))
    p = f["properties"]
    meta.append({"id": i, "numer": p.get("numer"), "nazwa": p.get("nazwa")})
dist_ras = rasterize(shapes, out_shape=(H, W), transform=wt, fill=0, dtype="int32")

# --- statystyki globalne TYLKO dla obszaru miasta (POPRAWKA audyt #6: bbox zawierał pola poza miastem) ---
city = dist_ras > 0
arr_c = arr[city]
total = int(arr_c.size) or 1
def pct(mask_vals): return round(100*float(mask_vals.sum())/total, 1)
glob = {"px": total,
        "drzewa_proc": pct(arr_c==10),
        "trawy_krzewy_proc": pct(np.isin(arr_c,[20,30])),
        "uprawy_proc": pct(arr_c==40),
        "roslinnosc_total_proc": pct(np.isin(arr_c, list(VEG))),
        "zielen_rekreac_proc": pct(np.isin(arr_c, list(GREEN_AMENITY))),  # #13: bez redundantnego !=40
        "zabudowa_proc": pct(arr_c==50),
        "woda_proc": pct(arr_c==80),
        "uwaga": "statystyki dla obszaru administracyjnego miasta (maska 13 dzielnic), nie prostokąta bbox"}

# OSM zieleń % powierzchni per dzielnica (z wcześniejszej analizy)
osm_green = {}
try:
    wsk = json.load(open(os.path.join(DANE, "dzielnice_wskazniki.geojson"), encoding="utf-8"))
    for f in wsk["features"]:
        osm_green[f["properties"]["numer"]] = f["properties"].get("zielen_proc_powierzchni")
except Exception:
    pass

per = []
for m in meta:
    sel = dist_ras == m["id"]
    n = int(sel.sum())
    if n == 0: continue
    a = arr[sel]
    tp = round(100*float((a==10).sum())/n,1)
    gp = round(100*float(np.isin(a,[20,30]).sum())/n,1)
    vp = round(100*float(np.isin(a,list(VEG)).sum())/n,1)
    zp = round(100*float(np.isin(a,list(GREEN_AMENITY)).sum())/n,1)
    bp = round(100*float((a==50).sum())/n,1)
    og = osm_green.get(m["numer"])
    per.append({"numer":m["numer"],"nazwa":m["nazwa"],"px":n,
                "sat_drzewa_proc":tp,"sat_trawy_krzewy_proc":gp,
                "sat_zielen_proc":zp,"sat_roslinnosc_proc":vp,"sat_zabudowa_proc":bp,
                "osm_zielen_proc":og,
                "roznica_sat_minus_osm": (round(zp-og,1) if og is not None else None)})

json.dump({"south":bounds["south"],"north":bounds["north"],"west":bounds["west"],"east":bounds["east"],
           "klasy":CLASSES,"kolory":{str(k):list(v) for k,v in COLORS.items()},
           "legenda_veg":{str(k):CLASSES[k] for k in COLORS}},
          open(os.path.join(DANE,"worldcover_bounds.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=1)
json.dump({"globalne":glob,"dzielnice":per,
           "zrodlo":"ESA WorldCover 10m v200 (2021), Sentinel-1/2; odczyt z COG AWS S3"},
          open(os.path.join(DANE,"worldcover_dzielnice.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=2)

print("\n=== SATELITA (ESA WorldCover 10 m) — całe Opole ===")
print(json.dumps(glob, ensure_ascii=False, indent=2))
print("\nPorównanie pokrycia zielenią: SATELITA vs OSM (% powierzchni dzielnicy)")
print(f"{'Dz':>4} {'nazwa':6} {'sat_zieleń':>10} {'sat_drzewa':>10} {'OSM_zieleń':>10} {'różnica':>8}")
for r in sorted(per, key=lambda x:-(x['roznica_sat_minus_osm'] or 0)):
    print(f"{str(r['numer']):>4} {str(r['nazwa'])[:6]:6} {r['sat_zielen_proc']:>9}% {r['sat_drzewa_proc']:>9}% "
          f"{str(r['osm_zielen_proc']):>9}% {str(r['roznica_sat_minus_osm']):>7}")
