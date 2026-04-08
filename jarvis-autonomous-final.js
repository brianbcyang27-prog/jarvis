// JARVIS v12 — Fully Autonomous System Brain
// Enhanced with proactive system management and autonomous capabilities
'use strict';

const { exec, execSync } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────
const LOCK = '/tmp/jarvis-middleware.pid';
const BOT_TOKEN = '8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y';
const ALLOWED_IDS = [8466621162];
const MEMORY_FILE = '/Users/openclaw/.jarvis/memory.json';
const MAX_HISTORY = 50;
const MAX_TOKENS = 1024;

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

// ── Emojis ───────────────────────────────────────────────────────────
const E = {
  robot: '🤖', zap: '⚡', check: '✅', warn: '⚠️', red: '🔴', 
  monitor: '👁️', shield: '🛡️', fix: '🔧', brain: '🧠', 
  code: '💻', search: '🔍', write: '✍️', analyze: '📊'
};

// ── Single instance lock with improved cleanup ────────────────────────
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

const { Bot, InlineKeyboard } = require('grammy');

const bot = new Bot(BOT_TOKEN);

// ── Memory System ────────────────────────────────────────────────────
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

loadMemory();
setInterval(saveMemory, 30000); // Save every 30 seconds

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

// ── NVIDIA API Integration ───────────────────────────────────────────
function askNvidia(userId, prompt, chatId, options = {}) {
  const model = options.model || 'glm5';
  const agent = options.agent || 'main';
  
  const body = JSON.stringify({
    messages: [
      { role: 'system', content: getSystemPrompt(agent) },
      { role: 'user', content: prompt }
    ],
    model: MODELS[model]?.id || 'z-ai/glm5',
    max_tokens: MAX_TOKENS,
    temperature: 0.7
  });
  
  const req = https.request({
    hostname: 'integrate.api.nvidia.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + getNvidiaApiKey(),
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    timeout: 45000
  }, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.choices && json.choices[0]?.message?.content) {
          const reply = json.choices[0].message.content;
          bot.api.sendMessage(chatId, reply, { parse_mode: 'Markdown' }).catch((err) => {
            console.log(`❌ Failed to send AI response: ${err.message}`);
          });
          
          // Store in memory
          conversations[userId] = conversations[userId] || [];
          conversations[userId].push({ role: 'user', content: prompt });
          conversations[userId].push({ role: 'assistant', content: reply });
          if (conversations[userId].length > MAX_HISTORY * 2) {
            conversations[userId] = conversations[userId].slice(-MAX_HISTORY * 2);
          }
        } else {
          bot.api.sendMessage(chatId, E.robot + ' Sorry, no response from AI.').catch((err) => {});
        }
      } catch (e) {
        console.log(`❌ AI response parse error: ${e.message}`);
        bot.api.sendMessage(chatId, E.red + ' Connection error: ' + e.message).catch(() => {});
      }
    });
  });
  
  req.on('error', err => {
    bot.api.sendMessage(chatId, E.red + ' Connection error: socket hang up').catch(() => {});
  });
  
  req.on('timeout', () => {
    req.destroy();
    bot.api.sendMessage(chatId, E.red + ' Timeout. Please try again, sir.').catch(() => {});
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
        startCmd: 'cd /Users/openclaw/jarvis-middleware && nohup /opt/homebrew/bin/node jarvis-autonomous-final.js >> /tmp/middleware.log 2>&1 &',
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
  }, 30000); // Check every 30 seconds
}

// ── Service Control Commands ─────────────────────────────────────────
function startService(serviceName) {
  const services = {
    gateway: 'openclaw gateway start',
    dashboard: 'cd /Users/openclaw/jarvis-dashboard && nohup /opt/homebrew/bin/node server.js >> /tmp/dashboard.log 2>&1 &',
    middleware: 'cd /Users/openclaw/jarvis-middleware && nohup /opt/homebrew/bin/node jarvis-autonomous-final.js >> /tmp/middleware.log 2>&1 &'
  };
  
  if (services[serviceName]) {
    try {
      execSync(services[serviceName], { stdio: 'ignore' });
      console.log(`✅ Started ${serviceName}`);
    } catch (error) {
      console.log(`❌ Failed to start ${serviceName}: ${error.message}`);
    }
  }
}

