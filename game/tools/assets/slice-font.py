#!/usr/bin/env python3
"""點陣字型切字：原版字型圖（UI等/字體/*.png）沒有 .fnt 座標檔。
依透明度把每個字切出來（字內的筆畫以膨脹合併），依「由上而下、由左而右」排序，再對應到人工辨識的字串。
用法：slice-font.py <font.png> <out.json> <字串（依圖中順序，換行不算）> [合併距離=3]
輸出：{"w","h","glyphs":{"字":{x,y,w,h,top}}}；字數不符時報錯，不輸出。"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

src, out, chars = sys.argv[1], sys.argv[2], sys.argv[3]
gap = int(sys.argv[4]) if len(sys.argv) > 4 else 3
im = Image.open(src).convert('RGBA')
a = np.asarray(im)
alpha = a[:, :, 3] > int(__import__("os").environ.get("ATH", "24"))
# 不透明底的字型圖（白底）以亮度判斷
if alpha.mean() > 0.6:
    alpha = a[:, :, :3].mean(2) < 200
lab, n = ndimage.label(ndimage.binary_dilation(alpha, iterations=gap) if gap else alpha)
boxes = []
for s in ndimage.find_objects(lab):
    y, x = s
    if (y.stop - y.start) * (x.stop - x.start) < 30: continue
    boxes.append([x.start + gap, y.start + gap, x.stop - x.start - 2 * gap, y.stop - y.start - 2 * gap])
# 分行：依 y 中心分群
boxes.sort(key=lambda b: b[1] + b[3] / 2)
lines, cur = [], []
for b in boxes:
    if cur and b[1] > max(c[1] + c[3] for c in cur) - 4:
        lines.append(cur); cur = []
    cur.append(b)
if cur: lines.append(cur)
ordered = [b for ln in lines for b in sorted(ln, key=lambda b: b[0])]
if len(ordered) != len(chars):
    sys.exit(f'{src}: 找到 {len(ordered)} 個字，字串有 {len(chars)} 個：' + ' '.join(str(b) for b in ordered))
json.dump({'w': im.width, 'h': im.height, 'glyphs': {c: {'x': b[0], 'y': b[1], 'w': b[2], 'h': b[3], 'top': 0} for c, b in zip(chars, ordered)}}, open(out, 'w'), ensure_ascii=False)
print(src, len(chars), 'glyphs')
