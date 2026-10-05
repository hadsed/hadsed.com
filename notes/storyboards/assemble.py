"""Assemble text-free contact sheets from the Blender shot renders."""
from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parent
routes = {
    'a': ['a1-side-follow', 'a2-rise-over-wing', 'a3-rear-settle', 'a4-afterburners', 'a5-departure'],
    'b': ['b1-distant-nose', 'b2-nose-approach', 'b3-retreat-and-rise', 'b4-side-reveal', 'b5-poster-profile'],
}
for route, names in routes.items():
    sheet = Image.new('RGB', (1300, 1100), (19, 27, 31))
    for i, name in enumerate(names):
        image = Image.open(folder / (name + '.png')).convert('RGB')
        x = 330 if i == 4 else (i % 2) * 660
        sheet.paste(image, (x, (i // 2) * 370))
    sheet.save(folder / ('route-' + route + '.png'))
