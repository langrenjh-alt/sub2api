#!/bin/sh
set -eu

target=${1:?target path is required}
baseline=${2:?baseline path is required}
cp "$baseline" "$target"
printf 'restored %s\n' "$target"
