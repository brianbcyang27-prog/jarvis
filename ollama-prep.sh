#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
LOG="/tmp/jarvis-ollama-prep.log"

echo "$(date): Starting ollama-prep..." >> "$LOG"

# Kill Ollama.app if running (we want ollama serve)
pkill -f "Ollama.app" 2>/dev/null
sleep 2

# Start ollama serve in background (shows thinking process in terminal)
nohup /usr/local/bin/ollama serve >> /tmp/ollama-serve.log 2>&1 &
OLLAMA_PID=$!
echo "$(date): ollama serve started PID=$OLLAMA_PID" >> "$LOG"

# Wait for Ollama to be ready
for i in {1..20}; do
  curl -s --max-time 2 http://localhost:11434/api/tags > /dev/null 2>&1 && break
  sleep 3
done
echo "$(date): Ollama ready" >> "$LOG"

# Evict heavy models from RAM
for model in granite3.3:8b qwen2.5-coder:7b llama3.1:latest mistral:7b-instruct-q4_K_M qwen2.5:7b-instruct-q4_K_M; do
  curl -s http://localhost:11434/api/generate -d "{\"model\":\"$model\",\"keep_alive\":0}" --max-time 5 > /dev/null 2>&1
done

# Pre-load qwen2.5:3b only
curl -s --max-time 30 http://localhost:11434/api/generate \
  -d '{"model":"qwen2.5:3b","prompt":"ready","stream":false,"options":{"num_predict":1}}' \
  > /dev/null 2>&1

echo "$(date): qwen2.5:3b loaded, prep complete" >> "$LOG"
