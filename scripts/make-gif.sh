#!/usr/bin/env bash
# Cut a screen recording from START to the end and make a looping GIF.
# Usage: scripts/make-gif.sh input.mp4 [SPEED] [OUT] [WIDTH] [FPS]
#   SPEED  playback multiplier: 1 = real time, 1.5 = 50% faster, 0.8 = slower
#   WIDTH  output width in px (height keeps aspect)
#   FPS    output frame rate (GIF frame delays are 1/100s, so 10, 12.5, 20, 25 are exact)
# Env: START (seconds or mm:ss, default 20)
set -euo pipefail
IN=$1; SPEED=${2:-1}; OUT=${3:-address-to-3d-home.gif}; WIDTH=${4:-960}; FPS=${5:-12.5}
START=${START:-20}
ffmpeg -v error -y -ss "$START" -i "$IN" -filter_complex "\
[0:v]setpts=PTS/${SPEED},fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[a][b];\
[a]palettegen=max_colors=256:stats_mode=diff[p];\
[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
  -loop 0 "$OUT"
ls -la "$OUT"
