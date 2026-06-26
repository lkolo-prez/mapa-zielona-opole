#!/usr/bin/env python3
"""
Router pieszy (pure Python) na sieci OSM Opola.
Graf nieskierowany: węzły = wierzchołki odcinków (snapowane do ~1 m),
krawędzie = długość segmentu w metrach. Dijkstra wielo- i jednoźródłowy.
Dystans SIECIOWY (po drogach/chodnikach) — uwzględnia bariery (rzeka, tory),
więc poprawia „błędne odległości" liczone w linii prostej.
"""
import json, math, os, heapq

LAT0, LON0 = 50.67, 17.92
MLAT = 111320.0
MLON = 111320.0 * math.cos(math.radians(LAT0))
def to_m(lon, lat): return ((lon - LON0) * MLON, (lat - LAT0) * MLAT)
def to_lonlat(x, y): return (LON0 + x / MLON, LAT0 + y / MLAT)

SNAP = 1.5  # m — kwantyzacja węzłów (łączy wspólne wierzchołki)

class Graph:
    def __init__(self):
        self.adj = {}          # nid -> list[(nid2, w)]
        self.xy = {}           # nid -> (x,y)
        self._hash = {}        # (cx,cy) -> list[nid]   (cell 50 m)
        self._cell = 50.0

    def _node(self, x, y):
        nid = (round(x / SNAP), round(y / SNAP))
        if nid not in self.xy:
            self.xy[nid] = (x, y); self.adj[nid] = []
            self._hash.setdefault((int(x // self._cell), int(y // self._cell)), []).append(nid)
        return nid

    def add_edge(self, a, b, w):
        self.adj[a].append((b, w)); self.adj[b].append((a, w))

    def build(self, geojson):
        for f in geojson.get("features", []):
            g = f.get("geometry") or {}
            if g.get("type") != "LineString": continue
            coords = g["coordinates"]
            prev = None
            for lon, lat in coords:
                x, y = to_m(lon, lat); nid = self._node(x, y)
                if prev is not None:
                    px, py = self.xy[prev]; w = math.hypot(x - px, y - py)
                    if w > 0: self.add_edge(prev, nid, w)
                prev = nid
        return self

    def nearest_node(self, x, y, maxr=600):
        c = self._cell; cx, cy = int(x // c), int(y // c); best = None; bd = 1e18; rad = 0
        while rad * c <= maxr + c:
            for ix in range(cx - rad, cx + rad + 1):
                for iy in range(cy - rad, cy + rad + 1):
                    if rad > 0 and abs(ix - cx) != rad and abs(iy - cy) != rad: continue
                    for nid in self._hash.get((ix, iy), ()):
                        px, py = self.xy[nid]; dd = (px - x) ** 2 + (py - y) ** 2
                        if dd < bd: bd = dd; best = nid
            if best is not None and rad >= 1: break
            rad += 1
        return (best, math.sqrt(bd)) if best is not None else (None, None)

    def dijkstra(self, sources, maxdist=None):
        """sources: lista (nid, dist0). Zwraca dict nid->dystans do najbliższego źródła."""
        dist = {}; pq = []
        for nid, d0 in sources:
            if nid is None: continue
            if nid not in dist or d0 < dist[nid]:
                dist[nid] = d0; heapq.heappush(pq, (d0, nid))
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist.get(u, 1e18): continue
            if maxdist is not None and d > maxdist: continue
            for v, w in self.adj[u]:
                nd = d + w
                if nd < dist.get(v, 1e18):
                    dist[v] = nd; heapq.heappush(pq, (nd, v))
        return dist

    def stats(self):
        return {"wezly": len(self.xy), "krawedzie": sum(len(a) for a in self.adj.values()) // 2}

def load_graph(dane_dir):
    p = os.path.join(dane_dir, "siec_piesza.geojson")
    gj = json.load(open(p, encoding="utf-8"))
    return Graph().build(gj)

if __name__ == "__main__":
    D = os.path.join(os.path.dirname(__file__), "dane")
    g = load_graph(D)
    print("Graf:", g.stats())
