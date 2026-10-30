#!/usr/bin/env python3
"""逐禎辨識某個位置正在顯示圖集的哪個零件（含 0/90/-90/180 旋轉、縮放與位移搜尋）。
用法：match_parts.py <frames_dir> <start_ms> <end_ms> <crop x0,y0,x1,y1> <atlas.png> <atlas.json> <零件序號,...|color:G> [縮放下限,上限] [背景 r,g,b]
輸出每禎：ms 最像零件(旋轉) 差異值，第二名
color:X 會自動挑出主色符合的零件（B 藍 R 紅 G 綠 V 紫 S 灰 P 桃）"""
import sys, os, json
import numpy as np, cv2
from PIL import Image

d, s, e = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
crop = tuple(map(int, sys.argv[4].split(',')))
A = Image.open(sys.argv[5]).convert('RGBA')
J = json.load(open(sys.argv[6]))['parts']
sel = sys.argv[7]
lo, hi = map(float, (sys.argv[8] if len(sys.argv) > 8 else '0.42,0.6').split(','))
bgc = np.array(list(map(float, (sys.argv[9] if len(sys.argv) > 9 else '120,100,70').split(','))), np.float32)

def hue_ok(p, k):
    c = np.asarray(A.crop((p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h'])), dtype=float)
    m = c[:, :, 3] > 200
    if m.sum() < 800: return False
    r, g, b = c[m][:, :3].mean(0)
    sat = max(r, g, b) - min(r, g, b)
    return {'B': b > r + 40 and b > g, 'R': r > g + 60 and r > b + 40, 'G': g > r + 30 and g > b,
            'V': r > g + 30 and b > g + 30, 'S': sat < 25 and r > 110, 'P': r > 200 and g > 150 and b > 120 and r > b + 30}[k]

ids = [p['i'] for p in J if hue_ok(p, sel[6:])] if sel.startswith('color:') else list(map(int, sel.split(',')))
T = {}
for i in ids:
    p = J[i]; c = A.crop((p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h']))
    for r in (0, 90, -90, 180): T[(i, r)] = c.rotate(r, expand=True)
fs = [f for f in sorted(os.listdir(d)) if f.endswith('.jpg') and s <= int(f[:-4]) <= e]
print('parts', ids)
for f in fs:
    R = np.asarray(Image.open(os.path.join(d, f)).convert('RGB').crop(crop), dtype=np.float32)
    best = []
    for k, c in T.items():
        bb = 1e9
        for sc in np.arange(lo, hi, 0.02):
            t = c.resize((max(1, round(c.width * sc)), max(1, round(c.height * sc))), Image.LANCZOS)
            a = np.asarray(t, dtype=np.float32)
            if a.shape[0] > R.shape[0] or a.shape[1] > R.shape[1]: continue
            al = a[:, :, 3:] / 255
            m = (al > 0.5).astype(np.float32)
            comp = a[:, :, :3]
            r = cv2.matchTemplate(R, comp, cv2.TM_SQDIFF, mask=np.repeat(m, 3, 2))
            bb = min(bb, float(r.min()) / max(1, m.sum() * 3))
        best.append((bb, k))
    best.sort()
    print(int(f[:-4]), best[0][1], round(best[0][0]), best[1][1], round(best[1][0]))
