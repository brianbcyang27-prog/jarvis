#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="/Users/openclaw"

LOCK="/tmp/jarvis-middleware.pid"
LOG="/tmp/jarvis-middleware.log"
BOT_TOKEN="8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y"

log() {
	echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG"
}

log "=== JARVIS STARTUP ==="

# Kill existing process
if [ -f "$LOCK" ]; then
	OLD=$(cat "$LOCK" 2>/dev/null)
	[ -n "$OLD" ] && kill -9 "$OLD" 2>/dev/null
	rm -f "$LOCK"
fi

# Wait for OpenClaw gateway
log "Waiting for OpenClaw gateway..."
for i in {1..30}; do
	/usr/bin/curl -s http://localhost:18789/health > /dev/null 2>&1 && break
	sleep 2
done
log "OpenClaw gateway OK"

# Wait for network and clear Telegram sessions
log "Waiting for network..."
for i in {1..30}; do
	/usr/bin/curl -s --max-time 3 https://api.telegram.org > /dev/null 2>&1 && break
	sleep 2
done
log "Network OK"

# Clear Telegram webhook and pending updates
log "Clearing Telegram session..."
/usr/bin/curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true" > /dev/null 2>&1
/usr/bin/curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1" > /dev/null 2>&1

# Small delay for Telegram rate limit
sleep 5

log "Starting JARVIS bot..."
exec /opt/homebrew/bin/node /Users/openclaw/jarvis-middleware/jarvis-fixed.js --single
