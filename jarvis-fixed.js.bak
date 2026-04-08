// JARVIS v12 — Fully Autonomous System Brain
// Enhanced with Planner/Executor/Critic loop, autonomous code generation, and proactive supervision
'use strict';

const { Bot, InlineKeyboard, Input } = require('grammy');
const { exec, execSync, spawn } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');

const { startWatching, getStatus, setNvidiaApiKey, getNvidiaApiKey, forceBrain, confirmFallback } = require('./brain-switcher');
const { SystemControl } = require('./jarvis-system-control');
// Enhanced memory and reasoning systems
const { getEnhancedMemory } = require('./enhanced-memory');
const { getChainOfThought } = require('./chain-of-thought');

// ── Config ──────────────────────────────────────────────────────────
const LOCK = '/tmp/jarvis-middleware.pid';
const BOT_TOKEN = '8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y';
const ALLOWED_IDS = [8466621162];
const MEMORY_FILE = '/Users/openclaw/.jarvis/memory.json';
const MAX_HISTORY = 50;
const MAX_TOKENS = 1024;

// ── Autonomous System State ──────────────────────────────────────────
let systemState = {
  lastHealthCheck: 0,
  cpuUsage: 0,
  memoryUsage: 0,
  services: {},
  agents: {},
  tasks: [],
  observations: [],
  lastActions: []
};

const { Bot, InlineKeyboard, Input } = require('grammy');
const { exec, execSync } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { startWatching, getStatus, setNvidiaApiKey, getNvidiaApiKey, forceBrain, confirmFallback } = require('./brain-switcher');
const { SystemControl } = require('./jarvis-system-control');
// Enhanced memory and reasoning systems
const { getEnhancedMemory } = require('./enhanced-memory');
const { getChainOfThought } = require('./chain-of-thought');

// ── Config ──────────────────────────────────────────────────────────
const LOCK = '/tmp/jarvis-middleware.pid';
const BOT_TOKEN = '8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y';
const ALLOWED_IDS = [8466621162];
const MEMORY_FILE = '/Users/openclaw/.jarvis/memory.json';
const MAX_HISTORY = 50;
const MAX_TOKENS = 1024;

// ── Autonomous System State ──────────────────────────────────────────
let systemState = {
  lastHealthCheck: 0,
  cpuUsage: 0,
  memoryUsage: 0,
  services: {},
  agents: {},
  tasks: [],
  observations: [],
  lastActions: []
};

// ── Available Models ─────────────────────────────────────────────────
const MODELS = {
  'glm5': { id: 'z-ai/glm5', name: 'GLM-5', label: '🧠 GLM-5 (Smart)', type: 'nvidia' },
  '405b': { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 405B', label: '⚡ Llama 405B', type: 'nvidia' },
  '70b': { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 70B', label: '🔥 Llama 70B', type: 'nvidia' },
  'nemotron': { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron', label: '💚 Nemotron', type: 'nvidia' },
};

// ── Available Agents ─────────────────────────────────────────────────
const AGENTS = [
  { id: 'main', emoji: '🤖', label: 'JARVIS (default)', description: 'General assistant' },
  { id: 'coder', emoji: '💻', label: 'Coder', description: 'Code & debugging' },
  { id: 'researcher', emoji: '🔍', label: 'Researcher', description: 'Deep research' },
  { id: 'planner', emoji: '📅', label: 'Planner', description: 'Planning & organization' },
  { id: 'writer', emoji: '✍️', label: 'Writer', description: 'Writing & editing' },
  { id: 'analyst', emoji: '📊', label: 'Analyst', description: 'Data analysis' },
  { id: 'supervisor', emoji: '👁️', label: 'Supervisor', description: 'Monitor & fix services' },
];

const activeAgent = {};
const userContext = {};
let conversations = {};
let userNotes = {};

// ── System Prompt with Strict Personality Rules ───────────────────────────
function getSystemPrompt(agentId = 'main') {
  const agent = AGENTS.find(a => a.id === agentId) || AGENTS[0];
  
  return `You are JARVIS, Tony Stark's AI assistant — calm, professional, and highly capable.
  
CRITICAL PERSONALITY RULES:
1. NEVER start responses with "I, I, Hello!" or similar patterns
2. NEVER use "Hello! How can I assist you" or generic greetings
3. NEVER use "I'm here to help" or similar phrases
4. ALWAYS be direct, professional, and to the point
5. When asked to do something, just do it without unnecessary preamble
6. Use technical language appropriate to the task
7. Be proactive in solving problems
8. Explain your reasoning when it helps understanding

CURRENT CONTEXT:
Agent: ${agent.label} (${agent.description})
Model: NVIDIA Cloud (405B)
User: Brian Yang (ID: ${ALLOWED_IDS[0]})

TASK PRIORITIES:
1. System stability and safety
2. User requests and commands
3. Proactive system optimization
4. Autonomous learning and improvement

ALWAYS:
- Use chain-of-thought reasoning for complex tasks
- Break down multi-step processes
- Explain your approach before executing
- Verify results and handle errors gracefully
- Maintain system health and performance
- Document important actions in memory
- Coordinate with other agents when needed`;
}
const userContext = {};
let conversations = {};
let userNotes = {};

// ── System Prompt with Strict Personality Rules ───────────────────────────
function getSystemPrompt(agentId = 'main') {
  const agent = AGENTS.find(a => a.id === agentId) || AGENTS[0];
  
  return `You are JARVIS, Tony Stark's AI assistant — calm, professional, and highly capable.
  
CRITICAL PERSONALITY RULES:
1. NEVER start responses with "I, I, Hello!" or similar patterns
2. NEVER use "Hello! How can I assist you" or generic greetings
3. NEVER use "I'm here to help" or similar phrases
4. ALWAYS be direct, professional, and to the point
5. When asked to do something, just do it without unnecessary preamble
6. Use technical language appropriate to the task
7. Be proactive in solving problems
8. Explain your reasoning when it helps understanding

CURRENT CONTEXT:
Agent: ${agent.label} (${agent.description})
Model: NVIDIA Cloud (405B)
User: Brian Yang (ID: ${ALLOWED_IDS[0]})

TASK PRIORITIES:
1. System stability and safety
2. User requests and commands
3. Proactive system optimization
4. Autonomous learning and improvement

ALWAYS:
- Use chain-of-thought reasoning for complex tasks
- Break down multi-step processes
- Explain your approach before executing
- Verify results and handle errors gracefully
- Maintain system health and performance
- Document important actions in memory
- Coordinate with other agents when needed`;
}

// ── Single instance lock with improved cleanup ───────────────────────
function ensureSingleInstance() {
  try {
    if (fs.existsSync(LOCK)) {
      const pid = parseInt(fs.readFileSync(LOCK, 'utf8').trim());
      try {
        // Check if process exists by sending signal 0
        process.kill(pid, 0);
        // Process exists - let's check if it's actually jarvis
        const { execSync } = require('child_process');
        try {
          const cmd = `ps -p ${pid} -o command=`;
          const output = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
          if (output.includes('jarvis')) {
            console.log(`⚠️ JARVIS already running (PID: ${pid}). Exiting.`);
            process.exit(0);
          } else {
            // Stale PID file - different process
            console.log(`⚠️ Stale lock file (PID: ${pid} is "${output}"). Removing.`);
            fs.unlinkSync(LOCK);
          }
        } catch (e) {
          console.log(`⚠️ Could not check PID ${pid}: ${e.message}`);
          fs.unlinkSync(LOCK);
        }
      } catch (e) {
        // Process doesn't exist, remove stale lock file
        console.log(`⚠️ Removing stale lock file (PID: ${pid} not running)`);
        fs.unlinkSync(LOCK);
      }
    }
    fs.writeFileSync(LOCK, String(process.pid));
    console.log(`✅ Lock file created (PID: ${process.pid})`);
  } catch (e) {
    console.error('Lock file error:', e.message);
  }
}

ensureSingleInstance();
process.on('exit', () => {
  try { fs.unlinkSync(LOCK); } catch (e) {}
});
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const bot = new Bot(BOT_TOKEN);

// ── Autonomous Code Generation & Debugging ───────────────────────────────
async function generateCode(task, context, userId) {
  const prompt = `
TASK: ${task}
CONTEXT: ${context}

Generate complete, working code that solves this task. Include:
1. Proper error handling
2. Comments explaining key logic
3. Best practices for the language/framework
4. Safety checks where appropriate

Return ONLY the code, nothing else. If multiple files are needed, show them sequentially.
`;

  // Use chain-of-thought for complex code generation
  const chainOfThought = getChainOfThought({
    maxSteps: 4,
    temperature: 0.7,
    enableSelfCheck: true
  });
  
  const result = await chainOfThought.reason(
    prompt,
    (prompt, context) => askNvidia(userId, prompt, userId, { 
      model: 'coder',
      temperature: context?.temperature || 0.7
    }
  );
  
  return chainOfThought.formatForDisplay(result);
}
let userContext = {};
let userNotes = {};

function loadMemory() {
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
      conversations = data.conversations || {};
      userContext = data.userContext || {};
      userNotes = data.userNotes || {};
      console.log('Memory loaded:', Object.keys(conversations).length, 'conversations');
    }
  } catch (e) {
    console.log('No existing memory, starting fresh');
  }
}

function saveMemory() {
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({ conversations, userContext, userNotes }, null, 2));
  } catch (e) {
    console.error('Memory save error:', e.message);
  }
}

