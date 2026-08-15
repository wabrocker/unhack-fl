#!/usr/bin/env python3
"""Generate an inline-SVG outline of a US state, for use as a page graphic.

Why this exists: hand-drawing a state from memory does not work. Three
attempts at Florida produced shapes that read as a hook and a wedge. This
takes the real boundary instead.

Source: the US Census Bureau's TIGER/Line state boundaries, redistributed
as TopoJSON by us-atlas. Census data is a work of the US Government and is
public domain, so the output carries no licence obligation -- the same
provenance discipline the iChart silhouettes use.

Usage:
    python3 scripts/state_outline.py Florida
    python3 scripts/state_outline.py Michigan --width 120 --eps 0.05

The path is emitted with a viewBox sized to the state's true proportions
(longitude corrected by cos(latitude), so the state is not stretched), and
uses currentColor at the call site so it themes with the page.
"""

import argparse
import json
import math
import os
import sys
import urllib.request

ATLAS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"
CACHE = os.path.join(os.path.dirname(__file__), ".states-10m.json")


def load_topology():
    if not os.path.exists(CACHE):
        with urllib.request.urlopen(ATLAS_URL, timeout=90) as r:
            data = r.read()
        with open(CACHE, "wb") as f:
            f.write(data)
    with open(CACHE) as f:
        return json.load(f)


def decode_arcs(topo):
    """Undo TopoJSON's delta encoding and quantisation, once, for all arcs."""
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    out = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def ring_points(arc_indices, arcs):
    """A ring is a list of arc indices; a negative index means traverse it
    backwards (~i is TopoJSON's encoding for that)."""
    pts = []
    for i in arc_indices:
        seg = arcs[~i][::-1] if i < 0 else arcs[i]
        pts.extend(seg[1:] if pts else seg)
    return pts


def shoelace_area(ring):
    return abs(
        sum(ring[i][0] * ring[i - 1][1] - ring[i - 1][0] * ring[i][1]
            for i in range(len(ring)))
    ) / 2


def simplify_ring(pts, eps):
    """Douglas-Peucker on a closed ring.

    Applied naively to a ring this returns two points: the first and last
    are the same point, so the baseline has zero length, every perpendicular
    distance measures as zero, and the whole coastline is discarded. So cut
    the ring at its two most distant points first and simplify each half as
    an open chain.
    """
    if len(pts) < 4:
        return pts
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    a = pts[0]
    far = max(range(len(pts)), key=lambda i: math.hypot(pts[i][0] - a[0],
                                                        pts[i][1] - a[1]))
    first = simplify(pts[:far + 1], eps)
    second = simplify(pts[far:] + [pts[0]], eps)
    return first[:-1] + second[:-1]


def simplify(pts, eps):
    """Douglas-Peucker on an open chain, iterative so a long coastline
    can't blow the recursion limit."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        lo, hi = stack.pop()
        ax, ay = pts[lo]
        bx, by = pts[hi]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-12
        worst, wi = 0.0, -1
        for i in range(lo + 1, hi):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > worst:
                worst, wi = d, i
        if wi != -1 and worst > eps:
            keep[wi] = True
            stack.append((lo, wi))
            stack.append((wi, hi))
    return [p for p, k in zip(pts, keep) if k]


def state_path(name, width=100.0, eps=0.045):
    topo = load_topology()
    arcs = decode_arcs(topo)

    matches = [
        g for g in topo["objects"]["states"]["geometries"]
        if g.get("properties", {}).get("name", "").lower() == name.lower()
    ]
    if not matches:
        names = sorted(g["properties"]["name"]
                       for g in topo["objects"]["states"]["geometries"])
        raise SystemExit(f"No state named {name!r}. Known: {', '.join(names)}")
    geom = matches[0]

    polys = geom["arcs"] if geom["type"] == "MultiPolygon" else [geom["arcs"]]
    # Outer ring of each polygon; keep the largest (the mainland). Florida's
    # other nine polygons are the Keys and barrier islands; Michigan's second
    # is the Upper Peninsula, which you may well want -- see --parts.
    rings = [ring_points(p[0], arcs) for p in polys]
    rings.sort(key=shoelace_area, reverse=True)

    simplified = [simplify_ring(r, eps) for r in rings]

    # Longitude degrees shrink with latitude; without this the state comes
    # out too wide.
    all_pts = [p for r in simplified for p in r]
    lat0 = sum(p[1] for p in all_pts) / len(all_pts)
    k = math.cos(math.radians(lat0))
    proj = [[(x * k, -y) for x, y in r] for r in simplified]

    flat = [p for r in proj for p in r]
    minx = min(p[0] for p in flat)
    maxx = max(p[0] for p in flat)
    miny = min(p[1] for p in flat)
    maxy = max(p[1] for p in flat)
    height = width * (maxy - miny) / (maxx - minx)

    def scale(r):
        return [((x - minx) / (maxx - minx) * width,
                 (y - miny) / (maxy - miny) * height) for x, y in r]

    return [scale(r) for r in proj], width, height


def to_d(ring):
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in ring) + " Z"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("state")
    ap.add_argument("--width", type=float, default=100.0)
    ap.add_argument("--eps", type=float, default=0.045,
                    help="simplification tolerance in degrees; higher is coarser")
    ap.add_argument("--parts", type=int, default=1,
                    help="how many landmasses to draw, largest first "
                         "(Michigan needs 2 for the Upper Peninsula)")
    args = ap.parse_args()

    rings, w, h = state_path(args.state, args.width, args.eps)
    rings = rings[:args.parts]
    pts = sum(len(r) for r in rings)

    print(f'<!-- {args.state}: US Census TIGER via us-atlas, public domain. '
          f'{pts} points. -->', file=sys.stderr)
    print(f'<svg viewBox="0 0 {w:.0f} {h:.1f}" fill="none" '
          f'xmlns="http://www.w3.org/2000/svg">')
    for r in rings:
        print(f'  <path d="{to_d(r)}"\n        stroke="currentColor" '
              f'stroke-width="2" stroke-linejoin="round"\n        '
              f'fill="currentColor" fill-opacity=".12"/>')
    print('</svg>')


if __name__ == "__main__":
    main()
