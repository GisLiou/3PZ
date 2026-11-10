#!/usr/bin/env python3
"""無座標圖集切圖：以透明度找出每個零件的外框，輸出座標表（不產生任何新像素）。
畫面上使用時以 CSS background-position 取圖集中的一塊。
用法：slice-atlas.py <atlas.png> <out.json> [alpha 門檻=8] [最小面積=64]
輸出：{"w":圖寬,"h":圖高,"parts":[{"i":序號,"x","y","w","h"}...]}（依由上而下、由左而右排序）"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
th = int(sys.argv[3]) if len(sys.argv) > 3 else 8
amin = int(sys.argv[4]) if len(sys.argv) > 4 else 64
im = Image.open(src).convert('RGBA')
a = np.asarray(im)[:, :, 3] > th
lab, n = ndimage.label(a, structure=np.ones((3, 3)))
parts = []
for s in ndimage.find_objects(lab):
    y, x = s
    w, h = x.stop - x.start, y.stop - y.start
    if w * h >= amin:
        parts.append({'x': x.start, 'y': y.start, 'w': w, 'h': h})
parts.sort(key=lambda p: (p['y'] // 16, p['x']))
for i, p in enumerate(parts): p['i'] = i
json.dump({'w': im.width, 'h': im.height, 'parts': parts}, open(out, 'w'), ensure_ascii=False)
print(src, len(parts), 'parts')
