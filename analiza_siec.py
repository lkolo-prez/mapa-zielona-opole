#!/usr/bin/env python3
"""
Analiza SIECIOWA (po rzeczywistej sieci pieszej) — poprawia dystanse liczone w linii prostej.
- dystans po drogach do każdej kategorii (zieleń, żłobek/przedszkole/szkoły, sklep, apteka, przystanek, sport)
- współczynnik nadłożenia = dystans_sieciowy / dystans_w_linii (efekt barier: rzeka, tory)
- izochrony pieszo (5/10/15 min) z kluczowych punktów miasta
- agregacja per dzielnica + porównanie z metodą prostą
Prędkość pieszego: 4,8 km/h = 80 m/min.
"""
import json, math, os
from router import load_graph, to_m, to_lonlat

D = os.path.join(os.path.dirname(__file__), "dane")
WALK = 80.0  # m/min

def load(n):
    p = os.path.join(D, n + ".geojson"); return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"features": []}
def rings_of(f):
    g=f.get("geometry") or {}; t=g.get("type"); c=g.get("coordinates"); o=[]
    if t=="Polygon" and c: o.append(c[0])
    elif t=="MultiPolygon" and c:
        for poly in c:
            if poly: o.append(poly[0])
    return o
def feat_pt_m(f):
    g=f.get("geometry") or {}; t=g.get("type"); c=g.get("coordinates")
    if t=="Point": return to_m(*c)
    r=None
    if t=="Polygon" and c: r=c[0]
    elif t=="MultiPolygon" and c and c[0]: r=c[0][0]
    elif t=="LineString" and c: r=c
    if r: return to_m(sum(p[0] for p in r)/len(r), sum(p[1] for p in r)/len(r))
    return None
def feat_rings_m(f): return [[to_m(lon,lat) for lon,lat in r] for r in rings_of(f)]
def pip(x,y,ring):
    ins=False;n=len(ring);j=n-1
    for i in range(n):
        xi,yi=ring[i];xj,yj=ring[j]
        if ((yi>y)!=(yj>y)) and (x<(xj-xi)*(y-yi)/((yj-yi) or 1e-12)+xi): ins=not ins
        j=i
    return ins
def pip_any(x,y,rs): return any(pip(x,y,r) for r in rs)

print("Buduję graf sieci pieszej...")
G = load_graph(D)
print("  ", G.stats())

def cat_points(name_or_feats):
    feats = name_or_feats["features"] if isinstance(name_or_feats, dict) else name_or_feats
    return [p for p in (feat_pt_m(f) for f in feats) if p]

# zieleń: centroidy parków + zieleni urządzonej + place zabaw (punkty wejścia)
green=[]
for lay in ("parki","zielen_pozostala","place_zabaw"):
    for f in load(lay)["features"]:
        p=feat_pt_m(f)
        if p: green.append(p)

CATS = {
    "zielen": green,
    "zlobek": cat_points(load("zlobki")),
    "przedszkole": cat_points(load("przedszkola")),
    "podstawowa": cat_points(load("szkoly_podstawowe")),
    "srednia": cat_points(load("szkoly_srednie")),
    "wyzsza": cat_points(load("szkoly_wyzsze")),
    "sklep": cat_points(load("sklepy_spozywcze")),
    "zdrowie": cat_points(load("zdrowie")),
    "przystanek": cat_points(load("przystanki_bus")),
    "sport": cat_points(load("boiska_sport")),
}

print("Liczę pola dystansu sieciowego (multi-source Dijkstra)...")
fields = {}   # cat -> dist dict (node->m)
for k, pts in CATS.items():
    sources = []
    for (x, y) in pts:
        nid, snap = G.nearest_node(x, y)
        if nid is not None: sources.append((nid, snap))
    fields[k] = G.dijkstra(sources, maxdist=4000)
    print(f"  {k}: {len(pts)} POI -> pole {len(fields[k])} węzłów")

