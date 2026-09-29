#!/bin/bash
mkdir -p public/clips
rm -f public/clips/*.mp4

V0="public/cleveland_clinic_1.mp4_v1 (1080p) (1).mp4"
V1="public/nike_pitch_nov_25.mp4_v1 (1080p).mp4"
COUNT=15   # use 12 for the hero and tunnel pages
LEN=4

for ((i=0; i<COUNT; i++)); do
  v=$((i % 2)); slot=$((i / 2)); slots=$(( (COUNT - v + 1) / 2 ))
  if [ "$v" -eq 0 ]; then F="$V0"; else F="$V1"; fi

  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$F")
  ss=$(awk -v d="$dur" -v l=$LEN -v s=$slot -v n=$slots 'BEGIN{printf "%.2f",(d-l)*s/n}')
  nn=$(printf "%02d" $((i+1)))

  ffmpeg -y -loglevel error -ss "$ss" -t $LEN -i "$F" \
    -vf "scale=640:-2,fps=24" -c:v libx264 -profile:v main -crf 28 -preset slow \
    -pix_fmt yuv420p -an -movflags +faststart "public/clips/clip-$nn.mp4"
  echo "clip-$nn  <-  $(basename "$F")  @ ${ss}s"
done
ls -lh public/clips