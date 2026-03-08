#!/bin/sh
# Pinchtab entrypoint: clean stale Chrome locks before starting
# Chrome leaves Singleton lock files behind when it crashes or the
# container is rebuilt. These prevent new Chrome instances from starting.

STATE_DIR="${BRIDGE_STATE_DIR:-/data}"
PROFILES_DIR="${STATE_DIR}/profiles"

if [ -d "$PROFILES_DIR" ]; then
  echo "[entrypoint] Cleaning stale Chrome Singleton locks in $PROFILES_DIR ..."
  find "$PROFILES_DIR" -name "SingletonLock" -delete 2>/dev/null
  find "$PROFILES_DIR" -name "SingletonSocket" -delete 2>/dev/null
  find "$PROFILES_DIR" -name "SingletonCookie" -delete 2>/dev/null
  echo "[entrypoint] Lock cleanup complete."
fi

exec "$@"
