#!/usr/bin/env python3
"""Download and stitch real elevation for the SR-71 backdrop lab.

Source: AWS Open Data "Terrain Tiles" (Mapzen terrarium encoding), public and free to use with
attribution. Underlying data: SRTM, GMTED2010, USGS NED/3DEP, ETOPO1 and others. See
https://github.com/tilezen/joerd/blob/master/docs/attribution.md

Each region is a 4 x 4 block of 256 px tiles stitched into one 1024 px lossless terrarium WebP
(height_m = R * 256 + G + B / 256 - 32768), plus an entry in regions.json with its scale.
Run from anywhere:  python3 notes/storyboards/terrain/fetch-terrain.py
"""
import io, json, math, urllib.request
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent
URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
N = 4  # tiles per side

REGIONS = [
    # id, label, lat, lon, zoom (picked so each block covers roughly 140 to 260 km)
    ('sierra', 'Sierra Nevada', 37.25, -118.75, 9),
    ('alps', 'Alps, Valais', 46.05, 7.65, 9),
    ('himalaya', 'Himalaya, Everest', 27.95, 86.95, 9),
    ('grandcanyon', 'Grand Canyon', 36.15, -112.15, 9),
    ('denali', 'Alaska Range, Denali', 63.05, -151.0, 8),
]
EARTH_C = 40075016.686


def tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def fetch(z, x, y):
    with urllib.request.urlopen(URL.format(z=z, x=x, y=y), timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def main():
    manifest = []
    for rid, label, lat, lon, z in REGIONS:
        fx, fy = tile_xy(lat, lon, z)
        x0, y0 = math.floor(fx - N / 2 + 0.5), math.floor(fy - N / 2 + 0.5)
        img = Image.new('RGB', (256 * N, 256 * N))
        for j in range(N):
            for i in range(N):
                img.paste(fetch(z, x0 + i, y0 + j), (256 * i, 256 * j))
        px = img.load()
        heights = [px[i, j][0] * 256 + px[i, j][1] + px[i, j][2] / 256 - 32768
                   for j in range(0, img.height, 4) for i in range(0, img.width, 4)]
        # highest point (on a 128 px box-filtered copy, away from the edges): where the jet starts
        small = img.resize((128, 128), Image.BOX).load()
        _, pi, pj = max((small[i, j][0] * 256 + small[i, j][1] + small[i, j][2] / 256 - 32768, i, j)
                        for j in range(16, 112) for i in range(16, 112))
        mpp = EARTH_C * math.cos(math.radians(lat)) / (2 ** z * 256)
        img.save(OUT / f'{rid}.webp', lossless=True, quality=100, method=6)  # lossless: heights must survive exactly
        manifest.append({'id': rid, 'label': label, 'lat': lat, 'lon': lon, 'zoom': z,
                         'size': img.width, 'metersPerPixel': round(mpp, 2),
                         'widthKm': round(mpp * img.width / 1000, 1),
                         'minM': round(min(heights)), 'maxM': round(max(heights)),
                         'peakKm': [round(((pi + 0.5) / 128 - 0.5) * mpp * img.width / 1000, 1),
                                    round(((pj + 0.5) / 128 - 0.5) * mpp * img.width / 1000, 1)]})
        print(manifest[-1])
    (OUT / 'regions.json').write_text(json.dumps(manifest, indent=1) + '\n')


if __name__ == '__main__':
    main()
