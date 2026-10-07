#!/bin/sh
# Optionally pull the latest code from the remote before starting,
# so a plain `docker start` picks up new commits without a rebuild.
if [ "$UPDATE_ON_START" = "1" ]; then
  echo "UPDATE_ON_START=1: pulling latest code..."
  git -C /app pull --ff-only || echo "git pull failed, continuing with bundled code"
fi
exec "$@"
