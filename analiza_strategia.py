#!/usr/bin/env python3
"""
Analizy strategiczne (na danych sieciowych i wszystkich warstwach):
1. Indeks deprywacji dostępności (wielodomenowy) per dzielnica — wyższy = gorszy dostęp.
2. Priorytet równości = młodzież × deprywacja.
3. Flaga pewności danych per dzielnica (gęstość sieci/POI) — gdzie wnioski mniej pewne.
4. Optymalne lokalizacje nowych żłobków i parków (greedy max-coverage) — gdzie dodać, by objąć najwięcej mieszkańców.
Źródła: analizy sieciowe + OSM + ArcGIS + satelita.
"""
import json, math, os

D = os.path.join(os.path.dirname(__file__), "dane")
def load(n):
    p=os.path.join(D,n+".geojson");
    if os.path.exists(p): return json.load(open(p,encoding="utf-8"))
    p=os.path.join(D,n+".json")
    return json.load(open(p,encoding="utf-8")) if os.path.exists(p) else None

LAT0,LON0=50.67,17.92; MLAT=111320.0; MLON=111320.0*math.cos(math.radians(LAT0))
def to_m(lon,lat): return ((lon-LON0)*MLON,(lat-LAT0)*MLAT)

def load_json(n):
    p=os.path.join(D,n+".json"); return json.load(open(p,encoding="utf-8")) if os.path.exists(p) else None
def load_geojson(n):
    p=os.path.join(D,n+".geojson"); return json.load(open(p,encoding="utf-8")) if os.path.exists(p) else {"features":[]}
siec=load_json("dostepnosc_siec"); demo=load_json("demografia"); wsk=load_geojson("dzielnice_wskazniki"); sat=load_json("worldcover_dzielnice")
grid_siec=load_geojson("dostepnosc_siec")

def dz_by_num(n,coll): return next((x for x in coll if x.get("numer")==n),None)

# ---------- 1. INDEKS DEPRYWACJI ----------
# domeny (mediana sieciowa, m -> im większa, tym gorzej): edukacja(żłobek,przedszkole,podstawowa),
# usługi(sklep,zdrowie,przystanek), sport; oraz zieleń (sat % -> im mniej, tym gorzej).
nums=[d["numer"] for d in siec["dzielnice"]]
def col(key): return [dz_by_num(n,siec["dzielnice"]).get(key) for n in nums]
def norm(vals, invert=False):
    v=[x for x in vals if x is not None]
    if not v: return [None]*len(vals)
    mn,mx=min(v),max(v)
    out=[]
    for x in vals:
        if x is None: out.append(None); continue
        t=0.5 if mx<=mn else (x-mn)/(mx-mn)
        out.append(1-t if invert else t)
    return out

# POPRAWKA (audyt): None = placówka nieosiągalna w 4 km => to NAJGORSZY dostęp, nie 0 m.
# Traktujemy brak jako karę = PEN (≥ maxdist sieci), żeby deprywacja rosła, a nie malała.
PEN = 4000.0
def pen(v): return v if v is not None else PEN
dom_edu = [ (pen(a)+pen(b)+pen(c))/3 for a,b,c in zip(col("med_zlobek"),col("med_przedszkole"),col("med_podstawowa")) ]
dom_usl = [ (pen(a)+pen(b)+pen(c))/3 for a,b,c in zip(col("med_sklep"),col("med_zdrowie"),col("med_przystanek")) ]
dom_sport = [ pen(v) for v in col("med_sport") ]
sat_green = [ (dz_by_num(n,sat["dzielnice"]) or {}).get("sat_zielen_proc") for n in nums ]

n_edu=norm(dom_edu); n_usl=norm(dom_usl); n_sport=norm(dom_sport); n_green=norm(sat_green,invert=True)
# deprywacja 0-100 (średnia domen, wyższa = gorszy dostęp)
indeks=[]
for i,n in enumerate(nums):
    parts=[x for x in (n_edu[i],n_usl[i],n_sport[i],n_green[i]) if x is not None]
    depr = round(100*sum(parts)/len(parts)) if parts else None
    d=dz_by_num(n,siec["dzielnice"])
    dd=dz_by_num(n,demo["dzielnice"]) if demo else None
    youth = dd["mlodziez_proc"][9] if (dd and dd.get("mlodziez_proc")) else None
    indeks.append({"numer":n,"nazwa":d["nazwa"],"deprywacja":depr,
                   "dom_edukacja":round(100*n_edu[i]) if n_edu[i] is not None else None,
                   "dom_uslugi":round(100*n_usl[i]) if n_usl[i] is not None else None,
                   "dom_sport":round(100*n_sport[i]) if n_sport[i] is not None else None,
                   "dom_zielen":round(100*n_green[i]) if n_green[i] is not None else None,
                   "mlodziez_proc":youth})
