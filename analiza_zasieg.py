#!/usr/bin/env python3
"""
Białe plamy zasięgu telekomunikacyjnego (proxy) na podstawie lokalizacji stacji bazowych.
Dla terenów mieszkalnych (w granicach miasta) liczy odległość do najbliższej stacji BTS.
UWAGA: to PROXY — realny zasięg zależy od mocy, pasma, kierunku anten i terenu (dane operatorów/UKE).
Dystans w linii prostej jest tu właściwy (propagacja sygnału ~ optyczna, ~1/d²).
Źródło stacji: SI2PEM (si2pem.gov.pl).
"""
import json, math, os

D = os.path.join(os.path.dirname(__file__), "dane")
LAT0=50.67; LON0=17.92; MLAT=111320.0; MLON=111320.0*math.cos(math.radians(LAT0))
def to_m(lon,lat): return ((lon-LON0)*MLON,(lat-LAT0)*MLAT)
def load(n):
    p=os.path.join(D,n+".geojson"); return json.load(open(p,encoding="utf-8")) if os.path.exists(p) else {"features":[]}
def rings_of(f):
    g=f.get("geometry") or {};t=g.get("type");c=g.get("coordinates");o=[]
    if t=="Polygon" and c:o.append(c[0])
    elif t=="MultiPolygon" and c:
        for poly in c:
            if poly:o.append(poly[0])
    return o
def feat_rings_m(f): return [[to_m(lon,lat) for lon,lat in r] for r in rings_of(f)]
def pip(x,y,r):
    ins=False;n=len(r);j=n-1
    for i in range(n):
        xi,yi=r[i];xj,yj=r[j]
        if ((yi>y)!=(yj>y)) and (x<(xj-xi)*(y-yi)/((yj-yi) or 1e-12)+xi):ins=not ins
        j=i
    return ins
def pip_any(x,y,rs): return any(pip(x,y,r) for r in rs)

bts=[to_m(*f["geometry"]["coordinates"]) for f in load("bts_nadajniki")["features"] if f["geometry"]["type"]=="Point"]
print(f"Stacji BTS: {len(bts)}")

