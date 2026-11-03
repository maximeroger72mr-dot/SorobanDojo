#!/usr/bin/env bash
# Crée la publication « Dernière version » si elle n'existe pas encore (appelé par chaque job).
for essai in 1 2 3; do
  gh release view derniere-version >/dev/null 2>&1 && exit 0
  gh release create derniere-version --title "Dernière version" \
    --notes "Versions construites automatiquement à chaque mise à jour. Windows : Soroban-…-Windows.exe (aucune installation). Mac : Soroban-…-Mac.dmg. Tous systèmes : Soroban.html (s'ouvre dans le navigateur)." \
    && exit 0
  sleep 5
done
gh release view derniere-version >/dev/null 2>&1