# priorytet równości = deprywacja * udział młodzieży (znormalizowany)
yv=[x["mlodziez_proc"] for x in indeks if x["mlodziez_proc"] is not None]
ymn,ymx=(min(yv),max(yv)) if yv else (0,1)
for x in indeks:
    if x["deprywacja"] is not None and x["mlodziez_proc"] is not None:
        yn=(x["mlodziez_proc"]-ymn)/((ymx-ymn) or 1)
        x["priorytet_rownosci"]=round(x["deprywacja"]*(0.5+0.5*yn))  # waży młodzieżą
    else:
        x["priorytet_rownosci"]=None

# ---------- 3. FLAGA PEWNOŚCI DANYCH ----------
# gęstość sieci pieszej i POI per dzielnica -> niska gęstość = mniejsza pewność
# liczymy długość sieci i liczbę węzłów grid_siec w dzielnicy (przybliżenie po bbox+pip)
def rings_of(f):
    g=f["geometry"];t=g["type"];c=g["coordinates"];o=[]
    if t=="Polygon": o.append(c[0])
    elif t=="MultiPolygon":
        for poly in c: o.append(poly[0])
    return o
def feat_rings_m(f): return [[to_m(lon,lat) for lon,lat in r] for r in rings_of(f)]
def pip(x,y,r):
    ins=False;n=len(r);j=n-1
    for i in range(n):
        xi,yi=r[i];xj,yj=r[j]
        if ((yi>y)!=(yj>y)) and (x<(xj-xi)*(y-yi)/((yj-yi) or 1e-12)+xi): ins=not ins
        j=i
    return ins
def pip_any(x,y,rs): return any(pip(x,y,r) for r in rs)
dzfeat={f["properties"]["numer"]:f for f in wsk["features"]}
# liczba próbek grid w dzielnicy + nieosiągalne (None) -> jeśli dużo None, mniejsza pewność
gridpts=[(to_m(*g["geometry"]["coordinates"]),g["properties"]) for g in grid_siec["features"]] if grid_siec.get("features") else []
for x in indeks:
    f=dzfeat.get(x["numer"]);
    if not f: x["pewnosc"]="—"; continue
    rm=feat_rings_m(f); xs=[p[0] for r in rm for p in r];ys=[p[1] for r in rm for p in r]
    bb=(min(xs),min(ys),max(xs),max(ys))
    ins=[pr for (pt,pr) in gridpts if bb[0]<=pt[0]<=bb[2] and bb[1]<=pt[1]<=bb[3] and pip_any(pt[0],pt[1],rm)]
    if not ins: x["pewnosc"]="niska (brak próbek mieszkaniowych)"; continue
    # POPRAWKA (audyt): agreguj braki po WSZYSTKICH typach POI, nie tylko przedszkolach
    poi_fields=["n_zlobek","n_przedszkole","n_podstawowa","n_sklep","n_zdrowie","n_przystanek","n_sport"]
    tot=len(ins)*len(poi_fields)
    none_cnt=sum(1 for pr in ins for f in poi_fields if pr.get(f) is None)
    none_share=none_cnt/tot if tot else 1
    x["pewnosc"]= "wysoka" if none_share<0.2 else "średnia" if none_share<0.5 else "niska (rzadka sieć/POI)"
    x["probek_mieszk"]=len(ins)

# ---------- 4. OPTYMALNE LOKALIZACJE (greedy max-coverage) ----------
def existing_points(name):
    fc=load(name); out=[]
    for f in (fc or {}).get("features",[]):
        g=f.get("geometry") or {}
        if g.get("type")=="Point": out.append(to_m(*g["coordinates"]))
        else:
            rs=rings_of(f) if g.get("type") in ("Polygon","MultiPolygon") else []
            if rs: out.append(to_m(sum(p[0] for p in rs[0])/len(rs[0]),sum(p[1] for p in rs[0])/len(rs[0])))
    return out

# POPRAWKA (audyt #3): realne ważenie popytu udziałem młodzieży dzielnicy.
# Przypisujemy każdy punkt mieszkaniowy do dzielnicy i nadajemy wagę = udział młodzieży (0–17).
dz_geo=[]
for n,f in dzfeat.items():
    rm=feat_rings_m(f); xs=[p[0] for r in rm for p in r];ys=[p[1] for r in rm for p in r]
    dd=dz_by_num(n,demo["dzielnice"]) if demo else None
    youth=dd["mlodziez_proc"][9] if (dd and dd.get("mlodziez_proc")) else None
    dz_geo.append({"rings":rm,"bbox":(min(xs),min(ys),max(xs),max(ys)),"youth":youth})
yv=[d["youth"] for d in dz_geo if d["youth"] is not None]; ymean=sum(yv)/len(yv) if yv else 14.0
def youth_at(x,y):
    for d in dz_geo:
        b=d["bbox"]
        if b[0]<=x<=b[2] and b[1]<=y<=b[3] and pip_any(x,y,d["rings"]):
            return d["youth"] if d["youth"] is not None else ymean
    return ymean
demand=[]; demand_w_youth=[]
for (pt,pr) in gridpts:
    demand.append(pt); demand_w_youth.append(youth_at(*pt))
