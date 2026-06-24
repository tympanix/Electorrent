#!/bin/sh

set -e

for script in /docker-entrypoint.d/*.sh; do
  if [ -x "$script" ]; then
    "$script"
  fi
done

exec "$@"
