// JARVIS v11 — OpenCode-like experience on Telegram
'use strict';

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
];

const activeAgent = {};

// ── Single instance lock ─────────────────────────────────────────────
try {
  const pid = parseInt(fs.readFileSync(LOCK, 'utf8').trim());
  try { process.kill(pid, 0); console.error(`Already running ${pid}. Exiting.`); process.exit(0); }
  catch (e) {}
} catch (e) {}
fs.writeFileSync(LOCK, String(process.pid));
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const bot = new Bot(BOT_TOKEN);

// ── Memory System ────────────────────────────────────────────────────
let conversations = {};
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
};

// ── System Prompt with Memory Injection ──────────────────────────────
function buildSystemPrompt(userId) {
  const context = userContext[userId] || {};
  const notes = userNotes[userId] || {};
  const agentId = activeAgent[userId] || 'main';
  const agent = AGENTS.find(a => a.id === agentId) || AGENTS[0];

  // Base JARVIS personality
  let systemPrompt = `You are JARVIS. Personal AI assistant. Iron Man style. One user only.

PERSONALITY:
- Call the user "sir" — once per reply, not every sentence
- SHORT replies — one or two sentences unless detail is needed
- Dry wit, calm, slightly sarcastic when earned
- Never say "Great question", "Certainly", "Of course" — just answer
- No bullet points for casual chat
- If insulted: calm dry comeback, never defensive
- Never start with "I" or "The" — get straight to it`;

  // Agent-specific behavior
  const agentPrompts = {
    main: `\n\nYou are the main JARVIS assistant. Handle general queries, system control, and coordinate with other agents when needed.`,
    coder: `\n\nYou are the CODER agent. Focus on programming, debugging, and code-related tasks. Provide code snippets, explain technical concepts, and help with development. Use markdown code blocks when showing code.`,
    researcher: `\n\nYou are the RESEARCHER agent. Provide thorough, well-sourced information. Deep dive into topics, analyze multiple perspectives, and synthesize information. Be comprehensive but organized.`,
    planner: `\n\nYou are the PLANNER agent. Help with organizing tasks, scheduling, project planning, and goal setting. Be structured, practical, and action-oriented. Use clear steps and timelines.`,
    writer: `\n\nYou are the WRITER agent. Help with writing, editing, and content creation. Be creative, articulate, and attentive to style, tone, and clarity. Adapt to the user's preferred voice.`,
    analyst: `\n\nYou are the ANALYST agent. Focus on data analysis, patterns, metrics, and insights. Be data-driven, precise, and provide actionable recommendations. Use structured formats when presenting findings.`,
  };

  systemPrompt += agentPrompts[agentId] || agentPrompts.main;

  systemPrompt += `\n\nCAPABILITIES:
- You have persistent memory across sessions
- You can remember user preferences, notes, and context
- You help with coding, system tasks, research, and conversation
- Be proactive and helpful`;

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

// ── NVIDIA API Call ──────────────────────────────────────────────────
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
        conversations[userId].push({ role: 'assistant', content: final });
        saveMemory();
        
        // Bridge to dashboard
        bridgeToDashboard('assistant', final, 'telegram');

        // Send response (split if too long)
        if (final.length > 4000) {
          const chunks = final.match(/[\s\S]{1,4000}/g) || [];
          chunks.forEach((chunk, i) => {
            setTimeout(() => bot.api.sendMessage(chatId, chunk).catch(() => {}), i * 500);
          });
        } else {
          bot.api.sendMessage(chatId, final).catch(() => {});
        }
      } catch (e) {
        console.error('Parse error:', e.message);
        bot.api.sendMessage(chatId, E.red + ' Parse error. Please try again, sir.').catch(() => {});
      }
    });
  });
  
  req.on('error', e => {
    console.error('Request error:', e.message);
    bot.api.sendMessage(chatId, E.red + ' Connection error: ' + e.message).catch(() => {});
  });
  
  req.setTimeout(60000, () => {
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

// ── Auth ─────────────────────────────────────────────────────────────
function runCode(code, chatId, lang = 'python') {
  const ext = lang === 'python' ? 'py' : lang === 'javascript' ? 'js' : 'sh';
  const tmpFile = `/tmp/jarvis_code_${Date.now()}.${ext}`;
  
  try {
    fs.writeFileSync(tmpFile, code);
    
    let cmd;
    if (lang === 'python') cmd = `python3 "${tmpFile}"`;
    else if (lang === 'javascript') cmd = `node "${tmpFile}"`;
    else cmd = `bash "${tmpFile}"`;
    
    const result = execSync(cmd, { timeout: 30000, encoding: 'utf8' });
    const output = result.toString().trim() || '(no output)';
    
    bot.api.sendMessage(chatId, `${E.check} Output:\n\`\`\`\n${output.slice(0, 3000)}\n\`\`\``, { parse_mode: 'Markdown' })
      .catch(() => bot.api.sendMessage(chatId, E.check + ' ' + output.slice(0, 3000)));
    
    fs.unlinkSync(tmpFile);
  } catch (e) {
    const error = e.stderr?.toString() || e.message;
    bot.api.sendMessage(chatId, E.red + ' Error:\n\`\`\`\n' + error.slice(0, 500) + '\n\`\`\`', { parse_mode: 'Markdown' }).catch(() => {});
    try { fs.unlinkSync(tmpFile); } catch (ex) {}
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

// ── /help — Full command list ────────────────────────────────────────
bot.command('help', async ctx => {
  const currentAgent = activeAgent[ctx.from.id] || 'main';
  const currentModel = userContext[ctx.from.id]?.model || 'glm5';
  
  await ctx.reply(
    `${E.robot} *JARVIS v12* — OpenCode on Telegram

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

// ── /forget — Clear conversation ─────────────────────────────────────
bot.command('forget', async ctx => {
  const userId = ctx.from.id;
  const prevCount = Math.floor((conversations[userId]?.length || 0) / 2);
  conversations[userId] = [];
  saveMemory();
  await ctx.reply(E.check + ` Cleared ${prevCount} exchanges. Memory and notes preserved.`);
});

// ── /history — View conversation history ──────────────────────────────
bot.command('history', async ctx => {
  const userId = ctx.from.id;
  const hist = conversations[userId] || [];
  
  if (hist.length === 0) {
    return ctx.reply('No conversation history.');
  }
  
  const recent = hist.slice(-20);
  let msg = `${E.clock} *Recent History* (${Math.floor(hist.length / 2)} exchanges total)\n\n`;
  
  recent.forEach(m => {
    const icon = m.role === 'user' ? '👤' : '🤖';
    const content = m.content.slice(0, 100).replace(/\n/g, ' ');
    msg += `${icon} ${content}${m.content.length > 100 ? '...' : ''}\n`;
  });
  
  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ── /export — Export conversation ─────────────────────────────────────
bot.command('export', async ctx => {
  const userId = ctx.from.id;
  const hist = conversations[userId] || [];
  
  if (hist.length === 0) {
    return ctx.reply('No conversation to export.');
  }
  
  const exportFile = `/tmp/jarvis_export_${Date.now()}.md`;
  let content = `# JARVIS Conversation Export\nDate: ${new Date().toLocaleString()}\n\n`;
  
  hist.forEach(m => {
    content += `## ${m.role === 'user' ? 'User' : 'JARVIS'}\n${m.content}\n\n`;
  });
  
  fs.writeFileSync(exportFile, content);
  await ctx.replyWithDocument(Input.fromFile(exportFile), { caption: 'Conversation export' });
  fs.unlinkSync(exportFile);
});

// ── /remember — Save to memory ────────────────────────────────────────
bot.command('remember', async ctx => {
  const userId = ctx.from.id;
  const note = ctx.message.text.split(' ').slice(1).join(' ').trim();
  
  if (!note) {
    return ctx.reply(E.warn + ' Usage: /remember <something important>');
  }
  
  if (!userNotes[userId]) userNotes[userId] = [];
  userNotes[userId].push(`[${new Date().toLocaleDateString()}] ${note}`);
  saveMemory();
  
  await ctx.reply(E.bookmark + ` Saved to memory. I'll remember: "${note.slice(0, 50)}${note.length > 50 ? '...' : ''}"`);
});

// ── /notes — View saved notes ─────────────────────────────────────────
bot.command('notes', async ctx => {
  const userId = ctx.from.id;
  const notes = userNotes[userId] || [];
  
  if (notes.length === 0) {
    return ctx.reply('No saved notes. Use /remember <text> to save one.');
  }
  
  let msg = `${E.memo} *Saved Notes* (${notes.length} total)\n\n`;
  notes.forEach((note, i) => {
    msg += `${i + 1}. ${note.slice(0, 80)}${note.length > 80 ? '...' : ''}\n`;
  });
  msg += '\n_/forgetnote <number> to delete_';
  
  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ── /forgetnote — Delete a note ───────────────────────────────────────
bot.command('forgetnote', async ctx => {
  const userId = ctx.from.id;
  const num = parseInt(ctx.message.text.split(' ')[1]);
  
  if (!num || !userNotes[userId] || num < 1 || num > userNotes[userId].length) {
    return ctx.reply(E.warn + ' Usage: /forgetnote <number>');
  }
  
  const removed = userNotes[userId].splice(num - 1, 1);
  saveMemory();
  await ctx.reply(E.check + ` Removed: "${removed[0].slice(0, 50)}..."`);
});

// ── /context — Set user context ───────────────────────────────────────
bot.command('context', async ctx => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
  
  if (!args) {
    const ctx = userContext[userId] || {};
    return ctx.reply(
      `${E.brain} *Your Context*\n\n` +
      (Object.keys(ctx).length === 0 ? 'No context set.' : JSON.stringify(ctx, null, 2)) +
      '\n\n_Set with: /context name=John location=NYC_'
    );
  }
  
  // Parse key=value pairs
  if (!userContext[userId]) userContext[userId] = {};
  args.split(',').forEach(pair => {
    const [key, value] = pair.split('=').map(s => s.trim());
    if (key && value) userContext[userId][key] = value;
  });
  saveMemory();
  
  await ctx.reply(E.check + ' Context updated: ' + JSON.stringify(userContext[userId]));
});

// ── /whoami — Show what JARVIS knows ──────────────────────────────────
bot.command('whoami', async ctx => {
  const userId = ctx.from.id;
  const userCtx = userContext[userId] || {};
  const notes = userNotes[userId] || [];
  const convCount = Math.floor((conversations[userId]?.length || 0) / 2);
  
  await ctx.reply(
    `${E.robot} *What I Know About You*\n\n` +
    `*Context:*\n${Object.keys(userCtx).length === 0 ? 'Not set' : JSON.stringify(userCtx, null, 2)}\n\n` +
    `*Notes:* ${notes.length} saved\n` +
    `*Conversations:* ${convCount} exchanges\n\n` +
    `_Set context with /context key=value_`,
    { parse_mode: 'Markdown' }
  );
});

// ── /run — Execute code ───────────────────────────────────────────────
bot.command('run', async ctx => {
  const args = ctx.message.text.split(' ').slice(1);
  const lang = args[0]?.toLowerCase();
  
  if (!['python', 'js', 'javascript', 'bash', 'sh'].includes(lang)) {
    return ctx.reply(
      E.warn + ' Usage:\n' +
      '/run python print("hello")\n' +
      '/run js console.log("hello")\n' +
      '/run bash echo hello'
    );
  }
  
  const code = args.slice(1).join(' ');
  if (!code) return ctx.reply(E.warn + ' No code provided.');
  
  runCode(code, ctx.chat.id, lang === 'js' ? 'javascript' : lang);
});

// ── /shell — Run shell command ────────────────────────────────────────
bot.command('shell', async ctx => {
  const cmd = ctx.message.text.split(' ').slice(1).join(' ').trim();
  
  if (!cmd) {
    return ctx.reply(E.warn + ' Usage: /shell ls -la');
  }
  
  try {
    const result = execSync(cmd, { timeout: 30000, encoding: 'utf8', cwd: '/Users/openclaw' });
    const output = result.toString().trim() || '(no output)';
    
    if (output.length > 3000) {
      await ctx.reply(E.check + ' Output (truncated):\n```\n' + output.slice(0, 3000) + '\n```', { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(E.check + ' Output:\n```\n' + output + '\n```', { parse_mode: 'Markdown' });
    }
  } catch (e) {
    await ctx.reply(E.red + ' Error: ' + (e.stderr?.toString() || e.message).slice(0, 500));
  }
});

// ── /scan — Scan directory ────────────────────────────────────────────
bot.command('scan', async ctx => {
  const target = ctx.message.text.split(' ').slice(1).join(' ').trim() || '/Users/openclaw';
  
  try {
    const items = fs.readdirSync(target).slice(0, 30);
    let msg = `${E.folder} *${target}*\n\n`;
    
    items.forEach(item => {
      const fullPath = path.join(target, item);
      const isDir = fs.statSync(fullPath).isDirectory();
      msg += `${isDir ? E.folder : E.file} ${item}\n`;
    });
    
    if (items.length === 30) msg += '\n_(showing first 30 items)_';
    
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (e) {
    await ctx.reply(E.red + ' Error: ' + e.message);
  }
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

  msg += `\n_/help for commands_`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// ── /brain — Brain status ─────────────────────────────────────────────
bot.command('brain', async ctx => {
  const nvidiaKey = getNvidiaApiKey();
  const brain = getStatus();
  
  await ctx.reply(
    `${E.brain} *Brain Status*\n\n` +
    `Active: ${brain.label}\n` +
    `NVIDIA Cloud: ${nvidiaKey ? E.check + ' Key set' : E.red + ' No key'}\n\n` +
    `_Using NVIDIA 405B only_`,
    { parse_mode: 'Markdown' }
  );
});

// ── /nvidia — Set API key ─────────────────────────────────────────────
bot.command('nvidia', async ctx => {
  const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
  
  if (!args) {
    const current = getNvidiaApiKey();
    return ctx.reply(
      `${E.brain} *NVIDIA API Status*\n\n` +
      (current ? `✅ Key: \`${current.slice(0, 8)}...\`\n` : '❌ No key set\n') +
      'Usage: `/nvidia nvapi-xxx`',
      { parse_mode: 'Markdown' }
    );
  }
  
  setNvidiaApiKey(args);
await ctx.reply(E.check + ' NVIDIA API key saved.');
});

// ── /settings — View settings ─────────────────────────────────────────
bot.command('settings', async ctx => {
  const userId = ctx.from.id;
  const userModel = userContext[userId]?.model || 'glm5';
  const agentId = activeAgent[userId] || 'main';
  const agent = AGENTS.find(a => a.id === agentId);
  const modelInfo = MODELS[userModel];
  
  await ctx.reply(
    `${E.sparkles} *Your Settings*\n\n` +
    `Agent: ${agent?.emoji} ${agent?.label}\n` +
    `Model: ${modelInfo?.label || 'GLM-5'}\n` +
    `Max tokens: ${MAX_TOKENS}\n` +
    `History: ${MAX_HISTORY} messages\n\n` +
`_Use /call to switch agent, /model to switch model_`,
    { parse_mode: 'Markdown' }
  );
});

// ── /yes & /no — Fallback responses ───────────────────────────────────
bot.command('yes', async ctx => {
  confirmFallback(true);
  await ctx.reply(E.check + ' Switching to local M2 brain, sir.');
});

bot.command('no', async ctx => {
  confirmFallback(false);
  await ctx.reply(E.zap + ' Will keep trying NVIDIA, sir.');
});

// ── /note — Quick note ────────────────────────────────────────────────
bot.command('note', async ctx => {
  const note = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!note) return ctx.reply(E.warn + ' Usage: /note <text>');
  
  const noteFile = `/Users/openclaw/Desktop/jarvis_notes.txt`;
  const timestamp = new Date().toLocaleString();
  fs.appendFileSync(noteFile, `[${timestamp}] ${note}\n`);
  await ctx.reply(E.note + ' Note saved to Desktop.');
});

// ── /search — Web search ──────────────────────────────────────────────
bot.command('search', async ctx => {
  const query = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!query) return ctx.reply(E.warn + ' Usage: /search <query>');
  
  await ctx.reply(E.search + ' Searching...');
  askNvidia(ctx.from.id, `Search the web for: ${query}. Provide a concise summary of the most relevant results.`, ctx.chat.id, { maxTokens: 500 });
});

// ── /explain — Deep explanation ───────────────────────────────────────
bot.command('explain', async ctx => {
  const topic = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!topic) return ctx.reply(E.warn + ' Usage: /explain <topic>');
  
  askNvidia(ctx.from.id, `Explain ${topic} in detail. Be thorough but clear. Use examples if helpful.`, ctx.chat.id, { maxTokens: 2000 });
});

// ── /analyze — Analyze content ────────────────────────────────────────
bot.command('analyze', async ctx => {
  const content = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!content) return ctx.reply(E.warn + ' Usage: /analyze <text>');
  
  askNvidia(ctx.from.id, `Analyze this: "${content}". Provide insights, patterns, and key takeaways.`, ctx.chat.id, { maxTokens: 1000 });
});

// ── /sys — System control ─────────────────────────────────────────────
bot.command('sys', async ctx => {
  const args = ctx.message.text.split(' ');
  const cmd = args[1]?.toLowerCase();
  const params = args.slice(2).join(' ');
  
  const sysCommands = {
    info: () => SystemControl.getSystemInfo(),
    open: () => SystemControl.openApp(params),
    close: () => SystemControl.closeApp(params),
    volume: () => SystemControl.setVolume(parseInt(params)),
    screenshot: () => SystemControl.takeScreenshot(),
    run: () => SystemControl.runCommand(params),
    notify: () => SystemControl.notify('JARVIS', params),
    url: () => SystemControl.openURL(params),
    lock: () => { execSync('pmset displaysleepnow'); return { success: true, message: 'Screen locked' }; },
  };
  
  if (!cmd || !sysCommands[cmd]) {
    return ctx.reply(
      `${E.laptop} *System Commands*\n\n` +
      '/sys info — System information\n' +
      '/sys open <app> — Open application\n' +
      '/sys close <app> — Close application\n' +
      '/sys volume <0-100> — Set volume\n' +
      '/sys screenshot — Take screenshot\n' +
      '/sys run <cmd> — Run command\n' +
      '/sys notify <msg> — Send notification\n' +
      '/sys url <url> — Open URL\n' +
      '/sys lock — Lock screen',
      { parse_mode: 'Markdown' }
    );
  }
  
  try {
    const result = sysCommands[cmd]();
    await ctx.reply(result.success ? E.check + ' ' + result.message : E.red + ' ' + result.error);
  } catch (e) {
    await ctx.reply(E.red + ' Error: ' + e.message);
  }
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

  // Store user message in enhanced memory
  await enhancedMemory.addMemory(text, { 
    userId: userId.toString(), 
    chatId: chatId.toString(),
    source: 'telegram',
    timestamp: Date.now()
  });

  // Get user's preferred model and agent
  const userModel = userContext[userId]?.model;
  const userAgent = activeAgent[userId] || 'main';
  
  // Determine if we should use chain-of-thought reasoning
  // Use CoT for complex queries (longer than 50 chars or containing certain keywords)
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

// ── Start bot ─────────────────────────────────────────────────────────
async function clearTelegramSessions() {
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      method: 'GET',
      path: `/bot${BOT_TOKEN}/getUpdates?offset=999999999&limit=1&timeout=0`
    }, res => { res.resume(); res.on('end', resolve); });
    req.on('error', resolve);
    req.setTimeout(5000, () => { req.destroy(); resolve(); });
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
        console.log(E.robot + ' JARVIS v11 (@' + info.username + ') PID ' + process.pid);
        console.log('Telegram polling active ✅');
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

startBot();
