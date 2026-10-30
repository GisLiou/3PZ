#!/usr/bin/env python3
"""並排比對：錄影遊戲區（v5 x60..419,y40..602）｜自己的畫面（360×562 連續截圖）。
用法：sbs.py <v5 資料夾> <我的截圖資料夾> <輸出.png> <影片ms:我的ms> [...]  （各對並排，再橫向排列）"""
import sys, os
from PIL import Image, ImageDraw
v5, mine, out = sys.argv[1:4]
def near(d, ms, ext):
    fs = sorted(f for f in os.listdir(d) if f.endswith(ext) and f[:-len(ext)].isdigit())
    return min(fs, key=lambda f: abs(int(f[:-len(ext)]) - ms))
cols = []
for pair in sys.argv[4:]:
    a, b = map(int, pair.split(':'))
    fa, fb = near(v5, a, '.jpg'), near(mine, b, '.jpg')
    ia = Image.open(os.path.join(v5, fa)).crop((60, 40, 419, 602)).resize((360, 562))
    ib = Image.open(os.path.join(mine, fb)).resize((360, 562))
    c = Image.new('RGB', (724, 580)); c.paste(ia, (0, 18)); c.paste(ib, (364, 18))
    d = ImageDraw.Draw(c); d.text((2, 2), f'video {fa[:-4]}ms', fill=(255, 255, 0)); d.text((366, 2), f'mine {fb[:-4]}ms', fill=(0, 255, 255))
    cols.append(c)
W = sum(c.width for c in cols) + 6 * len(cols)
sh = Image.new('RGB', (W, 580)); x = 0
for c in cols: sh.paste(c, (x, 0)); x += c.width + 6
sh.save(out); print(out)