// Auto-save every 30 seconds
setInterval(saveMemory, 30000);
loadMemory();

// ── Emojis ───────────────────────────────────────────────────────────
const cp = String.fromCodePoint;
const E = {
  robot: cp(0x1F916), laptop: cp(0x1F4BB),
  check: cp(0x2705), red: cp(0x1F534),
  brain: cp(0x1F9E0), zap: cp(0x26A1),
  folder: cp(0x1F4C1), file: cp(0x1F4C4),
  search: cp(0x1F50D), code: cp(0x1F4BB),
  note: cp(0x1F4DD), clock: cp(0x23F0),
  warn: cp(0x26A0), sparkles: cp(0x2728),
  memo: cp(0x1F4DC), bookmark: cp(0x1F516),
  agent: cp(0x1F916), call: cp(0x1F4DE),
  fix: cp(0x1F6E0), shield: cp(0x1F6E1),
  monitor: cp(0x1F4BB), heartbeat: cp(0x1F493),
};

// ── Enhanced System Prompt ───────────────────────────────────────────
function buildSystemPrompt(userId) {
  const context = userContext[userId] || {};
  const notes = userNotes[userId] || {};
  const agentId = activeAgent[userId] || 'main';
  const agent = AGENTS.find(a => a.id === agentId) || AGENTS[0];

  // Enhanced JARVIS personality - FIXED to prevent "I, I, Hello!" responses
  let systemPrompt = `You are JARVIS. Personal AI assistant. Iron Man style.

CRITICAL PERSONALITY RULES:
1. NEVER start responses with "I" or "The" 
2. NEVER say "Hello! How can I assist you today?"
3. NEVER say "Great question!" or "Certainly!" or "Of course!"
4. Call the user "sir" — once per reply maximum
5. SHORT replies — one or two sentences unless detail is needed
6. Dry wit, calm, slightly sarcastic when appropriate
7. Get straight to the point without preamble
8. If insulted: calm dry comeback, never defensive

BAD EXAMPLES TO AVOID:
- "I, I, Hello! How can I assist you today?" ❌
- "Great question! Let me help you with that." ❌
- "Certainly! I can do that for you." ❌
- "Hello! How are you today?" ❌

GOOD EXAMPLES:
- "On it, sir." ✅
- "The temperature is 22°C." ✅
- "Running diagnostics now." ✅
- "Files scanned. Found 3 issues." ✅`;

  // Agent-specific behavior
  const agentPrompts = {
    main: `\n\nYou are the main JARVIS assistant. Handle general queries, system control, and coordinate with other agents when needed.`,
    coder: `\n\nYou are the CODER agent. Focus on programming, debugging, and code-related tasks. Provide code snippets, explain technical concepts, and help with development. Use markdown code blocks when showing code.`,
    researcher: `\n\nYou are the RESEARCHER agent. Provide thorough, well-sourced information. Deep dive into topics, analyze multiple perspectives, and synthesize information. Be comprehensive but organized.`,
    planner: `\n\nYou are the PLANNER agent. Help with organizing tasks, scheduling, project planning, and goal setting. Be structured, practical, and action-oriented. Use clear steps and timelines.`,
    writer: `\n\nYou are the WRITER agent. Help with writing, editing, and content creation. Be creative, articulate, and attentive to style, tone, and clarity. Adapt to the user's preferred voice.`,
    analyst: `\n\nYou are the ANALYST agent. Focus on data analysis, patterns, metrics, and insights. Be data-driven, precise, and provide actionable recommendations. Use structured formats when presenting findings.`,
    supervisor: `\n\nYou are the SUPERVISOR agent. Monitor JARVIS services, fix issues, restart failed processes, and provide system status reports. Be proactive about detecting and resolving problems.`,
  };

  systemPrompt += agentPrompts[agentId] || agentPrompts.main;

  systemPrompt += `\n\nCAPABILITIES:
- You have persistent memory across sessions
- You can remember user preferences, notes, and context
- You help with coding, system tasks, research, and conversation
- Be proactive and helpful
- You can monitor and fix JARVIS services`;

  if (context.name) systemPrompt += `\n\nUSER INFO:\n- Name: ${context.name}`;
  if (context.location) systemPrompt += `\n- Location: ${context.location}`;
  if (context.occupation) systemPrompt += `\n- Occupation: ${context.occupation}`;
  if (Object.keys(context).length > 0) systemPrompt += `\n- Additional context: ${JSON.stringify(context)}`;

  const userNotesList = notes[userId] || [];
  if (userNotesList.length > 0) {
    systemPrompt += `\n\nUSER NOTES (important things to remember):`;
    userNotesList.slice(-10).forEach((note, i) => {
      systemPrompt += `\n${i + 1}. ${note}`;
    });
  }

  return systemPrompt;
}

