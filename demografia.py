#!/usr/bin/env python3
"""
Wyciąga 10-letnią serię demograficzną (2017-2026) z warstwy ArcGIS UM Opole
i liczy projekcję liniową do 2030. Wynik: dane/demografia.json.
Pola źródłowe per dzielnica: ludnosc_YY, gestosc_YY, sr_wieku_YY,
proc_w_przed_prod_YY (liczba w wieku przedprodukcyjnym), proc_w_po_prod_YY,
obciazenie_demo_YY.
"""
import json, os

D = os.path.join(os.path.dirname(__file__), "dane")
YEARS = list(range(2017, 2027))      # 2017..2026
YY = [str(y)[2:] for y in YEARS]
PROJ_YEARS = list(range(2027, 2031)) # 2027..2030

def lin_fit(xs, ys):
    """Regresja liniowa y=a+bx; zwraca (a,b)."""
    n = len(xs); sx = sum(xs); sy = sum(ys)
    sxx = sum(x*x for x in xs); sxy = sum(x*y for x, y in zip(xs, ys))
    denom = (n*sxx - sx*sx) or 1e-9
    b = (n*sxy - sx*sy) / denom
    a = (sy - b*sx) / n
    return a, b

def project(years, vals, proj_years):
    a, b = lin_fit(years, vals)
    return [round(a + b*y) for y in proj_years], round(b, 1)  # trend/rok

def series(props, prefix, cast=int):
    out = []
    for yy in YY:
        v = props.get(f"{prefix}_{yy}")
        out.append(cast(v) if v is not None else None)
    return out

def age_series(props, prefix, ludn):
    """Grupy wiekowe: 2017-2025 = %, 2026 = liczba. Zwraca (procenty, liczby).
    Lata, w których suma grup != ~100% (np. uszkodzony 2024), -> None."""
    pct = [None]*len(YY); cnt = [None]*len(YY)
    # walidacja: suma trzech grup wiekowych ~100 (dla lat procentowych)
    przed = [props.get(f"proc_w_przed_prod_{yy}") for yy in YY]
    prod  = [props.get(f"proc_w_prod_{yy}") for yy in YY]
    popro = [props.get(f"proc_w_po_prod_{yy}") for yy in YY]
    for i, yy in enumerate(YY):
        v = props.get(f"{prefix}_{yy}")
        if v is None:
            continue
        if yy == "26":  # liczba bezwzględna — POPRAWKA audyt #8: waliduj sumę grup ≈ ludność
            grp_sum = sum(x for x in (przed[i], prod[i], popro[i]) if x is not None)
            if ludn[i] and not (0.9 <= grp_sum/ludn[i] <= 1.1):
                continue  # rok 2026 niespójny — odrzuć
            cnt[i] = int(v)
            pct[i] = round(100*v/ludn[i], 2) if ludn[i] else None
        else:  # procent — waliduj sumę grup
            s = sum(x for x in (przed[i], prod[i], popro[i]) if x is not None)
            if not (90 <= s <= 110):
                continue  # rok uszkodzony
            pct[i] = round(float(v), 2)
            cnt[i] = round(v/100*ludn[i]) if ludn[i] else None
    return pct, cnt

dz = json.load(open(os.path.join(D, "dzielnice.geojson"), encoding="utf-8"))

districts = []
for f in dz["features"]:
    p = f["properties"]
    ludn = series(p, "ludnosc", int)
    wiek = series(p, "sr_wieku", float)
    gest = series(p, "gestosc", float)
    obc = series(p, "obciazenie_demo", float)
    mlodz_pct, mlodz = age_series(p, "proc_w_przed_prod", ludn)
    senior_pct, senior = age_series(p, "proc_w_po_prod", ludn)
    valid_years = [y for y, v in zip(YEARS, ludn) if v is not None]
    ludn_v = [v for v in ludn if v is not None]
    proj_ludn, trend = (project(valid_years, ludn_v, PROJ_YEARS) if len(ludn_v) >= 2 else ([], 0))
    # projekcja młodzieży na podstawie ważnych punktów (count)
    my = [(y, c) for y, c in zip(YEARS, mlodz) if c is not None]
    proj_mlodz, trend_m = (project([y for y, _ in my], [c for _, c in my], PROJ_YEARS) if len(my) >= 2 else ([], 0))
    m0 = next((c for c in mlodz if c is not None), None)
    m1 = next((c for c in reversed(mlodz) if c is not None), None)
    districts.append({
        "numer": p.get("numer"), "nazwa": p.get("nazwa"),
        "ludnosc": ludn, "mlodziez": mlodz, "mlodziez_proc": mlodz_pct,
        "seniorzy": senior, "seniorzy_proc": senior_pct,
        "sr_wieku": wiek, "gestosc": gest, "obciazenie_demo": obc,
        "ludnosc_proj": proj_ludn, "mlodziez_proj": proj_mlodz,
        "trend_ludnosc_rok": trend, "trend_mlodziez_rok": trend_m,
        "zmiana_10lat": (ludn[-1] - ludn[0]) if ludn[0] and ludn[-1] else None,
        "zmiana_10lat_proc": round(100*(ludn[-1]-ludn[0])/ludn[0], 1) if ludn[0] and ludn[-1] else None,
        "zmiana_mlodziez_10lat_proc": round(100*(m1-m0)/m0, 1) if (m0 and m1) else None,
    })

