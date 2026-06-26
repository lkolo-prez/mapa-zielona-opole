#!/usr/bin/env python3
"""
Rozróżnienie dostępności wg poziomu edukacji + sklepów pierwszej potrzeby.
Dzieli placówki na: żłobki, przedszkola, szkoły podstawowe, średnie, wyższe.
Liczy odległość pieszą (siatka mieszkaniowa co 120 m) do najbliższej placówki
każdego typu oraz do sklepu pierwszej potrzeby; agreguje globalnie i per dzielnica.
Zapisuje też osobne warstwy GeoJSON do mapy.
Źródło: OpenStreetMap (ODbL).
"""
import json, math, os, re

D = os.path.join(os.path.dirname(__file__), "dane")
LAT0, LON0 = 50.67, 17.92
MLAT = 111320.0; MLON = 111320.0 * math.cos(math.radians(LAT0))
def to_m(lon, lat): return ((lon-LON0)*MLON, (lat-LAT0)*MLAT)
def load(n):
    p=os.path.join(D,n+".geojson"); return json.load(open(p,encoding="utf-8")) if os.path.exists(p) else {"features":[]}
def rings_of(f):
    g=f.get("geometry") or {}; t=g.get("type"); c=g.get("coordinates"); o=[]
    if t=="Polygon" and c: o.append(c[0])
    elif t=="MultiPolygon" and c:
        for poly in c:
            if poly: o.append(poly[0])
    return o
def feat_point_m(f):
    g=f.get("geometry") or {}; t=g.get("type"); c=g.get("coordinates")
    if t=="Point": return to_m(*c)
    r=None
    if t=="Polygon" and c: r=c[0]
    elif t=="MultiPolygon" and c:   # #12: złącz wszystkie pierścienie zewn., nie tylko pierwszy
        r=[pt for poly in c if poly for pt in poly[0]]
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

