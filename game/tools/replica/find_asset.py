#!/usr/bin/env python3
"""在全部素材（含已切圖集零件）中找出最像參考畫面某一塊的素材。
用法：find_asset.py <參考圖(已轉成 640 設計寬)> <x,y,w,h> [尺寸容許比例=0.3] [前幾名=5]
比對方式：素材縮放到參考區塊大小，以 alpha 為遮罩算平均色差（越小越像）。"""
import sys, os, json, glob
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..')
ref = Image.open(sys.argv[1]).convert('RGB')
x, y, w, h = map(int, sys.argv[2].split(','))
tol = float(sys.argv[3]) if len(sys.argv) > 3 else 0.3
top = int(sys.argv[4]) if len(sys.argv) > 4 else 5
R = np.asarray(ref.crop((x, y, x + w, y + h)), dtype=float)
cands = []
for f in glob.glob(os.path.join(ROOT, '遊戲素材', 'UI等', '**', '*.png'), recursive=True):
    try:
        im = Image.open(f)
    except Exception:
        continue
    cands.append((f, None, im.size))
for j in glob.glob(os.path.join(ROOT, 'game', 'src', 'data', 'atlas', '*.json')):
    name = os.path.basename(j)[:-5]
    src = {'puzzle_image': '遊戲素材/UI等/戰鬥效果/puzzle_image.png'}.get(name, f'遊戲素材/UI等/界面/resources-iphonehd/{name}.png')
    for p in json.load(open(j))['parts']:
        cands.append((os.path.join(ROOT, src), (p['x'], p['y'], p['w'], p['h'], p['i']), (p['w'], p['h'])))
res = []
cache = {}
for f, part, (aw, ah) in cands:
    if abs(aw / w - 1) > tol or abs(ah / h - 1) > tol: continue
    if f not in cache: cache[f] = Image.open(f).convert('RGBA')
    im = cache[f]
    if part: im = im.crop((part[0], part[1], part[0] + part[2], part[1] + part[3]))
    a = np.asarray(im.resize((w, h)), dtype=float)
    m = a[:, :, 3] > 128
    if m.sum() < 0.2 * w * h: continue
    d = np.abs(a[:, :, :3] - R)[m].mean()
    res.append((d, os.path.relpath(f, ROOT) + (f'#{part[4]}' if part else ''), (aw, ah)))
res.sort()
for r in res[:top]: print(f'{r[0]:6.1f} {r[1]} {r[2]}')