# agregaty miasta per rok
def city_sum(key, idx):
    s = 0; any_v = False
    for d in districts:
        v = d[key][idx]
        if v is not None: s += v; any_v = True
    return s if any_v else None

city = {"lata": YEARS, "proj_lata": PROJ_YEARS}
city["ludnosc"] = [city_sum("ludnosc", i) for i in range(len(YEARS))]
city["mlodziez"] = [city_sum("mlodziez", i) for i in range(len(YEARS))]
city["seniorzy"] = [city_sum("seniorzy", i) for i in range(len(YEARS))]
# średni wiek ważony ludnością
city["sr_wieku"] = []
for i in range(len(YEARS)):
    num = 0; den = 0
    for d in districts:
        w = d["ludnosc"][i]; a = d["sr_wieku"][i]
        if w and a: num += w*a; den += w
    city["sr_wieku"].append(round(num/den, 1) if den else None)
city["mlodziez_proc"] = [round(100*m/l, 1) if (m and l) else None
                         for m, l in zip(city["mlodziez"], city["ludnosc"])]
city["seniorzy_proc"] = [round(100*s/l, 1) if (s and l) else None
                         for s, l in zip(city["seniorzy"], city["ludnosc"])]
def proj_valid(years, vals, proj_years):
    pairs = [(y, v) for y, v in zip(years, vals) if v is not None]
    if len(pairs) < 2: return [], 0
    return project([y for y, _ in pairs], [v for _, v in pairs], proj_years)
city["ludnosc_proj"], city["trend_ludnosc_rok"] = proj_valid(YEARS, city["ludnosc"], PROJ_YEARS)
city["mlodziez_proj"], city["trend_mlodziez_rok"] = proj_valid(YEARS, city["mlodziez"], PROJ_YEARS)

out = {"lata": YEARS, "proj_lata": PROJ_YEARS, "miasto": city, "dzielnice": districts,
       "zrodlo": "ArcGIS UM Opole — warstwa 'Dzielnice miasta Opole' (mieszkańcy/Map/0)"}
json.dump(out, open(os.path.join(D, "demografia.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("=== MIASTO (suma 13 dzielnic) ===")
print("rok :", YEARS)
print("ludn:", city["ludnosc"])
print("młodz:", city["mlodziez"], "(", city["mlodziez_proc"], "%)")
print("śr.wiek:", city["sr_wieku"])
print(f"\nProjekcja ludności {PROJ_YEARS}: {city['ludnosc_proj']} (trend {city['trend_ludnosc_rok']}/rok)")
print(f"Projekcja młodzieży {PROJ_YEARS}: {city['mlodziez_proj']} (trend {city['trend_mlodziez_rok']}/rok)")
print(f"\nZmiana ludności 2017->2026: {city['ludnosc'][-1]-city['ludnosc'][0]:+d} "
      f"({round(100*(city['ludnosc'][-1]-city['ludnosc'][0])/city['ludnosc'][0],1)}%)")
print("\nDzielnice — zmiana młodzieży 2017->2026:")
for d in sorted(districts, key=lambda x: (x["zmiana_mlodziez_10lat_proc"] or 0)):
    print(f"  {str(d['numer']):>4} {str(d['nazwa'])[:18]:18} młodzież {d['mlodziez'][0]}->{d['mlodziez'][-1]} "
          f"({d['zmiana_mlodziez_10lat_proc']}%) | ludność {d['zmiana_10lat_proc']}%")
