#!/usr/bin/env bash
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
exec 9>/run/lock/drawing-deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }

base=/opt/drawing
cd "$base/repo"
[[ $(runuser -u rocky -- git branch --show-current) == main ]]
[[ -z $(runuser -u rocky -- git status --porcelain) ]] || {
    echo 'The Git checkout has local changes; deployment stopped.' >&2
    exit 1
}
runuser -u rocky -- git pull --ff-only origin main
commit=$(runuser -u rocky -- git rev-parse HEAD)

# Web builds need the development dependencies, but no Electron binary.
runuser -u rocky -- env ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --include=dev --no-audit --no-fund
runuser -u rocky -- npm run build
[[ -s dist/index.html && -s dist/sw.js && -s dist/manifest.webmanifest ]]

release=$(mktemp -d "$base/releases/${commit:0:12}.XXXXXX")
cp -a dist/. "$release/"
chown -R root:root "$release"
chmod -R a+rX "$release"

next="$base/html.next"
ln -s "$release" "$next"
trap 'rm -f "$next"' EXIT

# Keep the original uploaded files when switching to Git deployment.
backup=''
if [[ -d "$base/html" && ! -L "$base/html" ]]; then
    backup="$base/releases/before-git-$(date -u +%Y%m%dT%H%M%SZ)"
    mv "$base/html" "$backup"
fi
if ! mv -Tf "$next" "$base/html"; then
    [[ -z "$backup" ]] || mv "$backup" "$base/html"
    exit 1
fi

printf '%s\n' "$commit" > "$base/deployed-commit"
printf 'Deployed commit: %s\nRelease: %s\n' "$commit" "$release"
[[ -z "$backup" ]] || printf 'Previous files: %s\n' "$backup"