class Hash:
    def __init__(s,pts,c=500.0):
        s.c=c;s.h={}
        for (x,y) in pts:s.h.setdefault((int(x//c),int(y//c)),[]).append((x,y))
    def near(s,x,y,maxr=6000):
        c=s.c;cx,cy=int(x//c),int(y//c);best=1e18;rad=0
        while rad*c<=maxr+c:
            for ix in range(cx-rad,cx+rad+1):
                for iy in range(cy-rad,cy+rad+1):
                    if rad>0 and abs(ix-cx)!=rad and abs(iy-cy)!=rad:continue
                    for (px,py) in s.h.get((ix,iy),()):
                        dd=(px-x)**2+(py-y)**2
                        if dd<best:best=dd
            if best<1e17 and rad>=1:break
            rad+=1
        return math.sqrt(best) if best<1e17 else None
    def count_within(s,x,y,r):
        c=s.c;cx,cy=int(x//c),int(y//c);rad=int(r//c)+1;n=0
        for ix in range(cx-rad,cx+rad+1):
            for iy in range(cy-rad,cy+rad+1):
                for (px,py) in s.h.get((ix,iy),()):
                    if (px-x)**2+(py-y)**2<=r*r:n+=1
        return n
H=Hash(bts)

# dzielnice (maska miasta + agregacja + powierzchnia do gęstości)
districts=[]
for f in load("dzielnice")["features"]:
    rm=feat_rings_m(f)
    if not rm:continue
    xs=[p[0] for r in rm for p in r];ys=[p[1] for r in rm for p in r]
    # pole shoelace
    area=0.0
    for r in rm:
        a=0.0
        for i in range(len(r)-1):a+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1]
        area+=abs(a)/2
    districts.append({"numer":f["properties"]["numer"],"nazwa":f["properties"]["nazwa"],
                      "rings":rm,"bbox":(min(xs),min(ys),max(xs),max(ys)),"area_km2":area/1e6,"bts":0,"dist":[]})
def find_d(x,y):
    for d in districts:
        b=d["bbox"]
        if b[0]<=x<=b[2] and b[1]<=y<=b[3] and pip_any(x,y,d["rings"]):return d
    return None
for (x,y) in bts:
    d=find_d(x,y)
    if d:d["bts"]+=1

# siatka mieszkaniowa w mieście -> dystans do najbliższego BTS
STEP=120.0
grid=[];dists=[];white=0;samples=0
for f in load("mieszkaniowe")["features"]:
    rm=feat_rings_m(f)
    if not rm:continue
    pts=[p for r in rm for p in r]
    bx0=min(p[0] for p in pts);by0=min(p[1] for p in pts);bx1=max(p[0] for p in pts);by1=max(p[1] for p in pts)
    x=bx0
    while x<=bx1:
        y=by0
        while y<=by1:
            if pip_any(x,y,rm):
                d=find_d(x,y)
                if d:
                    dd=H.near(x,y)
                    samples+=1
                    if dd is not None:
                        dists.append(dd); d["dist"].append(dd)
                        if dd>1000: white+=1
                        lon=LON0+x/MLON;lat=50.67+y/MLAT
                        grid.append({"type":"Feature","properties":{"do_bts_m":round(dd)},
                                     "geometry":{"type":"Point","coordinates":[round(lon,6),round(lat,6)]}})
            y+=STEP
        x+=STEP

def avg(l):return round(sum(l)/len(l)) if l else None
def med(l):
    if not l:return None
    s=sorted(l);n=len(s);return round(s[n//2] if n%2 else (s[n//2-1]+s[n//2])/2)
summary={"stacji_bts":len(bts),"probek_mieszk":samples,
    "srednia_do_bts_m":avg(dists),"mediana_do_bts_m":med(dists),
    "max_do_bts_m":round(max(dists)) if dists else None,
    "biale_plamy_powyzej_1km":white,"biale_plamy_proc":round(100*white/samples,1) if samples else None,
    "dzielnice":[{"numer":d["numer"],"nazwa":d["nazwa"],"bts":d["bts"],
                  "gestosc_bts_km2":round(d["bts"]/d["area_km2"],2) if d["area_km2"] else None,
                  "srednia_do_bts_m":avg(d["dist"]),"max_do_bts_m":round(max(d["dist"])) if d["dist"] else None}
                 for d in districts],
    "uwaga":"PROXY zasięgu (odległość do najbliższej stacji). Realny zasięg = moc/pasmo/kierunek anten/teren "
            "— dane operatorów lub UKE/internet.gov.pl. Stacje: SI2PEM."}
json.dump(summary,open(os.path.join(D,"podsumowanie_zasieg.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=2)
# tylko białe plamy (>1km) jako osobna warstwa
white_fc={"type":"FeatureCollection","features":[g for g in grid if g["properties"]["do_bts_m"]>1000]}
json.dump(white_fc,open(os.path.join(D,"zasieg_biale_plamy.geojson"),"w",encoding="utf-8"),ensure_ascii=False)
json.dump({"type":"FeatureCollection","features":grid},open(os.path.join(D,"zasieg_grid.geojson"),"w",encoding="utf-8"),ensure_ascii=False)

print("\n=== ZASIĘG (proxy: odległość do BTS) ===")
print(f"  mediana do BTS: {summary['mediana_do_bts_m']} m | średnia {summary['srednia_do_bts_m']} m | max {summary['max_do_bts_m']} m")
print(f"  białe plamy (>1 km od BTS): {white} ({summary['biale_plamy_proc']}% terenów mieszk.)")
print("\nGęstość BTS per dzielnica:")
for d in sorted(summary["dzielnice"],key=lambda x:(x["gestosc_bts_km2"] or 0)):
    print(f"  {str(d['numer']):>4} {str(d['nazwa'])[:6]:6} | BTS {d['bts']:>3} | gęstość {d['gestosc_bts_km2']}/km² | śr. do BTS {d['srednia_do_bts_m']} m | max {d['max_do_bts_m']} m")
