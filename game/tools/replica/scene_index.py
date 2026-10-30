#!/usr/bin/env python3
"""參考影片場景索引：讀取逐禎截圖（檔名＝毫秒時間戳），算出每禎與上一禎的差異，
找出畫面切換點，輸出 <frames>/scenes.tsv（start_ms, end_ms, frames, 平均差異）。
用法：scene_index.py /home/claude/frames/v5 [threshold]"""
import sys, os
import numpy as np
from PIL import Image

d = sys.argv[1]
th = float(sys.argv[2]) if len(sys.argv) > 2 else 28.0
fs = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
prev = None
diffs = []
for f in fs:
    a = np.asarray(Image.open(os.path.join(d, f)).convert('L').resize((36, 64)), dtype=np.float32)
    diffs.append(0.0 if prev is None else float(np.abs(a - prev).mean()))
    prev = a
ms = [int(f[:-4]) for f in fs]
with open(os.path.join(d, 'diffs.tsv'), 'w') as o:
    for t, v in zip(ms, diffs): o.write(f'{t}\t{v:.2f}\n')
cuts = [0] + [i for i, v in enumerate(diffs) if v > th] + [len(fs)]
with open(os.path.join(d, 'scenes.tsv'), 'w') as o:
    o.write('start_ms\tend_ms\tframes\tmean_diff\n')
    for a, b in zip(cuts, cuts[1:]):
        if b <= a: continue
        o.write(f'{ms[a]}\t{ms[b-1]}\t{b-a}\t{np.mean(diffs[a+1:b]) if b-a>1 else 0:.2f}\n')
print(d, len(fs), 'frames', len(cuts) - 1, 'scenes')