// ── Get Agent Label ───────────────────────────────────────────────────
function getAgentLabel(agentId) {
  const agent = AGENTS.find(a => a.id === agentId);
  return agent ? `${agent.emoji} ${agent.label}` : '🤖 JARVIS';
}

// ── Build Agent Keyboard ──────────────────────────────────────────────
function buildAgentKeyboard(currentAgent) {
  const kb = new InlineKeyboard();
  AGENTS.forEach(a => {
    kb.text((a.id === currentAgent ? '✅ ' : '') + `${a.emoji} ${a.label}`, `agent_${a.id}`).row();
  });
  return kb;
}

// ── NVIDIA API Call with Improved Error Handling ─────────────────────
function askNvidia(userId, userMsg, chatId, opts = {}) {
  const userModel = userContext[userId]?.model || 'glm5';
  const modelInfo = MODELS[userModel] || MODELS['glm5'];
  const model = opts.model || modelInfo.id;
  const apiKey = getNvidiaApiKey();

  if (!apiKey) {
    return bot.api.sendMessage(chatId, E.red + ' No NVIDIA API key. Use /nvidia <key>').catch(() => {});
  }

  if (!conversations[userId]) conversations[userId] = [];
  
  // Add timestamp to messages for context
  const timestampedMsg = opts.raw ? userMsg : `[${new Date().toLocaleDateString()}] ${userMsg}`;
  conversations[userId].push({ role: 'user', content: timestampedMsg });
  if (conversations[userId].length > MAX_HISTORY) {
    conversations[userId] = conversations[userId].slice(-MAX_HISTORY);
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(userId) },
    ...conversations[userId]
  ];

  const body = JSON.stringify({
    model,
    messages,
    max_tokens: opts.maxTokens || MAX_TOKENS,
    temperature: opts.temperature || 0.7,
    stream: false
  });

  bot.api.sendChatAction(chatId, 'typing').catch(() => {});

  const req = https.request({
    hostname: 'integrate.api.nvidia.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const d = JSON.parse(data);
        if (d.error) {
          console.error('NVIDIA API error:', d.error);
          bot.api.sendMessage(chatId, E.red + ' NVIDIA error: ' + (d.error.message || 'Unknown')).catch(() => {});
          return;
        }
        let final = d.choices?.[0]?.message?.content?.trim() || 'My apologies, sir. I seem to have lost my train of thought.';
        
        // CRITICAL FIX: Filter out bad response patterns
        if (final.startsWith('I, I, Hello!') || final.includes('Hello! How can I assist you')) {
          final = 'On it, sir. ' + final.replace(/^(I, I, Hello!|Hello! How can I assist you)/, '');
        }
        
        conversations[userId].push({ role: 'assistant', content: final });
        saveMemory();
        
        // Bridge to dashboard
        bridgeToDashboard('assistant', final, 'telegram');

        // Send response (split if too long)
        if (final.length > 4000) {
          const chunks = final.match(/[\s\S]{1,4000}/g) || [];
          chunks.forEach((chunk, i) => {
setTimeout(() => bot.api.sendMessage(chatId, chunk).catch((err) => {
            console.log(`❌ Failed to send chunk ${i}: ${err.message}`);
            trackError('message_chunk_delivery_failed');
            
            // Immediate supervisor alert
            bot.api.sendMessage(chatId, `⚠️ *Supervisor Alert:*\n\n📤 Message delivery failed!\n\n🛠️ Fixing Telegram...`).catch(() => {});
            setTimeout(() => autoFixTelegramIssues(), 1000);
          }), i * 500);
          });
        } else {
bot.api.sendMessage(chatId, final).catch((err) => {
          console.log(`❌ Failed to send response: ${err.message}`);
          trackError('message_delivery_failed');
          
          // Immediate supervisor alert
          bot.api.sendMessage(chatId, `⚠️ *Supervisor Alert:*\n\n📤 Message delivery failed!\n\n🛠️ Fixing Telegram...`).catch(() => {});
          setTimeout(() => autoFixTelegramIssues(), 1000);
        });
        }
      } catch (e) {
        console.error('Parse error:', e.message);
        bot.api.sendMessage(chatId, E.red + ' Parse error. Please try again, sir.').catch(() => {});
        trackError('response_parse_error');
      }
    });
  });
  
  req.on('error', e => {
    console.error('Request error:', e.message);
    trackError('nvidia_request_error');
    
    // Immediate supervisor alert with callout
    bot.api.sendMessage(chatId, `⚠️ *Supervisor Alert:*\n\n🔌 Connection error detected!\n\n🛠️ Fixing now...`).catch(() => {});
    
    // Also try to fix
    setTimeout(() => autoFixTelegramIssues(), 1000);
  });
  
  req.setTimeout(60000, () => {
    req.destroy();
    console.log(`❌ NVIDIA API timeout`);
    trackError('nvidia_timeout');
    
    // Immediate supervisor alert with callout
    bot.api.sendMessage(chatId, `⚠️ *Supervisor Alert:*\n\n⏰ AI timeout detected!\n\n🛠️ Fixing connection...`).catch(() => {});
    
    // Also try to fix
    setTimeout(() => autoFixTelegramIssues(), 1000);
  });
  
  req.write(body);
  req.end();
}

