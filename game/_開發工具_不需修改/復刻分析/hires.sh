#!/bin/bash
# 原解析度逐禎截圖（指定時段）：hires.sh <影片檔> <開始ms> <結束ms> <輸出資料夾>
# 檔名＝該禎時間戳（毫秒），與 dump_frames.sh 一致；dump_frames.sh 為節省空間縮到 640 高，細節分析用這支。
set -e
f="$1"; s="$2"; e="$3"; out="$4"
mkdir -p "$out"
ss=$(python3 -c "print(max(0,$s/1000-1))")
ffmpeg -v info -ss "$ss" -copyts -i "$f" -to "$(python3 -c "print($e/1000+0.05)")" -vf showinfo -q:v 2 -fps_mode passthrough "$out/f%07d.jpg" 2> "$out/showinfo.log"
python3 - "$out" "$s" "$e" <<'P'
import re,os,sys
d,s,e=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
ts=[float(m) for m in re.findall(r'pts_time:([0-9.]+)',open(d+'/showinfo.log').read())]
fs=sorted(x for x in os.listdir(d) if x.startswith('f'))
n=0
for f,t in zip(fs,ts):
    ms=round(t*1000)
    if s<=ms<=e: os.rename(f'{d}/{f}',f'{d}/{ms:08d}.jpg'); n+=1
    else: os.remove(f'{d}/{f}')
print(d,n,'frames')
P
