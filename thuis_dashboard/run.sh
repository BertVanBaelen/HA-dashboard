#!/usr/bin/with-contenv bashio
set -e

export LOG_LEVEL="$(bashio::config 'log_level' 'info')"
export PORT=8099
export DATA_FILE=/data/preferences.json

bashio::log.info "Thuis Dashboard starten..."
cd /app
exec node server/index.js