demand_w_uniform=[1.0]*len(demand)
DET=1.43  # próg sieciowy ~ prosty * detour; 1000 m sieci ~ 700 m prosty
def greedy_sites(existing, weights, target_net=1000.0, K=5, cell=250.0):
    thr = target_net/DET   # próg prosty odpowiadający target sieciowy
    # nieobjęci: punkty popytu dalej niż thr od istniejących
    def covered_by(pset, pts):
        cov=set()
        # hash istniejących
        h={}
        for (ex,ey) in pset:
            h.setdefault((int(ex//cell),int(ey//cell)),[]).append((ex,ey))
        for idx,(x,y) in enumerate(pts):
            cx,cy=int(x//cell),int(y//cell); ok=False
            for ix in range(cx-1,cx+2):
                for iy in range(cy-1,cy+2):
                    for (ex,ey) in h.get((ix,iy),()):
                        if (ex-x)**2+(ey-y)**2<=thr*thr: ok=True;break
                    if ok:break
                if ok:break
            if ok: cov.add(idx)
        return cov
    cov=covered_by(existing, demand)
    uncovered=[i for i in range(len(demand)) if i not in cov]
    base_uncov=len(uncovered)
    # kandydaci = zgrid 250 m z lokalizacji nieobjętych
    cand={}
    for i in uncovered:
        x,y=demand[i]; cand.setdefault((round(x/cell),round(y/cell)),(x,y))
    cands=list(cand.values())
    chosen=[]
    unc=set(uncovered)
    for _ in range(K):
        best=None;bestcov=set();bestw=0.0
        for (cx,cy) in cands:
            c=set();w=0.0
            for i in list(unc):
                x,y=demand[i]
                if (cx-x)**2+(cy-y)**2<=thr*thr: c.add(i); w+=weights[i]
            if w>bestw: bestw=w;bestcov=c;best=(cx,cy)   # POPRAWKA: maksymalizuj WAGĘ (młodzież), nie liczbę
        if not best or not bestcov: break
        chosen.append({"lonlat":(LON0+best[0]/MLON,LAT0+best[1]/MLAT),
                       "objete_punkty":len(bestcov),"waga_mlodziez":round(bestw,1)})
        unc-=bestcov; cands=[c for c in cands if c!=best]
    return chosen, base_uncov

zlob_ex=existing_points("zlobki")
park_ex=existing_points("parki")+existing_points("zielen_pozostala")
# żłobki: ważone udziałem młodzieży; parki: równo (służą wszystkim)
zlob_sites,zlob_unc=greedy_sites(zlob_ex, demand_w_youth, target_net=1000.0, K=5)
park_sites,park_unc=greedy_sites(park_ex, demand_w_uniform, target_net=500.0, K=6)

def sites_fc(sites,kind):
    return {"type":"FeatureCollection","features":[
        {"type":"Feature","properties":{"rekomendacja":kind,"ranga":i+1,"objete_punkty_mieszk":s["objete_punkty"]},
         "geometry":{"type":"Point","coordinates":[round(s["lonlat"][0],6),round(s["lonlat"][1],6)]}}
        for i,s in enumerate(sites)]}
json.dump(sites_fc(zlob_sites,"nowy żłobek"), open(os.path.join(D,"lokalizacje_zlobki.geojson"),"w",encoding="utf-8"),ensure_ascii=False)
json.dump(sites_fc(park_sites,"nowy park/skwer"), open(os.path.join(D,"lokalizacje_parki.geojson"),"w",encoding="utf-8"),ensure_ascii=False)

out={"indeks_deprywacji":indeks,
     "lokalizacje":{"zlobki_nieobjete_punkty":zlob_unc,"zlobki_sugestie":len(zlob_sites),
                    "parki_nieobjete_punkty":park_unc,"parki_sugestie":len(park_sites)},
     "metoda":"deprywacja=średnia znormalizowanych domen: edukacja/usługi/sport — mediana dystansu PO SIECI pieszej, "
              "zieleń — pokrycie SATELITARNE (ESA WorldCover); brak placówki=kara 4 km; "
              "priorytet=deprywacja ważona udziałem młodzieży; lokalizacje=greedy max-coverage na siatce popytu (żłobki ważone młodzieżą)."}
json.dump(out, open(os.path.join(D,"strategia_analiza.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=2)

print("=== INDEKS DEPRYWACJI (wyższy = gorszy dostęp) ===")
for x in sorted(indeks,key=lambda z:-(z["deprywacja"] or -1)):
    print(f"  {str(x['numer']):>4} {str(x['nazwa'])[:6]:6} deprywacja {str(x['deprywacja']):>4} | "
          f"edu {str(x['dom_edukacja']):>3} usł {str(x['dom_uslugi']):>3} sport {str(x['dom_sport']):>3} zieleń {str(x['dom_zielen']):>3} | "
          f"priorytet {str(x['priorytet_rownosci']):>4} | pewność {x.get('pewnosc')}")
print(f"\nŻłobki: {zlob_unc} punktów mieszk. poza zasięgiem ~12 min. Sugerowane lokalizacje: {len(zlob_sites)}")
for i,s in enumerate(zlob_sites): print(f"  #{i+1} obejmuje {s['objete_punkty']} punktów popytu")
print(f"Parki: {park_unc} punktów >~7 min od zieleni. Sugerowane: {len(park_sites)}")