# prosta odległość (hash) do porównania
class H:
    def __init__(s,pts,c=400.0):
        s.c=c;s.h={}
        for (x,y) in pts: s.h.setdefault((int(x//c),int(y//c)),[]).append((x,y))
    def near(s,x,y,maxr=4000):
        c=s.c;cx,cy=int(x//c),int(y//c);best=1e18;rad=0
        while rad*c<=maxr+c:
            for ix in range(cx-rad,cx+rad+1):
                for iy in range(cy-rad,cy+rad+1):
                    if rad>0 and abs(ix-cx)!=rad and abs(iy-cy)!=rad: continue
                    for (px,py) in s.h.get((ix,iy),()):
                        dd=(px-x)**2+(py-y)**2
                        if dd<best:best=dd
            if best<1e17 and rad>=1: break
            rad+=1
        return math.sqrt(best) if best<1e17 else None
straight = {k: H(p) for k, p in CATS.items() if p}

# dzielnice
districts=[]
for f in load("dzielnice")["features"]:
    rm=feat_rings_m(f)
    if not rm: continue
    xs=[p[0] for r in rm for p in r];ys=[p[1] for r in rm for p in r]
    districts.append({"numer":f["properties"].get("numer"),"nazwa":f["properties"].get("nazwa"),
        "rings":rm,"bbox":(min(xs),min(ys),max(xs),max(ys)),"net":{k:[] for k in CATS}})
def find_d(x,y):
    for d in districts:
        b=d["bbox"]
        if b[0]<=x<=b[2] and b[1]<=y<=b[3] and pip_any(x,y,d["rings"]): return d
    return None

print("Siatka mieszkaniowa: dystans sieciowy vs prosty...")
STEP=120.0
# przechowujemy per-punkt dla każdej kategorii: net (lub None = nieosiągalny w 4 km), straight
pt_net={k:[] for k in CATS}; pt_str={k:[] for k in CATS}
grid=[]; samples=0
for f in load("mieszkaniowe")["features"]:
    rm=feat_rings_m(f)
    if not rm: continue
    pp=[p for r in rm for p in r]
    bx0=min(p[0] for p in pp);by0=min(p[1] for p in pp);bx1=max(p[0] for p in pp);by1=max(p[1] for p in pp)
    x=bx0
    while x<=bx1:
        y=by0
        while y<=by1:
            if pip_any(x,y,rm) and find_d(x,y):   # tylko w granicach miasta
                samples+=1
                nid,snap=G.nearest_node(x,y)
                props={}; dist=find_d(x,y)
                for k in CATS:
                    net = (fields[k].get(nid,None) if nid is not None else None)
                    net = (net+(snap or 0)) if net is not None else None
                    st = straight[k].near(x,y) if k in straight else None
                    pt_net[k].append(net); pt_str[k].append(st)
                    if dist: dist["net"][k].append(net)   # None też wędruje (liczone jako nieosiągalny)
                    props["n_"+k]= round(net) if net is not None else None
                props["min_zielen"]= round(props["n_zielen"]/WALK,1) if props.get("n_zielen") is not None else None
                lon,lat=to_lonlat(x,y)
                grid.append({"type":"Feature","properties":props,"geometry":{"type":"Point","coordinates":[round(lon,6),round(lat,6)]}})
            y+=STEP
        x+=STEP
print(f"  próbek: {samples}")

def med(l):
    s=sorted([v for v in l if v is not None])
    if not s: return None
    n=len(s);return round(s[n//2] if n%2 else (s[n//2-1]+s[n//2])/2)
def within_all(vals,t):
    # None = nieosiągalny => NIE w zasięgu; mianownik = wszystkie próbki
    if not vals: return None
    return round(100*sum(1 for v in vals if v is not None and v<=t)/len(vals),1)
def coverage(vals):
    return round(100*sum(1 for v in vals if v is not None)/len(vals),1) if vals else None
def pctl(l,p):
    s=sorted(l);
    if not s: return None
    return s[min(len(s)-1,int(p*len(s)))]

# współczynnik nadłożenia: tylko gdy oba dostępne i prosta>300 m (sensowna trasa)
det=[]
for k in CATS:
    for net,st in zip(pt_net[k],pt_str[k]):
        if net is not None and st and st>300: det.append(net/st)

summary={"probek":samples,"predkosc_m_min":WALK,
    "siec_mediana_m":{k:med(pt_net[k]) for k in CATS},
    "siec_w_15min_proc":{k:within_all(pt_net[k],1200) for k in CATS},   # 1200 m = 15 min
    "siec_w_10min_proc":{k:within_all(pt_net[k],800) for k in CATS},
    "osiagalnosc_4km_proc":{k:coverage(pt_net[k]) for k in CATS},
    # prosta_mediana liczona na DOKŁADNIE tych samych punktach co siec_mediana (net!=None) — bezpośrednio porównywalne
    "prosta_mediana_m":{k:med([s for s,n in zip(pt_str[k],pt_net[k]) if n is not None]) for k in CATS},
    # UWAGA (audyt #1): współczynnik nadłożenia to ODDZIELNY diagnostyk liczony na trasach >300 m
    # (krótkie trasy zawyżają iloraz). NIE należy mnożyć prosta_mediana × nadłożenie, by uzyskać sieć.
    "wsp_nadlozenia_srednia": round(sum(det)/len(det),2) if det else None,
    "wsp_nadlozenia_p90": round(pctl(det,0.9),2) if det else None,
    "wsp_nadlozenia_uwaga": "iloraz sieć/prosta dla tras >300 m; oddzielny od median",
}
summary["siec_mediana_min"]={k:(round(summary["siec_mediana_m"][k]/WALK,1) if summary["siec_mediana_m"][k] is not None else None) for k in CATS}
summary["dzielnice"]=[{"numer":d["numer"],"nazwa":d["nazwa"],
    **{f"med_{k}":med(d["net"][k]) for k in CATS},
    **{f"w15_{k}":within_all(d["net"][k],1200) for k in CATS}} for d in districts]
json.dump(summary, open(os.path.join(D,"dostepnosc_siec.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=2)
json.dump({"type":"FeatureCollection","features":grid},
          open(os.path.join(D,"dostepnosc_siec.geojson"),"w",encoding="utf-8"),ensure_ascii=False)

# ----- IZOCHRONY z kluczowych punktów -----
print("Liczę izochrony pieszo (5/10/15 min) z kluczowych punktów...")
LANDMARKS = {
    "Rynek (centrum)": (17.9236, 50.6668),
    "Dworzec Główny": (17.9347, 50.6536),
    "Uniwersytet Opolski": (17.9210, 50.6720),
}
iso_feats=[]
for name,(lon,lat) in LANDMARKS.items():
    x,y=to_m(lon,lat); nid,snap=G.nearest_node(x,y)
    if nid is None: continue
    dist=G.dijkstra([(nid,snap or 0.0)], maxdist=1300)  # #10: uwzględnij dojście do węzła
    # siatka 60 m wokół, minuty do najbliższego węzła
    cell=60.0
    seen=set()
    for n2,dm in dist.items():
        nx,ny=G.xy[n2]
        gx,gy=int(nx//cell),int(ny//cell)
        key=(gx,gy)
        if key in seen: continue
        seen.add(key)
        mins=dm/WALK
        band=5 if mins<=5 else 10 if mins<=10 else 15 if mins<=15 else None
        if band is None: continue
        clon,clat=to_lonlat(gx*cell+cell/2, gy*cell+cell/2)
        iso_feats.append({"type":"Feature","properties":{"punkt":name,"minuty_band":band,"min":round(mins,1)},
                          "geometry":{"type":"Point","coordinates":[round(clon,6),round(clat,6)]}})
json.dump({"type":"FeatureCollection","features":iso_feats},
          open(os.path.join(D,"izochrony.geojson"),"w",encoding="utf-8"),ensure_ascii=False)
print(f"  izochrony: {len(iso_feats)} komórek dla {len(LANDMARKS)} punktów")

print("\n=== DOSTĘPNOŚĆ SIECIOWA vs PROSTA (mediana, ten sam podzbiór) ===")
for k in CATS:
    print(f"  {k:12} sieć {str(summary['siec_mediana_m'][k]):>5} m ({summary['siec_mediana_min'][k]} min) | "
          f"prosta {str(summary['prosta_mediana_m'][k]):>5} m | w 15 min {summary['siec_w_15min_proc'][k]}% | "
          f"osiągalność≤4km {summary['osiagalnosc_4km_proc'][k]}%")
print(f"\nWspółczynnik nadłożenia sieć/prosta — średnia {summary['wsp_nadlozenia_srednia']}x, "
      f"p90 {summary['wsp_nadlozenia_p90']}x (gdzie bariery jak Odra/tory wydłużają drogę).")
