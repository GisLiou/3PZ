#!/usr/bin/env python3
"""環境變數 CROP=x0,y0,x1,y1 可只取影片的一塊。
把一段時間內的逐禎截圖排成接觸表（每格標註毫秒），用來逐禎檢視動畫。
用法：sheet.py <frames_dir> <start_ms> <end_ms> <out.png> [每隔幾禎取一張=1] [欄數=8] [縮圖高=240]"""
import sys, os
from PIL import Image, ImageDraw

d, s, e, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
step = int(sys.argv[5]) if len(sys.argv) > 5 else 1
cols = int(sys.argv[6]) if len(sys.argv) > 6 else 8
th = int(sys.argv[7]) if len(sys.argv) > 7 else 240
fs = [f for f in sorted(os.listdir(d)) if f.endswith('.jpg') and s <= int(f[:-4]) <= e][::step]
if not fs: sys.exit('no frames')
CROP = tuple(map(int, os.environ['CROP'].split(','))) if os.environ.get('CROP') else None
open_ = lambda f: (lambda im: im.crop(CROP) if CROP else im)(Image.open(os.path.join(d, f)))
im0 = open_(fs[0])
tw = round(im0.width * th / im0.height)
rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 14)), (0, 0, 0))
dr = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    x, y = (i % cols) * tw, (i // cols) * (th + 14)
    sheet.paste(open_(f).resize((tw, th)), (x, y + 14))
    dr.text((x + 2, y + 1), f'{int(f[:-4])}ms', fill=(255, 255, 0))
sheet.save(out)
print(out, len(fs), 'frames')
