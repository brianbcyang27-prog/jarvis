// brain-switcher.js v4 — NVIDIA only, ask user before fallback
const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const fs = require('fs');

const CONFIG = '/Users/openclaw/.openclaw/openclaw.json';
const LOG = '/tmp/jarvis-brain.log';
const OPENCLAW_GATEWAY = 'ai.openclaw.gateway';

// NVIDIA API config
let NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

const MODELS = {
  nvidia: { provider:'nvidia', model:'meta/llama-3.1-405b-instruct', label:'⚡ NVIDIA Cloud (405B)', type:'nvidia' },
  local: { provider:'ollama', model:'qwen2.5:3b', label:'🤏 M2 Local (3b)', type:'ollama' },
};

let currentBrain = null;
let notifyCallback = null;
let pendingFallback = false;

function log(msg) {
  const line = `${new Date().toLocaleTimeString()} ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

function setNvidiaApiKey(key) {
  NVIDIA_API_KEY = key;
  log(`🔑 NVIDIA API key set (${key.slice(0,8)}...)`);
}

function getNvidiaApiKey() {
  return NVIDIA_API_KEY;
}

function pingNvidia(callback) {
  if (!NVIDIA_API_KEY) {
    callback(false);
    return;
  }
  const body = JSON.stringify({
    model: 'meta/llama-3.1-405b-instruct',
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 5,
    stream: false
  });
  const req = https.request({
    hostname: 'integrate.api.nvidia.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${NVIDIA_API_KEY}`
    }
  }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const d = JSON.parse(data);
        callback(res.statusCode === 200);
      } catch(e) { callback(false); }
    });
  });
  req.on('error', () => callback(false));
  req.setTimeout(10000, () => { req.destroy(); callback(false); });
  req.write(body);
  req.end();
}

function switchBrain(target) {
  if (currentBrain === target) return;
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

    // Ensure NVIDIA provider exists
    if (!data.models.providers['nvidia']) {
      data.models.providers['nvidia'] = {
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKey: NVIDIA_API_KEY || 'nvapi-xxx',
        api: 'openai-completions',
        models: [
          { id:'meta/llama-3.1-405b-instruct', name:'llama-3.1-405b-instruct', api:'openai-completions', contextWindow:131072, maxTokens:4096 },
          { id:'meta/llama-3.1-70b-instruct', name:'llama-3.1-70b-instruct', api:'openai-completions', contextWindow:131072, maxTokens:4096 },
        ]
      };
    }

    // Update NVIDIA API key
    if (NVIDIA_API_KEY && data.models.providers['nvidia']) {
      data.models.providers['nvidia'].apiKey = NVIDIA_API_KEY;
    }

    // Ensure ollama provider for local fallback
    if (!data.models.providers['ollama']) {
      data.models.providers['ollama'] = {
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'ollama',
        api: 'ollama',
        models: [
          { id:'qwen2.5:3b', name:'qwen2.5:3b', api:'ollama', contextWindow:32768, maxTokens:2048 },
        ]
      };
    }

    const { provider, model, label } = MODELS[target];
    data.agents.defaults.model = { primary: `${provider}/${model}` };
    fs.writeFileSync(CONFIG, JSON.stringify(data, null, 2));

    // Restart gateway
    exec(`launchctl kickstart -k gui/$(id -u)/${OPENCLAW_GATEWAY} 2>/dev/null || /opt/homebrew/bin/openclaw gateway restart`, 
    { timeout: 10000 }, (err) => {
      const prev = currentBrain;
      currentBrain = target;
      log(`✅ Switched to ${label}${err?' (soft restart)':' + gateway restarted'}`);
      if (notifyCallback && prev !== null) {
        const messages = {
          nvidia: `⚡ *NVIDIA Cloud Brain Online!*\nUsing \`llama-3.1-405b-instruct\` — maximum power, sir.`,
          local: `🤏 *Local Fallback Active*\nUsing \`qwen2.5:3b\` on M2.`
        };
        notifyCallback(messages[target] || `Switched to ${label}`);
      }
    });
  } catch(e) { log(`❌ Switch failed: ${e.message}`); }
}

function requestFallbackPermission() {
  if (pendingFallback) return;
  pendingFallback = true;
  
  if (notifyCallback) {
    notifyCallback(`🔴 *NVIDIA API Unreachable!*\n\nShould I switch to local M2 (qwen2.5:3b)?\n\nReply:\n• \`/yes\` — switch to local\n• \`/no\` — keep trying NVIDIA`);
  }
}

function confirmFallback(useLocal) {
  pendingFallback = false;
  if (useLocal) {
    log('📱 User approved fallback to local');
    switchBrain('local');
  } else {
    log('🔄 User wants to keep trying NVIDIA');
    // Will retry on next check interval
  }
}

function startWatching(onNotify) {
  notifyCallback = onNotify;
  log('👁️ Brain watcher v4 started — NVIDIA only, ask before fallback');

  function check() {
    // Always try NVIDIA first
    if (NVIDIA_API_KEY && !pendingFallback) {
      pingNvidia((nvidiaOk) => {
        if (nvidiaOk) {
          if (currentBrain !== 'nvidia') {
            log('🟢 NVIDIA API confirmed');
            switchBrain('nvidia');
          }
        } else {
          // NVIDIA failed
          if (currentBrain === 'nvidia' || currentBrain === null) {
            log('🔴 NVIDIA API failed — asking user for permission to fallback');
            requestFallbackPermission();
          }
        }
      });
    }
  }

  check();
  setInterval(check, 30000);
}

function getStatus() {
  return { 
    current: currentBrain, 
    label: currentBrain ? MODELS[currentBrain].label : 'unknown', 
    type: currentBrain ? MODELS[currentBrain].type : 'unknown' 
  };
}

function forceBrain(target) {
  pendingFallback = false;
  log(`🎯 Manual override: ${target}`);
  currentBrain = target;
  switchBrain(target);
}

module.exports = { 
  startWatching, 
  getStatus, 
  setNvidiaApiKey, 
  getNvidiaApiKey, 
  pingNvidia, 
  forceBrain,
  confirmFallback 
};