class Hash:
    def __init__(s,pts,cell=400.0):
        s.cell=cell;s.h={}
        for (x,y) in pts: s.h.setdefault((int(x//cell),int(y//cell)),[]).append((x,y))
    def nearest(s,x,y,maxr=5000):
        c=s.cell;cx,cy=int(x//c),int(y//c);best=1e18;rad=0
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

def cls(p):
    """Klasyfikacja placówki edukacyjnej -> kategoria."""
    n=((p.get("name") or p.get("official_name") or "")+" "+(p.get("isced:level") or "")).lower()
    a=p.get("amenity")
    if a=="childcare" or "żłob" in n or "zlob" in n: return "zlobek"
    if a=="kindergarten" or "przedszkol" in n: return "przedszkole"
    if a=="university" or re.search(r"uniwersytet|politechnik|akademia|wyższa szkoł|collegium|wsb|wsei|szkoła główna",n): return "wyzsza"
    if re.search(r"technik|branżow|zawodow|liceum|\blo\b|ogólnokształc|zespół szkół|policeal",n) or a=="college": return "srednia"
    if re.search(r"podstawow|psp ",n) or p.get("isced:level") in ("1","1;2","2"): return "podstawowa"
    if re.search(r"języków|language|cosmopolitan|szkolen|kurs|jazdy|muzyczn|artystyczn",n): return "inna"
    if a=="school": return "podstawowa"   # domyślnie szkoła = podstawowa
    return "inna"

# --- klasyfikacja i zapis osobnych warstw ---
print("Klasyfikuję placówki...")
buckets={"zlobek":[],"przedszkole":[],"podstawowa":[],"srednia":[],"wyzsza":[],"inna":[]}
for src in ("szkoly","przedszkola_zlobki"):
    for f in load(src)["features"]:
        buckets[cls(f.get("properties",{}))].append(f)
NAMEMAP={"zlobek":"zlobki","przedszkole":"przedszkola","podstawowa":"szkoly_podstawowe",
         "srednia":"szkoly_srednie","wyzsza":"szkoly_wyzsze"}
for k,fname in NAMEMAP.items():
    json.dump({"type":"FeatureCollection","features":buckets[k]},
              open(os.path.join(D,fname+".geojson"),"w",encoding="utf-8"),ensure_ascii=False)
    print(f"  {fname}: {len(buckets[k])}")
print(f"  (inne/kursy/językowe pominięte: {len(buckets['inna'])})")

# --- punkty kategorii ---
def pts(fs): return [p for p in (feat_point_m(f) for f in fs) if p]
cats={
    "zlobek":pts(buckets["zlobek"]),
    "przedszkole":pts(buckets["przedszkole"]),
    "podstawowa":pts(buckets["podstawowa"]),
    "srednia":pts(buckets["srednia"]),
    "wyzsza":pts(buckets["wyzsza"]),
    "sklep_pierwszej":pts(load("sklepy_spozywcze")["features"]),
}
hashes={k:Hash(v) for k,v in cats.items() if v}
for k,v in cats.items(): print(f"  kat {k}: {len(v)}")

# --- dzielnice (do agregacji per dzielnica) ---
districts=[]
for f in load("dzielnice")["features"]:
    rm=feat_rings_m(f)
    if not rm: continue
    xs=[p[0] for r in rm for p in r]; ys=[p[1] for r in rm for p in r]
    districts.append({"nazwa":f["properties"].get("nazwa"),"numer":f["properties"].get("numer"),
                      "rings":rm,"bbox":(min(xs),min(ys),max(xs),max(ys)),"d":{k:[] for k in cats}})
def find_d(x,y):
    for d in districts:
        b=d["bbox"]
        if b[0]<=x<=b[2] and b[1]<=y<=b[3] and pip_any(x,y,d["rings"]): return d
    return None

# --- siatka mieszkaniowa ---
print("Liczę odległości na siatce mieszkaniowej...")
STEP=120.0
agg={k:[] for k in cats}
grid=[]
samples=0
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
                dd={}
                for k in cats:
                    h=hashes.get(k); v=h.nearest(x,y) if h else None
                    dd[k]=v
                    if v is not None: agg[k].append(v)
                dist=find_d(x,y)
                if dist:
                    for k in cats:
                        if dd[k] is not None: dist["d"][k].append(dd[k])
                lon=LON0+x/MLON; lat=LAT0+y/MLAT
                grid.append({"type":"Feature","properties":{f"d_{k}":(round(dd[k]) if dd[k] is not None else None) for k in cats},
                             "geometry":{"type":"Point","coordinates":[round(lon,6),round(lat,6)]}})
            y+=STEP
        x+=STEP
print(f"  próbek: {samples}")

def avg(l): return round(sum(l)/len(l)) if l else None
def med(l):
    if not l: return None
    s=sorted(l);n=len(s);return round(s[n//2] if n%2 else (s[n//2-1]+s[n//2])/2)
def within(l,t): return round(100*sum(1 for v in l if v<=t)/len(l),1) if l else None

LABELS={"zlobek":"Żłobek","przedszkole":"Przedszkole","podstawowa":"Szkoła podstawowa",
        "srednia":"Szkoła średnia","wyzsza":"Szkoła wyższa","sklep_pierwszej":"Sklep pierwszej potrzeby"}
summary={"probek":samples,"kategorie":LABELS,
    "srednia_m":{k:avg(agg[k]) for k in cats},
    "mediana_m":{k:med(agg[k]) for k in cats},
    "w_500m_proc":{k:within(agg[k],500) for k in cats},
    "w_800m_proc":{k:within(agg[k],800) for k in cats},
    "w_1200m_proc":{k:within(agg[k],1200) for k in cats},
    "liczba_placowek":{k:len(cats[k]) for k in cats}}
per=[]
for d in districts:
    per.append({"numer":d["numer"],"nazwa":d["nazwa"],
                **{f"sr_{k}":avg(d["d"][k]) for k in cats}})
summary["dzielnice"]=per

json.dump(summary,open(os.path.join(D,"dostepnosc_edukacja.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=2)
json.dump({"type":"FeatureCollection","features":grid},
          open(os.path.join(D,"dostepnosc_edukacja.geojson"),"w",encoding="utf-8"),ensure_ascii=False)

print("\n=== DOSTĘPNOŚĆ WG POZIOMU (cała próba) ===")
for k in cats:
    print(f"  {LABELS[k]:28} śr {str(summary['srednia_m'][k]):>5} m | mediana {str(summary['mediana_m'][k]):>5} m | "
          f"≤800m {str(summary['w_800m_proc'][k]):>5}% | placówek {summary['liczba_placowek'][k]}")
print("\nNajgorszy dostęp do żłobka/przedszkola wg dzielnic (śr. odległość):")
for d in sorted(per,key=lambda x:-((x['sr_zlobek'] or 0)+(x['sr_przedszkole'] or 0))):
    print(f"  {str(d['numer']):>4} {str(d['nazwa'])[:6]:6} żłobek {str(d['sr_zlobek']):>5} m | przedszkole {str(d['sr_przedszkole']):>5} m | podstawowa {str(d['sr_podstawowa']):>5} m")
