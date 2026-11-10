#!/bin/bash
# dump every frame of every reference video; files are renamed to <timestamp in ms>.jpg
cd "$(dirname "$0")/../../../參考資料"
i=0
for f in *.mp4; do i=$((i+1)); d=${FRAMES:-$HOME/frames}/v$i; rm -rf $d; mkdir -p $d
  printf "%s\t%s\n" "$i" "$f" >> ${FRAMES:-$HOME/frames}/index.tsv
  ffmpeg -v info -i "$f" -vf "scale=-2:'min(640,ih)',showinfo" -q:v 4 -fps_mode passthrough "$d/f%07d.jpg" 2> $d/showinfo.log
  python3 - "$d" <<'P'
import re,os,sys
d=sys.argv[1];ts=[float(m) for m in re.findall(r'pts_time:([0-9.]+)',open(d+'/showinfo.log').read())]
fs=sorted(x for x in os.listdir(d) if x.startswith('f'))
for k,(f,t) in enumerate(zip(fs,ts)):os.rename(f'{d}/{f}',f'{d}/{round(t*1000):08d}.jpg')
print(d,len(fs),len(ts))
P
done
echo DONE