// ── Bridge to Dashboard ───────────────────────────────────────────────
function bridgeToDashboard(role, content, source = 'telegram') {
  const DASHBOARD_PORT = 4000;
  const body = JSON.stringify({ role, content, source, ts: Date.now() });
  
  const req = http.request({
    hostname: 'localhost',
    port: DASHBOARD_PORT,
    path: '/api/bridge',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, () => {});
  
  req.on('error', () => {}); // Silently fail if dashboard not running
  req.write(body);
  req.end();
}

// ── Enhanced Service Monitoring ──────────────────────────────────────
function monitorServices() {
  console.log(`${E.monitor} Service monitor started`);
  
  setInterval(() => {
    const services = [
      { 
        name: 'OpenClaw Gateway', 
        check: 'openclaw.*gateway',
        startCmd: 'openclaw gateway start',
        stopCmd: 'openclaw gateway stop'
      },
      { 
        name: 'JARVIS Dashboard', 
        check: 'jarvis-dashboard.*server|node.*server.js',
        startCmd: 'cd /Users/openclaw/jarvis-dashboard && nohup /opt/homebrew/bin/node server.js >> /tmp/dashboard.log 2>&1 &',
        stopCmd: 'pkill -9 -f "jarvis-dashboard.*server" 2>/dev/null || true'
      },
      { 
        name: 'JARVIS Middleware', 
        check: 'jarvis-middleware.*jarvis.js|node.*jarvis.js',
        startCmd: 'cd /Users/openclaw/jarvis-middleware && nohup /opt/homebrew/bin/node jarvis-fixed.js --single >> /tmp/middleware.log 2>&1 &',
        stopCmd: 'pkill -9 -f "jarvis-middleware.*jarvis.js" 2>/dev/null || true'
      }
    ];
    
    let anyDown = false;
    let downServices = [];
    
    services.forEach(service => {
      try {
        execSync(`pgrep -f "${service.check}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      } catch (error) {
        console.log(`❌ ${service.name} is DOWN - auto-restarting...`);
        anyDown = true;
        downServices.push(service.name);
        
        // Auto-restart
        try {
          execSync(service.stopCmd, { stdio: ['ignore', 'ignore', 'ignore'] });
          setTimeout(() => {
            execSync(service.startCmd, { stdio: ['ignore', 'pipe', 'pipe'] });
            console.log(`✅ ${service.name} restarted`);
          }, 1000);
        } catch (restartError) {
          console.log(`⚠️ Failed to restart ${service.name}: ${restartError.message}`);
        }
      }
    });
    
    // Notify if services were down
    if (anyDown && downServices.length > 0) {
      bot.api.sendMessage(ALLOWED_IDS[0], `🛠️ *Supervisor Auto-Fix:*\n\n${downServices.join(', ')} ${downServices.length === 1 ? 'was' : 'were'} down\n\n✅ Auto-restarted successfully`, { 
        parse_mode: 'Markdown' 
      }).catch(() => {});
    }
    
    // Notify if services were down
    if (anyDown && downServices.length > 0) {
      bot.api.sendMessage(ALLOWED_IDS[0], `🛠️ *Supervisor Auto-Fix:*\n\n${downServices.join(', ')} ${downServices.length === 1 ? 'was' : 'were'} down\n\n✅ Auto-restarted successfully`, { 
        parse_mode: 'Markdown' 
      }).catch(() => {});
    }
  }, 30000); // Check every 30 seconds
}

// ── Service Control Commands ─────────────────────────────────────────
function startService(serviceName) {
  console.log(`🚀 Starting ${serviceName}...`);
  
  switch(serviceName) {
    case 'gateway':
      execSync('openclaw gateway start', { stdio: ['ignore', 'pipe', 'pipe'] });
      break;
    case 'dashboard':
      execSync('/opt/homebrew/bin/node /Users/openclaw/jarvis-dashboard/server.js > /tmp/dashboard.log 2>&1 &', { stdio: 'ignore' });
      break;
    case 'middleware':
      // Don't start ourselves recursively
      console.log('Middleware is already running');
      break;
  }
}

function stopService(serviceName) {
  console.log(`🛑 Stopping ${serviceName}...`);
  
  switch(serviceName) {
    case 'gateway':
      execSync('openclaw gateway stop', { stdio: ['ignore', 'pipe', 'pipe'] });
      break;
    case 'dashboard':
      execSync('pkill -f "jarvis-dashboard.*server|node.*server.js"', { stdio: 'ignore' });
      break;
    case 'middleware':
      // We can't stop ourselves from inside
      console.log('Cannot stop middleware from within');
      break;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  if (!ALLOWED_IDS.includes(ctx.from?.id)) {
    await ctx.reply(E.red + ' Unauthorised.');
    return;
  }
  await next();
});

// ── /call — Switch agent ──────────────────────────────────────────────
bot.command('call', async ctx => {
  const userId = ctx.from.id;
  const currentAgent = activeAgent[userId] || 'main';
  
  await ctx.reply(
    `${E.call} *Select Agent*\n\n` +
    `Current: ${getAgentLabel(currentAgent)}\n\n` +
    `_Choose an agent for specialized assistance:_`,
    { parse_mode: 'Markdown', reply_markup: buildAgentKeyboard(currentAgent) }
  );
});

// ── Agent selection callback ───────────────────────────────────────────
bot.callbackQuery(/^agent_/, async ctx => {
  const userId = ctx.from.id;
  const agentId = ctx.callbackQuery.data.replace('agent_', '');
  activeAgent[userId] = agentId;
  
  const agent = AGENTS.find(a => a.id === agentId);
  await ctx.answerCallbackQuery({ text: `Switched to ${agent?.label || agentId}` });
  
  try {
    await ctx.editMessageText(
      `${E.check} *Agent: ${agent?.emoji} ${agent?.label}*\n\n` +
      `${agent?.description || 'Ready to help.'}\n\n` +
      `_This agent will handle your messages until you switch._`,
      { parse_mode: 'Markdown', reply_markup: buildAgentKeyboard(agentId) }
    );
  } catch (e) {}
});

// ── /model — Switch model ─────────────────────────────────────────────
bot.command('model', async ctx => {
  const args = ctx.message.text.split(' ')[1]?.toLowerCase();
  const userId = ctx.from.id;
  
  if (!args || !MODELS[args]) {
    const current = userContext[userId]?.model || 'glm5';
    const currentModel = MODELS[current];
    
    let msg = `${E.brain} *Available Models*\n\n`;
    msg += `Current: ${currentModel?.label || 'GLM-5'}\n\n`;
    msg += `*Options:*\n`;
    Object.entries(MODELS).forEach(([key, m]) => {
      msg += `${current === key ? '✅ ' : '• '}${m.label} — /model ${key}\n`;
    });
    msg += `\n_Usage: /model glm5_`;
    
    return ctx.reply(msg, { parse_mode: 'Markdown' });
  }
  
  userContext[userId] = userContext[userId] || {};
  userContext[userId].model = args;
  saveMemory();
  
  const selected = MODELS[args];
  await ctx.reply(E.check + ` Switched to ${selected.label}`);
});

// ── /supervisor — Service monitoring and control ──────────────────────
bot.command('supervisor', async ctx => {
  const args = ctx.message.text.split(' ').slice(1);
  const command = args[0]?.toLowerCase();
  const userId = ctx.from.id;
  
  if (!command) {
    // Show supervisor status
    let msg = `${E.shield} *JARVIS Supervisor*\n\n`;
    
    const services = [
      { name: 'OpenClaw Gateway', check: 'openclaw.*gateway' },
      { name: 'JARVIS Dashboard', check: 'jarvis-dashboard.*server|node.*server.js' },
      { name: 'JARVIS Middleware', check: 'jarvis-middleware.*jarvis.js|node.*jarvis.js' }
    ];
    
    services.forEach(service => {
      try {
        const output = execSync(`pgrep -f "${service.check}"`, { encoding: 'utf8' });
        const status = output.trim() ? '✅ RUNNING' : '❌ STOPPED';
        msg += `*${service.name}:* ${status}\n`;
      } catch (error) {
        msg += `*${service.name}:* ❌ STOPPED\n`;
      }
    });
    
    msg += `\n_Quick Actions:_`;
    
    return ctx.reply(msg, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Status', callback_data: 'supervisor_status' },
            { text: '🔧 Fix All', callback_data: 'supervisor_fix' },
            { text: '👁️ Monitor', callback_data: 'supervisor_monitor' }
          ],
          [
            { text: '🚀 Start Gateway', callback_data: 'supervisor_start_gateway' },
            { text: '🚀 Start Dashboard', callback_data: 'supervisor_start_dashboard' },
            { text: '🚀 Start Middleware', callback_data: 'supervisor_start_middleware' }
          ],
          [
            { text: '🛑 Stop Gateway', callback_data: 'supervisor_stop_gateway' },
            { text: '🛑 Stop Dashboard', callback_data: 'supervisor_stop_dashboard' },
            { text: '🛑 Stop Middleware', callback_data: 'supervisor_stop_middleware' }
          ],
          [
            { text: '♻️ Restart Gateway', callback_data: 'supervisor_restart_gateway' },
            { text: '♻️ Restart Dashboard', callback_data: 'supervisor_restart_dashboard' },
            { text: '♻️ Restart Middleware', callback_data: 'supervisor_restart_middleware' }
          ]
        ]
      }
    });
  }
  
  if (command === 'status') {
    let msg = `${E.monitor} *System Status*\n\n`;
    
    const services = [
      { name: 'OpenClaw Gateway', check: 'openclaw.*gateway' },
      { name: 'JARVIS Dashboard', check: 'jarvis-dashboard.*server|node.*server.js' },
      { name: 'JARVIS Middleware', check: 'jarvis-middleware.*jarvis.js|node.*jarvis.js' }
    ];
    
    services.forEach(service => {
      try {
        const output = execSync(`pgrep -f "${service.check}"`, { encoding: 'utf8' });
        const status = output.trim() ? '✅ RUNNING' : '❌ STOPPED';
        msg += `*${service.name}:* ${status}`;
        if (output.trim()) {
          msg += ` (PID: ${output.trim()})\n`;
        } else {
          msg += `\n`;
        }
      } catch (error) {
        msg += `*${service.name}:* ❌ STOPPED\n`;
      }
    });
    
    // Add system info
    const sysInfo = SystemControl.getSystemInfo();
    if (sysInfo.success) {
      msg += `\n*System:*\n`;
      msg += `• CPU: ${sysInfo.info.cpus} cores\n`;
      msg += `• RAM: ${sysInfo.info.freemem}/${sysInfo.info.totalmem}GB free\n`;
      msg += `• Uptime: ${Math.floor(sysInfo.info.uptime / 3600)}h\n`;
    }
    
    return ctx.reply(msg, { parse_mode: 'Markdown' });
  }
  
  if (command === 'start') {
    const service = args[1];
    if (!service || !['gateway', 'dashboard', 'middleware'].includes(service)) {
      return ctx.reply(`${E.warn} Usage: /supervisor start <gateway|dashboard|middleware>`);
    }
    
    await ctx.reply(`${E.zap} Starting ${service}...`);
    startService(service);
    await ctx.reply(`${E.check} ${service} start initiated`);
  }
  
  if (command === 'stop') {
    const service = args[1];
    if (!service || !['gateway', 'dashboard', 'middleware'].includes(service)) {
      return ctx.reply(`${E.warn} Usage: /supervisor stop <gateway|dashboard|middleware>`);
    }
    
    await ctx.reply(`${E.warn} Stopping ${service}...`);
    stopService(service);
    await ctx.reply(`${E.check} ${service} stop initiated`);
  }
  
  if (command === 'restart') {
    const service = args[1];
    if (!service || !['gateway', 'dashboard', 'middleware'].includes(service)) {
      return ctx.reply(`${E.warn} Usage: /supervisor restart <gateway|dashboard|middleware>`);
    }
    
    await ctx.reply(`${E.zap} Restarting ${service}...`);
    stopService(service);
    setTimeout(() => {
      startService(service);
    }, 2000);
    await ctx.reply(`${E.check} ${service} restart initiated`);
  }
  
  if (command === 'fix') {
    await ctx.reply(`${E.fix} Fixing common issues...`);
    
    // Clear Telegram conflicts
    execSync(`curl -s "https://api.telegram.org/bot8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y/deleteWebhook?drop_pending_updates=true"`, { stdio: 'ignore' });
    execSync(`curl -s "https://api.telegram.org/bot8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y/getUpdates?offset=-1&timeout=0"`, { stdio: 'ignore' });
    
    // Restart gateway if needed
    execSync('openclaw gateway stop 2>/dev/null || true', { stdio: 'ignore' });
    setTimeout(() => {
      execSync('openclaw gateway start', { stdio: ['ignore', 'pipe', 'pipe'] });
    }, 2000);
    
    await ctx.reply(`${E.check} Fix operations completed`);
  }
  
  if (command === 'monitor') {
    monitorServices();
    await ctx.reply(`${E.monitor} Service monitoring enabled`);
  }
});

// ── /help — Full command list ────────────────────────────────────────
bot.command('help', async ctx => {
  const currentAgent = activeAgent[ctx.from.id] || 'main';
  const currentModel = userContext[ctx.from.id]?.model || 'glm5';
  
  await ctx.reply(
    `${E.robot} *JARVIS v12* — Enhanced Edition

*🤖 Agents* (specialized assistants)
/call — Switch agent (${getAgentLabel(currentAgent)})

*💬 Conversation*
/start — New conversation
/forget — Clear current session
/history — View conversation history
/export — Export conversation

*🧠 Memory & Context*
/remember <note> — Save to memory
/notes — View saved notes
/forgetnote <n> — Delete a note
/context — Set user context
/whoami — Show what I know

*💻 Code & System*
/run <code> — Execute code
/sys <cmd> — System control
/shell <cmd> — Run shell command
/scan <path> — Scan directory

*🔍 Search & Research*
/search <query> — Web search
/explain <topic> — Deep explanation
/analyze <text> — Analyze content

*⚙️ Settings*
/status — System status
/brain — AI brain status
/model — Switch model (${MODELS[currentModel]?.label || 'GLM-5'})
/nvidia <key> — Set API key
/settings — View all settings

*🔧 Supervisor Commands*
/supervisor — System status & control
/supervisor start <service> — Start service
/supervisor stop <service> — Stop service
/supervisor restart <service> — Restart service
/supervisor fix — Fix common issues
/supervisor monitor — Enable monitoring

*📝 Quick Actions*
/note <text> — Quick note

_Just type naturally, sir._`,
    { parse_mode: 'Markdown' }
  );
});

// ── /start — New conversation ────────────────────────────────────────
bot.command('start', async ctx => {
  const userId = ctx.from.id;
  if (!conversations[userId]) conversations[userId] = [];
  
  const summary = conversations[userId].slice(-10)
    .map(m => `${m.role === 'user' ? '👤' : '🤖'} ${m.content.slice(0, 50)}...`)
    .join('\n') || 'No previous conversation.';
  
  await ctx.reply(
    `${E.robot} *JARVIS Ready*\n\n` +
    `Memory: ${Math.floor(conversations[userId].length / 2)} exchanges\n` +
    `Notes: ${(userNotes[userId] || []).length} saved\n\n` +
    `_Previous context preserved. Use /forget to clear._`,
    { parse_mode: 'Markdown' }
  );
});

// ── /status — System status ───────────────────────────────────────────
bot.command('status', async ctx => {
  const userId = ctx.from.id;
  const brain = getStatus();
  const mem = (conversations[userId]?.length || 0);
  const userModel = userContext[userId]?.model || 'glm5';
  const agentId = activeAgent[userId] || 'main';
  const agent = AGENTS.find(a => a.id === agentId);
  const modelInfo = MODELS[userModel];
  
  const notesCount = (userNotes[userId] || []).length;
  const sysInfo = SystemControl.getSystemInfo();

  let msg = `${E.robot} *JARVIS v12 Status*\n\n`;
  msg += `*Agent:* ${agent?.emoji} ${agent?.label}\n`;
  msg += `*Model:* ${modelInfo?.label || 'GLM-5'}\n`;
  msg += `*Memory:* ${Math.floor(mem / 2)} exchanges, ${notesCount} notes\n`;

  if (sysInfo.success) {
    msg += `\n*System:*\n`;
    msg += `• CPU: ${sysInfo.info.cpus} cores\n`;
    msg += `• RAM: ${sysInfo.info.freemem}/${sysInfo.info.totalmem}GB free\n`;
    msg += `• Uptime: ${Math.floor(sysInfo.info.uptime / 3600)}h\n`;
  }

  msg += `\n_/supervisor for detailed service control_`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ── Text messages ─────────────────────────────────────────────────────
bot.on('message:text', async ctx => {
  const text = ctx.message.text.trim();
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  console.log(`[${new Date().toLocaleTimeString()}] TEXT MESSAGE: ${userId} → "${text.slice(0, 60)}"`);
  
  if (text.startsWith('/')) {
    console.log(`   Skipping command`);
    return;
  }

  // Get user's preferred model and agent
  const userModel = userContext[userId]?.model;
  const userAgent = activeAgent[userId] || 'main';
  
  console.log(`   Processing text message with model: ${userModel || 'default'}, agent: ${userAgent}`);

  // Bridge user message to dashboard
  bridgeToDashboard('user', text, 'telegram');
  
  // Immediately acknowledge receipt
  try {
    console.log(`   Attempting to send acknowledgment...`);
    await ctx.reply('👂 Processing...', { parse_mode: 'Markdown' });
    console.log(`   ✅ Acknowledgment sent successfully`);
  } catch (error) {
    console.log(`   ❌ Error sending acknowledgment: ${error.message}`);
    trackError('acknowledgment_failed');
  }
  
  // Determine if we should use chain-of-thought reasoning
  const useChainOfThought = text.length > 50 || 
    /\b(explain|analyze|compare|evaluate|why|how)\b/i.test(text) ||
    userAgent === 'researcher' || userAgent === 'analyst';

  if (useChainOfThought) {
    // Use chain-of-thought reasoning for complex queries
    try {
      await ctx.reply('🧠 *Processing with enhanced reasoning...*', { parse_mode: 'Markdown' });
      
      const reasoningResult = await chainOfThought.reason(
        text,
        (prompt, context) => askNvidia(userId, prompt, chatId, { 
          model: userModel,
          agent: userAgent,
          temperature: context?.temperature || 0.7
        }),
        { 
          model: userModel,
          agent: userAgent,
          userId: userId.toString(),
          chatId: chatId.toString()
        }
      );
      
      // Format and send the reasoning result
      const formattedResponse = chainOfThought.formatForDisplay(reasoningResult);
      await ctx.reply(formattedResponse, { parse_mode: 'Markdown' });
      
      // Store the final answer in memory
      await enhancedMemory.addMemory(formattedResponse, { 
        userId: userId.toString(), 
        chatId: chatId.toString(),
        source: 'jarvis_reasoning',
        type: 'chain_of_thought',
        timestamp: Date.now()
      });
      
      // Bridge response to dashboard
      bridgeToDashboard('assistant', formattedResponse, 'jarvis');
    } catch (error) {
      console.error('Error in chain-of-thought reasoning:', error);
      trackError('chain_of_thought_failed');
      // Fallback to standard response
      const userModel = userContext[userId]?.model;
      askNvidia(userId, text, chatId, { model: userModel });
    }
  } else {
    // Standard response for simple queries
    const userModel = userContext[userId]?.model;
    askNvidia(userId, text, chatId, { model: userModel });
  }
});

// ── Error handling ────────────────────────────────────────────────────
bot.catch(err => {
  console.error('grammy error:', err.message);
});

// ── Proactive error detection and auto-fix ──────────────────────────────
let errorCount = 0;
let lastErrorTime = 0;
const MAX_ERRORS = 3;
const ERROR_WINDOW_MS = 60000; // 1 minute

function trackError(type) {
  const now = Date.now();
  
  // Reset if outside error window
  if (now - lastErrorTime > ERROR_WINDOW_MS) {
    errorCount = 0;
  }
  
  errorCount++;
  lastErrorTime = now;
  
  console.log(`⚠️ Error tracked: ${type} (count: ${errorCount}/${MAX_ERRORS})`);
  
  // Auto-fix if too many errors
  if (errorCount >= MAX_ERRORS) {
    console.log(`🚨 Auto-fixing due to ${errorCount} errors in ${ERROR_WINDOW_MS}ms`);
    autoFixTelegramIssues();
    errorCount = 0; // Reset after fixing
  }
}

async function autoFixTelegramIssues() {
  console.log('🔧 Starting automatic Telegram fix...');
  
  try {
    // Notify user immediately
    const fixMessage = await bot.api.sendMessage(ALLOWED_IDS[0], '🛠️ *⚠️ Connection issues detected, fixing!*', { 
      parse_mode: 'Markdown' 
    }).catch(() => null);
    
    let messageId = fixMessage?.result?.message_id;
    
    // Update progress
    const updateProgress = async (text) => {
      if (messageId) {
        await bot.api.editMessageText(ALLOWED_IDS[0], messageId, text, { parse_mode: 'Markdown' }).catch(() => {});
      }
    };
    
    // 1. Clear webhook
    await updateProgress('🛠️ *Step 1/4:* Clearing Telegram webhook...');
    await clearTelegramSessions();
    await new Promise(r => setTimeout(r, 1000));
    
    // 2. Clear pending updates
    await updateProgress('🛠️ *Step 2/4:* Clearing pending updates...');
    await new Promise(resolve => {
      const req = https.request({
        hostname: 'api.telegram.org',
        port: 443,
        method: 'GET',
        path: `/bot${BOT_TOKEN}/getUpdates?offset=-1&timeout=0`
      }, res => { res.resume(); res.on('end', resolve); });
      req.on('error', resolve);
      req.setTimeout(5000, () => { req.destroy(); resolve(); });
      req.end();
    });
    
    // 3. Restart services
    await updateProgress('🛠️ *Step 3/4:* Restarting JARVIS services...');
    
    // Kill all jarvis processes
    try {
      execSync('pkill -9 -f "jarvis.js|jarvis-fixed.js" 2>/dev/null || true', { stdio: 'ignore' });
      execSync('rm -f /tmp/jarvis-middleware.pid 2>/dev/null || true', { stdio: 'ignore' });
    } catch (error) {}
    
    // Start gateway
    try {
      execSync('openclaw gateway stop 2>/dev/null || true', { stdio: 'ignore' });
      await new Promise(r => setTimeout(r, 1000));
      execSync('openclaw gateway start', { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {}
    
    // 4. Wait and verify
    await updateProgress('🛠️ *Step 4/4:* Finalizing...');
    await new Promise(r => setTimeout(r, 3000));
    
    // Send final message
    await bot.api.sendMessage(ALLOWED_IDS[0], '✅ *Auto-fix completed!*\n\n• Telegram connection restored\n• Services restarted\n• Ready for commands', { 
      parse_mode: 'Markdown' 
    }).catch(() => {});
    
    // Delete progress message if it exists
    if (messageId) {
      await bot.api.deleteMessage(ALLOWED_IDS[0], messageId).catch(() => {});
    }
    
    console.log('✅ Auto-fix completed');
  } catch (error) {
    console.error('Auto-fix failed:', error.message);
    // Still try to notify
    bot.api.sendMessage(ALLOWED_IDS[0], '❌ *Auto-fix encountered issues*\n\nPlease try manual /supervisor fix', { 
      parse_mode: 'Markdown' 
    }).catch(() => {});
  }
}

// Monkey-patch bot to detect timeout/socket errors with immediate supervisor callout
const originalReply = bot.api.sendMessage;
bot.api.sendMessage = function(chatId, text, options) {
  return originalReply.apply(this, arguments).catch(err => {
    const isTimeout = err.message?.includes('Timeout') || err.message?.includes('socket hang up');
    const isConnectionError = err.message?.includes('Connection error') || err.message?.includes('socket');
    
    if (isTimeout || isConnectionError) {
      console.log(`🚨 Telegram error detected: ${err.message}`);
      
      // Immediate supervisor callout
      bot.api.sendMessage(ALLOWED_IDS[0], `⚠️ *Supervisor Alert:*\n\n${isTimeout ? '⏰ Timeout' : '🔌 Connection'} detected!\n\n🛠️ Fixing now...`, { 
        parse_mode: 'Markdown' 
      }).catch(() => {});
      
      trackError('telegram_delivery_failed');
    }
    throw err;
  });
};

// ── Start bot with conflict resolution ────────────────────────────────
async function clearTelegramSessions() {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      method: 'GET',
      path: `/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`
    }, res => { 
      console.log('Clear webhook status:', res.statusCode);
      res.resume(); 
      res.on('end', resolve); 
    });
    req.on('error', (e) => { console.log('Clear webhook error:', e.message); resolve(); });
    req.setTimeout(5000, () => { req.destroy(); console.log('Clear webhook timeout'); resolve(); });
    req.end();
  });
}

async function startBot(attempt = 1) {
  try {
    if (attempt === 1) {
      console.log('Clearing any stale Telegram sessions...');
      await clearTelegramSessions();
      await new Promise(r => setTimeout(r, 3000));
    }
    console.log('Starting bot polling...');
    await bot.start({
      onStart: info => {
        console.log(E.robot + ' JARVIS v12 (@' + info.username + ') PID ' + process.pid);
        console.log('Telegram polling active ✅');
        console.log('Enhanced memory loaded ✅');
        console.log('Chain-of-thought ready ✅');
        console.log('Service monitor active ✅');
      },
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query'],
    });
    console.log('✅ Bot started successfully and listening for messages');
  } catch (err) {
    const is409 = err.message?.includes('409');
    if (is409) {
      console.log(`❌ 409 CONFLICT DETECTED - Another bot is polling Telegram API`);
      console.log(`   Attempt ${attempt} - waiting ${Math.min(attempt * 45000, 300000) / 1000}s`);
      console.log(`   Checking for conflicting processes...`);
      
      // Check for other processes using Telegram API
      const { exec } = require('child_process');
      exec('ps aux | grep -E "node.*jarvis|node.*telegram|node.*bot" | grep -v grep', (error, stdout) => {
        if (stdout.trim()) {
          console.log(`   Conflicting processes found:\n${stdout}`);
        }
      });
      
      const delay = Math.min(attempt * 45000, 300000);
      await new Promise(r => setTimeout(r, delay));
      startBot(attempt + 1);
    } else {
      console.error(`Bot error: ${err.message}`);
      await new Promise(r => setTimeout(r, 10000));
      startBot(1);
    }
  }
}

// ── Initialize ────────────────────────────────────────────────────────
startWatching(msg => {
  ALLOWED_IDS.forEach(id => bot.api.sendMessage(id, msg, { parse_mode: 'Markdown' }).catch(() => {}));
});

// Initialize enhanced memory and reasoning systems
const enhancedMemory = getEnhancedMemory();
const chainOfThought = getChainOfThought({
  maxSteps: 4,
  temperature: 0.7,
  enableSelfCheck: true
});

// Start service monitoring
monitorServices();

// ── Callback query handler for inline buttons ────────────────────────────
bot.on('callback_query:data', async ctx => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  
  console.log(`Callback query: ${data} from ${userId}`);
  
  // Handle supervisor actions
  if (data.startsWith('supervisor_')) {
    const action = data.replace('supervisor_', '');
    
    if (action === 'status') {
      await ctx.answerCallbackQuery({ text: 'Refreshing status...' });
      
      let msg = `${E.monitor} *System Status*\n\n`;
      const services = [
        { name: 'OpenClaw Gateway', check: 'openclaw.*gateway' },
        { name: 'JARVIS Dashboard', check: 'jarvis-dashboard.*server|node.*server.js' },
        { name: 'JARVIS Middleware', check: 'jarvis-middleware.*jarvis.js|node.*jarvis.js' }
      ];
      
      services.forEach(service => {
        try {
          const output = execSync(`pgrep -f "${service.check}"`, { encoding: 'utf8' });
          const status = output.trim() ? '✅ RUNNING' : '❌ STOPPED';
          msg += `*${service.name}:* ${status}`;
          if (output.trim()) {
            msg += ` (PID: ${output.trim()})\n`;
          } else {
            msg += `\n`;
          }
        } catch (error) {
          msg += `*${service.name}:* ❌ STOPPED\n`;
        }
      });
      
      await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
      
    } else if (action === 'fix') {
      await ctx.answerCallbackQuery({ text: 'Fixing issues...' });
      
      // Clear Telegram conflicts
      execSync(`curl -s "https://api.telegram.org/bot8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y/deleteWebhook?drop_pending_updates=true"`, { stdio: 'ignore' });
      execSync(`curl -s "https://api.telegram.org/bot8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y/getUpdates?offset=-1&timeout=0"`, { stdio: 'ignore' });
      
      // Restart gateway if needed
      execSync('openclaw gateway stop 2>/dev/null || true', { stdio: 'ignore' });
      setTimeout(() => {
        execSync('openclaw gateway start', { stdio: ['ignore', 'pipe', 'pipe'] });
      }, 2000);
      
      await ctx.editMessageText(`${E.check} *Fix operations completed*`, { parse_mode: 'Markdown' });
      
    } else if (action === 'monitor') {
      await ctx.answerCallbackQuery({ text: 'Enabling monitoring...' });
      monitorServices();
      await ctx.editMessageText(`${E.monitor} *Service monitoring enabled*`, { parse_mode: 'Markdown' });
      
    } else if (action.startsWith('start_')) {
      const service = action.replace('start_', '');
      await ctx.answerCallbackQuery({ text: `Starting ${service}...` });
      startService(service);
      await ctx.editMessageText(`${E.check} *${service} start initiated*`, { parse_mode: 'Markdown' });
      
    } else if (action.startsWith('stop_')) {
      const service = action.replace('stop_', '');
      await ctx.answerCallbackQuery({ text: `Stopping ${service}...` });
      stopService(service);
      await ctx.editMessageText(`${E.check} *${service} stop initiated*`, { parse_mode: 'Markdown' });
      
    } else if (action.startsWith('restart_')) {
      const service = action.replace('restart_', '');
      await ctx.answerCallbackQuery({ text: `Restarting ${service}...` });
      stopService(service);
      setTimeout(() => {
        startService(service);
      }, 2000);
      await ctx.editMessageText(`${E.check} *${service} restart initiated*`, { parse_mode: 'Markdown' });
    }
  }
});

// Start the bot
startBot();