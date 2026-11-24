#!/bin/bash
# Alle Einstellungen nacheinander rendern (setzt nach Abbruch fort) / render all shots in sequence (resumes after an abort)
# PY=/pfad/zu/python-mit-bpy ./render-all.sh [shot ...]
cd "$(dirname "$0")"
PY=${PY:-python}
SHOTS=${@:-verdan wrecks chalk skyburns crash bell awaken_nexus awaken_vesper awaken_zyrr gate fracture korvat alvenia dravon velkar meridon banners title}
for s in $SHOTS; do
  echo "== $s $(date +%T)"
  FV_RESUME=1 EGL_PLATFORM=${EGL_PLATFORM:-surfaceless} $PY render.py --shot $s 2>&1 | grep --line-buffered -E "^(FRAME|BUILD|DONE)|Error|Traceback"
done
echo "== ALL DONE $(date +%T)"
