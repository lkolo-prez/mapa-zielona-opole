#!/usr/bin/env python3
"""
Dane ekonomiczne dla Opola z GUS BDL API (Bank Danych Lokalnych).
Powiat m. Opole = jednostka 031613261000.
Pobiera: ceny mieszkań (mediana zł/m², z podziałem na izby), wynagrodzenia,
firmy wg klas wielkości. Wynik: dane/ekonomia.json.
Źródło: GUS Bank Danych Lokalnych (bdl.stat.gov.pl), API v1.
"""
import json, os, time, urllib.request

UNIT = "031613261000"
BASE = "https://bdl.stat.gov.pl/api/v1"
OUT = os.path.join(os.path.dirname(__file__), "dane")

def get(url):
    for _ in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "opole-strategia/1.0", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print("  retry:", e); time.sleep(5)
    return {}

def series(var_id):
    d = get(f"{BASE}/data/by-unit/{UNIT}?var-id={var_id}&format=json&page-size=50")
    res = d.get("results")
    if not res: return []
    return [(v["year"], v["val"]) for v in res[0]["values"] if v.get("val") is not None]

def variables(subject):
    d = get(f"{BASE}/variables?subject-id={subject}&format=json&page-size=60")
    return d.get("results", [])

# Jednostki (wg GUS BDL):
#  ceny mieszkań  = MEDIANA ceny transakcyjnej za 1 m² [zł/m²], rynek wolny (var 1607919) i ogółem (1607914)
#  wynagrodzenia  = przeciętne MIESIĘCZNE wynagrodzenie BRUTTO [zł] (var 64428); relacja do kraju [%] (64429)
#  firmy          = liczba podmiotów w rejestrze REGON wg klas wielkości zatrudnienia [szt.] (P2315)
print("Ceny mieszkań (MEDIANA zł/m²)...")
ceny = {
    "ogolem": series(1607914),
    "wolny_rynek": series(1607919),
    "1_izbowe": series(1607920),
    "2_izbowe": series(1607921),
    "3_izbowe": series(1607922),
    "4_izbowe_plus": series(1607923),
}
time.sleep(1)
print("Wynagrodzenia...")
place = {
    "brutto_zl": series(64428),
    "relacja_do_kraju_proc": series(64429),
}
time.sleep(1)
print("Firmy wg klas wielkości (P2315)...")
firmy = {}
for v in variables("P2315"):
    name = " / ".join([x for x in [v.get("n1"), v.get("n2"), v.get("n3")] if x])
    s = series(v["id"]); time.sleep(0.3)
    if s: firmy[name] = s

out = {
    "jednostka": "Powiat m. Opole (GUS BDL 031613261000)",
    "zrodlo": "GUS Bank Danych Lokalnych (bdl.stat.gov.pl)",
    "ceny_mieszkan_zl_m2": ceny,
    "wynagrodzenia": place,
    "firmy_wg_wielkosci": firmy,
}
json.dump(out, open(os.path.join(OUT, "ekonomia.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# podsumowanie
def last(s): return s[-1] if s else (None, None)
print("\n=== EKONOMIA OPOLE ===")
cw = ceny["wolny_rynek"]
if cw:
    y0, v0 = cw[0]; y1, v1 = cw[-1]
    print(f"Cena mieszkania (wolny rynek, mediana): {v0} zł/m² ({y0}) -> {v1} zł/m² ({y1}), "
          f"+{round(100*(v1-v0)/v0)}%")
pw = place["brutto_zl"]
if pw: print(f"Przeciętne wynagrodzenie brutto: {pw[-1][1]} zł ({pw[-1][0]})")
pr = place["relacja_do_kraju_proc"]
if pr: print(f"Relacja do średniej krajowej: {pr[-1][1]}% ({pr[-1][0]})")
print(f"Klas wielkości firm: {len(firmy)} szeregów")
for k, s in list(firmy.items())[:8]:
    if s: print(f"  {k[:55]:55} {s[-1][1]} ({s[-1][0]})")
