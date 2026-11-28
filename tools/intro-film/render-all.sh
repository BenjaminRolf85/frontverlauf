#!/bin/bash
# Alle Einstellungen rendern, in Abschnitten zu je 48 Bildern auf JOBS Prozesse verteilt (Standard 2: der Software-Rasterer
# nutzt die Kerne schon selbst, zwei Prozesse bringen noch rund das 1,4-fache, mehr nichts). Setzt nach Abbruch fort:
# vorhandene Bilder werden uebersprungen.
# Render all shots, split into sections of 48 frames across JOBS processes (default 2: the software rasteriser already
# uses the cores itself, two processes still give about 1.4 times, more gives nothing). Resumes after an abort:
# existing frames are skipped.
# PY=/pfad/zu/python-mit-bpy JOBS=2 ./render-all.sh [shot ...]
cd "$(dirname "$0")"
PY=${PY:-python}
JOBS=${JOBS:-2}
SHOTS=${@:-oldworld wrecks chalk skyburns crash bell awaken_nexus awaken_vesper awaken_zyrr gate fracture korvat alvenia dravon velkar meridon banners title}
# Abschnitte "shot first last" aus der Zeitleiste / sections "shot first last" from the timeline
SECTIONS=$(python3 - $SHOTS <<'EOF'
import json, sys
film = json.load(open('../../src/intro/film.json'))
dur = {s['id']: s['end'] - s['start'] for s in film['shots']}
for shot in sys.argv[1:]:
    n = int(round(dur[shot.split('_')[0]] * film['renderFps']))
    for first in range(1, n + 1, 48):
        print(shot, first, min(n, first + 47))
EOF
)
worker() {
  local k=$1 i=0
  while read -r s first last; do
    if (( i % JOBS == k )); then
      echo "== $s $first-$last $(date +%T)"
      FV_RESUME=1 EGL_PLATFORM=${EGL_PLATFORM:-surfaceless} $PY render.py --shot $s --first $first --last $last 2>&1 | grep --line-buffered -E "^(FRAME|BUILD|DONE)|Error|Traceback" | sed -u "s/^/$s /"
    fi
    i=$((i + 1))
  done <<< "$SECTIONS"
}
for ((k = 0; k < JOBS; k++)); do worker $k & done
wait
echo "== ALL DONE $(date +%T)"