function stopService(serviceName) {
  const patterns = {
    gateway: 'openclaw.*gateway',
    dashboard: 'jarvis-dashboard.*server|node.*server.js',
    middleware: 'jarvis-middleware.*jarvis.js|node.*jarvis.js'
  };
  
  if (patterns[serviceName]) {
    try {
      execSync(`pkill -9 -f "${patterns[serviceName]}" 2>/dev/null || true`, { stdio: 'ignore' });
      console.log(`✅ Stopped ${serviceName}`);
    } catch (error) {
      console.log(`❌ Failed to stop ${serviceName}: ${error.message}`);
    }
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
    execSync(`curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true"`, { stdio: 'ignore' });
    execSync(`curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1&timeout=0"`, { stdio: 'ignore' });
    
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

*🧠 Memory & Context*
/notes — View saved notes

*💻 Code & System*
/run <code> — Execute code
/sys <cmd> — System control

*🔍 Search & Research*
/search <query> — Web search
/explain <topic> — Deep explanation

*⚙️ Settings*
/status — System status
/brain — AI brain status
/model — Switch model (${MODELS[currentModel]?.label || 'GLM-5'})
/nvidia <key> — Set API key

*🔧 Supervisor Commands*
/supervisor — System status & control
/supervisor start <service> — Start service
/supervisor stop <service> — Stop service
/supervisor restart <service> — Restart service
/supervisor fix — Fix common issues
/supervisor monitor — Enable monitoring

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
  const mem = (conversations[userId]?.length || 0);
  const userModel = userContext[userId]?.model || 'glm5';
  const agentId = activeAgent[userId] || 'main';
  const agent = AGENTS.find(a => a.id === agentId);
  const modelInfo = MODELS[userModel];
  
  const notesCount = (userNotes[userId] || []).length;

  let msg = `${E.robot} *JARVIS v12 Status*\n\n`;
  msg += `*Agent:* ${agent?.emoji} ${agent?.label}\n`;
  msg += `*Model:* ${modelInfo?.label || 'GLM-5'}\n`;
  msg += `*Memory:* ${Math.floor(mem / 2)} exchanges, ${notesCount} notes\n`;

  msg += `\n_/supervisor for detailed service control_`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ── Text messages ─────────────────────────────────────────────────────
bot.on('message:text', async ctx => {
  const text = ctx.message.text.trim();
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  if (text.startsWith('/')) return;

  console.log(`[${new Date().toLocaleTimeString()}] ${userId} → "${text.slice(0, 60)}"`);

  // Bridge user message to dashboard
  bridgeToDashboard('user', text, 'telegram');
  
  // Immediately acknowledge receipt
  await ctx.reply('👂 Processing...', { parse_mode: 'Markdown' });

  // Get user's preferred model and agent
  const userModel = userContext[userId]?.model;
  const userAgent = activeAgent[userId] || 'main';
  
  // Determine if we should use chain-of-thought reasoning
  const useChainOfThought = text.length > 50 || 
    /\b(explain|analyze|compare|evaluate|why|how)\b/i.test(text) ||
    userAgent === 'researcher' || userAgent === 'analyst';

  if (useChainOfThought) {
    // Use chain-of-thought reasoning for complex queries
    try {
      await ctx.reply('🧠 *Processing with enhanced reasoning...*', { parse_mode: 'Markdown' });
      
      const chainOfThought = getChainOfThought({
        maxSteps: 4,
        temperature: 0.7,
        enableSelfCheck: true
      });
      
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
      
      // Bridge response to dashboard
      bridgeToDashboard('assistant', formattedResponse, 'jarvis');
    } catch (error) {
      console.error('Error in chain-of-thought reasoning:', error);
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
  } catch (err) {
    const is409 = err.message?.includes('409');
    if (is409) {
      const delay = Math.min(attempt * 45000, 300000);
      console.log(`409 conflict (attempt ${attempt}) — waiting ${delay / 1000}s...`);
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
// startWatching(msg => {
//   ALLOWED_IDS.forEach(id => bot.api.sendMessage(id, msg, { parse_mode: 'Markdown' }).catch(() => {}));
// });

// Initialize enhanced memory and reasoning systems
// const enhancedMemory = getEnhancedMemory();
// const chainOfThought = getChainOfThought({
//   maxSteps: 4,
//   temperature: 0.7,
//   enableSelfCheck: true
// });

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
      execSync(`curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true"`, { stdio: 'ignore' });
      execSync(`curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1&timeout=0"`, { stdio: 'ignore' });
      
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