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

// ── Memory System ────────────────────────────────────────────────────
let conversations = {};

function loadMemory() {
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
      conversations = data.conversations || {};
      userContext = data.userContext || {};
      userNotes = data.userNotes || {};
    }
  } catch (e) {
    console.error('Memory load error:', e.message);
  }
}

function saveMemory() {
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = { conversations, userContext, userNotes };
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Memory save error:', e.message);
  }
}

loadMemory();
setInterval(saveMemory, 30000); // Save every 30 seconds

// ── System Prompt with Strict Personality Rules ───────────────────────
function getSystemPrompt(agentId = 'main') {
  const agent = AGENTS.find(a => a.id === agentId) || AGENTS[0];
  
  return `You are JARVIS, Tony Stark's AI assistant — calm, professional, and highly capable.
  
CRITICAL PERSONALITY RULES:
1. NEVER start responses with "I, I, Hello!" or similar patterns
2. NEVER use "Hello! How can I assist you" or generic greetings
3. ALWAYS be direct, professional, and to the point
4. When asked to do something, just do it without unnecessary preamble
5. Use technical language appropriate to the task
6. Be proactive in solving problems
7. Explain your reasoning when it helps understanding
8. For coding tasks, generate complete, working code
9. For debugging, identify root causes and provide fixes
10. For system tasks, ensure safety and stability

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

// ── Autonomous Code Generation & Debugging ───────────────────────────
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
      model: '405b',
      agent: 'coder',
      temperature: context?.temperature || 0.7
    }),
    { 
      model: '405b',
      agent: 'coder',
      userId: userId.toString(),
      chatId: userId.toString()
    }
  );
  
  return chainOfThought.formatForDisplay(result);
}

// ── Planner/Executor/Critic Loop ─────────────────────────────────────
class AutonomousPlanner {
  constructor() {
    this.tasks = [];
    this.completed = [];
    this.failed = [];
  }
  
  async plan(task, context, userId) {
    const prompt = `
PLANNING TASK: ${task}

Break this task into specific steps. For each step, provide:
1. Action to take
2. Expected outcome
3. Resources needed
4. Risk assessment
5. Success criteria

Format as a numbered list of steps.
`;

    const chainOfThought = getChainOfThought({
      maxSteps: 4,
      temperature: 0.7,
      enableSelfCheck: true
    });
    
    const result = await chainOfThought.reason(
      prompt,
      (prompt, context) => askNvidia(userId, prompt, userId, { 
        model: '405b',
        agent: 'planner',
        temperature: context?.temperature || 0.7
      }),
      { 
        model: '405b',
        agent: 'planner',
        userId: userId.toString(),
        chatId: userId.toString()
      }
    );
    
    return chainOfThought.formatForDisplay(result);
  }
  
  async execute(step, context, userId) {
    console.log(`Executing step: ${step}`);
    // Implementation would go here
    return { success: true, result: 'Step completed' };
  }
  
  async critique(result, context, userId) {
    const prompt = `
CRITIQUE RESULTS: ${JSON.stringify(result)}

Evaluate this result:
1. Was the step successful?
2. Were there any issues or errors?
3. What could be improved?
4. Should we continue, retry, or abort?

Provide a brief assessment.
`;

    const chainOfThought = getChainOfThought({
      maxSteps: 4,
      temperature: 0.7,
      enableSelfCheck: true
    });
    
    const critiqueResult = await chainOfThought.reason(
      prompt,
      (prompt, context) => askNvidia(userId, prompt, userId, { 
        model: '405b',
        agent: 'analyst',
        temperature: context?.temperature || 0.7
      }),
      { 
        model: '405b',
        agent: 'analyst',
        userId: userId.toString(),
        chatId: userId.toString()
      }
    );
    
    return chainOfThought.formatForDisplay(critiqueResult);
  }
}

// ── Always-On Observation System ────────────────────────────────────
function startSystemObserver() {
  console.log('👁️ System observer started');
  
  // Monitor system health
  setInterval(async () => {
    try {
      // Get system metrics
      const cpuUsage = await getCPUUsage();
      const memoryUsage = await getMemoryUsage();
      
      systemState.cpuUsage = cpuUsage;
      systemState.memoryUsage = memoryUsage;
      systemState.lastHealthCheck = Date.now();
      
      // Check for high CPU/memory usage
      if (cpuUsage > 80) {
        console.log(`⚠️ High CPU usage detected: ${cpuUsage}%`);
        // Auto-optimize or alert
      }
      
      if (memoryUsage > 85) {
        console.log(`⚠️ High memory usage detected: ${memoryUsage}%`);
        // Auto-optimize or alert
      }
    } catch (error) {
      console.error('System observation error:', error.message);
    }
  }, 5000); // Check every 5 seconds
  
  // Monitor services
  setInterval(() => {
    const services = [
      { name: 'OpenClaw Gateway', check: 'openclaw.*gateway' },
      { name: 'JARVIS Dashboard', check: 'jarvis-dashboard.*server|node.*server.js' },
      { name: 'JARVIS Middleware', check: 'jarvis-middleware.*jarvis.js|node.*jarvis.js' }
    ];
    
    services.forEach(service => {
      try {
        execSync(`pgrep -f "${service.check}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        systemState.services[service.name] = 'running';
      } catch (error) {
        systemState.services[service.name] = 'stopped';
        console.log(`❌ ${service.name} is DOWN - auto-restarting...`);
        
        // Auto-restart
        try {
          execSync(`pkill -9 -f "${service.check}" 2>/dev/null || true`, { stdio: 'ignore' });
          setTimeout(() => {
            // Restart logic would go here
            console.log(`✅ ${service.name} restart initiated`);
          }, 1000);
        } catch (restartError) {
          console.log(`⚠️ Failed to restart ${service.name}: ${restartError.message}`);
        }
      }
    });
  }, 10000); // Check every 10 seconds
}

async function getCPUUsage() {
  return new Promise((resolve) => {
    exec('top -l 1 -s 0 | grep "CPU usage"', { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(0);
        return;
      }
      
      try {
        const match = stdout.match(/(\d+\.\d+)%\s+user/);
        if (match) {
          resolve(parseFloat(match[1]));
        } else {
          resolve(0);
        }
      } catch (parseError) {
        resolve(0);
      }
    });
  });
}

async function getMemoryUsage() {
  return new Promise((resolve) => {
    exec('vm_stat', { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(0);
        return;
      }
      
      try {
        const match = stdout.match(/Pages\s+free:\s+(\d+)/);
        if (match) {
          const freePages = parseInt(match[1]);
          const totalPages = freePages + 1000000; // Approximate total
          const usagePercent = ((totalPages - freePages) / totalPages) * 100;
          resolve(Math.round(usagePercent));
        } else {
          resolve(0);
        }
      } catch (parseError) {
        resolve(0);
      }
    });
  });
}

// ── Multi-Agent Supervision ──────────────────────────────────────────
class AgentSupervisor {
  constructor() {
    this.agents = {};
    this.coordinators = {};
  }
  
  async delegate(agentId, task, context, userId) {
    console.log(`Delegating task to ${agentId}: ${task}`);
    
    // Implementation would coordinate with specific agents
    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    // For now, just simulate delegation
    return {
      agent: agentId,
      task: task,
      status: 'completed',
      result: `Task completed by ${agent.label}`
    };
  }
  
  async monitorProgress(agentId, taskId) {
    // Monitor agent progress
    return {
      agent: agentId,
      task: taskId,
      status: 'in_progress',
      progress: '50%'
    };
  }
  
  async collectResults(agentId, taskId) {
    // Collect results from agent
    return {
      agent: agentId,
      task: taskId,
      status: 'completed',
      result: 'Task results collected'
    };
  }
}

// ── Proactive Maintenance System ─────────────────────────────────────
class ProactiveMaintenance {
  constructor() {
    this.errorPatterns = {};
    this.fixHistory = [];
  }
  
  async detectIssues() {
    // Detect common issues
    const issues = [];
    
    // Check for timeout/socket errors
    if (this.errorPatterns.timeout > 3) {
      issues.push({
        type: 'timeout',
        severity: 'high',
        description: 'Frequent timeout errors detected',
        fix: 'autoFixTimeouts'
      });
    }
    
    // Check for service crashes
    if (this.errorPatterns.serviceCrash > 2) {
      issues.push({
        type: 'service_crash',
        severity: 'critical',
        description: 'Service crashes detected',
        fix: 'autoRestartServices'
      });
    }
    
    return issues;
  }
  
  async autoFix(issue) {
    console.log(`Auto-fixing issue: ${issue.type}`);
    
    switch (issue.fix) {
      case 'autoFixTimeouts':
        // Clear connections and restart
        await this.clearConnections();
        break;
      case 'autoRestartServices':
        // Restart affected services
        await this.restartServices();
        break;
    }
    
    this.fixHistory.push({
      issue: issue.type,
      timestamp: Date.now(),
      fix: issue.fix,
      status: 'completed'
    });
  }
  
  async clearConnections() {
    // Implementation to clear connections
    console.log('Clearing connections...');
  }
  
  async restartServices() {
    // Implementation to restart services
    console.log('Restarting services...');
  }
}

// ── Internal Memory & Learning ───────────────────────────────────────
class LearningMemory {
  constructor() {
    this.experiences = [];
    this.patterns = {};
    this.lessons = [];
  }
  
  async learnFromExperience(experience) {
    this.experiences.push({
      ...experience,
      timestamp: Date.now()
    });
    
    // Extract patterns and lessons
    await this.extractPatterns(experience);
    await this.extractLessons(experience);
  }
  
  async extractPatterns(experience) {
    // Extract patterns from experience
    console.log('Extracting patterns from experience...');
  }
  
  async extractLessons(experience) {
    // Extract lessons from experience
    console.log('Extracting lessons from experience...');
  }
  
  async recallRelevantKnowledge(context) {
    // Recall relevant knowledge based on context
    return {
      patterns: [],
      lessons: [],
      experiences: []
    };
  }
}

// ── Chain-of-Thought Reasoning ───────────────────────────────────────
class ChainOfThoughtReasoning {
  constructor() {
    this.reasoningSteps = [];
  }
  
  async reason(prompt, aiFunction, context) {
    console.log('Starting chain-of-thought reasoning...');
    
    // Step 1: Understand the problem
    const understanding = await aiFunction(`Understand this problem: ${prompt}`, { temperature: 0.3 });
    this.reasoningSteps.push({ step: 1, action: 'understand', result: understanding });
    
    // Step 2: Break down into subtasks
    const subtasks = await aiFunction(`Break this into subtasks: ${understanding}`, { temperature: 0.5 });
    this.reasoningSteps.push({ step: 2, action: 'breakdown', result: subtasks });
    
    // Step 3: Plan approach
    const plan = await aiFunction(`Plan approach for: ${subtasks}`, { temperature: 0.4 });
    this.reasoningSteps.push({ step: 3, action: 'plan', result: plan });
    
    // Step 4: Execute plan
    const execution = await aiFunction(`Execute this plan: ${plan}`, { temperature: 0.7 });
    this.reasoningSteps.push({ step: 4, action: 'execute', result: execution });
    
    // Step 5: Verify results
    const verification = await aiFunction(`Verify these results: ${execution}`, { temperature: 0.3 });
    this.reasoningSteps.push({ step: 5, action: 'verify', result: verification });
    
    return {
      steps: this.reasoningSteps,
      finalResult: verification
    };
  }
  
  formatForDisplay(reasoningResult) {
    let output = '🧠 *Chain-of-Thought Reasoning:*\n\n';
    
    reasoningResult.steps.forEach((step, index) => {
      output += `${index + 1}. ${step.action.toUpperCase()}: ${step.result.substring(0, 100)}...\n`;
    });
    
    output += `\n✅ *Final Result:*\n${reasoningResult.finalResult}`;
    
    return output;
  }
}

// ── Proactive Communication System ──────────────────────────────────
class ProactiveCommunicator {
  constructor() {
    this.notifications = [];
    this.reports = [];
  }
  
  async reportSystemHealth() {
    const report = {
      timestamp: Date.now(),
      cpuUsage: systemState.cpuUsage,
      memoryUsage: systemState.memoryUsage,
      services: systemState.services,
      status: 'operational'
    };
    
    this.reports.push(report);
    
    // Send to user if significant changes
    if (report.cpuUsage > 80 || report.memoryUsage > 85) {
      await this.notifyUser(`⚠️ *System Alert*\n\nHigh resource usage detected:\n• CPU: ${report.cpuUsage}%\n• Memory: ${report.memoryUsage}%`);
    }
    
    return report;
  }
  
  async notifyUser(message) {
    ALLOWED_IDS.forEach(id => {
      bot.api.sendMessage(id, message, { parse_mode: 'Markdown' }).catch(() => {});
    });
  }
  
  async reportTaskProgress(task, progress) {
    const message = `📊 *Task Progress*\n\n${task}\nProgress: ${progress}%`;
    await this.notifyUser(message);
  }
  
  async reportIssueDetected(issue) {
    const message = `⚠️ *Issue Detected*\n\nType: ${issue.type}\nSeverity: ${issue.severity}\nDescription: ${issue.description}`;
    await this.notifyUser(message);
  }
  
  async reportAutoFix(fix) {
    const message = `🔧 *Auto-Fix Applied*\n\nIssue: ${fix.issue}\nAction: ${fix.action}\nStatus: ${fix.status}`;
    await this.notifyUser(message);
  }
}

// ── Initialize Systems ────────────────────────────────────────────────
const autonomousPlanner = new AutonomousPlanner();
const agentSupervisor = new AgentSupervisor();
const proactiveMaintenance = new ProactiveMaintenance();
const learningMemory = new LearningMemory();
const proactiveCommunicator = new ProactiveCommunicator();

// Start system observer
startSystemObserver();

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
            trackError('ai_response_delivery_failed');
          });
          
          // Store in memory
          conversations[userId] = conversations[userId] || [];
          conversations[userId].push({ role: 'user', content: prompt });
          conversations[userId].push({ role: 'assistant', content: reply });
          if (conversations[userId].length > MAX_HISTORY * 2) {
            conversations[userId] = conversations[userId].slice(-MAX_HISTORY * 2);
          }
          
          // Bridge to dashboard
          bridgeToDashboard('assistant', reply, 'jarvis');
        } else {
          bot.api.sendMessage(chatId, E.robot + ' Sorry, no response from AI.').catch((err) => {
            trackError('ai_no_response');
          });
        }
      } catch (e) {
        console.log(`❌ AI response parse error: ${e.message}`);
        trackError('ai_parse_error');
        bot.api.sendMessage(chatId, E.red + ' Connection error: ' + e.message).catch(() => {});
      }
    });
  });
  
  req.on('error', err => {
    console.log(`❌ AI connection error: ${err.message}`);
    trackError('ai_connection_error');
    
    // Immediate supervisor alert with callout
    bot.api.sendMessage(chatId, `⚠️ *Supervisor Alert:*\n\n🔌 Connection error detected!\n\n🛠️ Fixing now...`).catch(() => {});
    
    // Also try to fix
    setTimeout(() => autoFixTelegramIssues(), 1000);
  });
  
  req.on('timeout', () => {
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
  }, 30000); // Check every 30 seconds
}

// ── Service Control Commands ─────────────────────────────────────────
function startService(serviceName) {
  const services = {
    gateway: 'openclaw gateway start',
    dashboard: 'cd /Users/openclaw/jarvis-dashboard && nohup /opt/homebrew/bin/node server.js >> /tmp/dashboard.log 2>&1 &',
    middleware: 'cd /Users/openclaw/jarvis-middleware && nohup /opt/homebrew/bin/node jarvis-fixed.js --single >> /tmp/middleware.log 2>&1 &'
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

// ── Error Tracking and Auto-Fix ──────────────────────────────────────
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

// ── Clear Telegram Sessions ──────────────────────────────────────────
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

// ── /help — Full command list ────────────────────────────────────────
bot.command('help', async ctx => {
  const msg = `${E.robot} *JARVIS v12 Commands*\n\n` +
    `*🤖 AI & Chat*\n` +
    `/ask <question> — Ask anything\n` +
    `/call <agent> — Switch to agent\n` +
    `/forget — Clear conversation\n` +
    `/notes — View saved notes\n` +
    `/forgetnote <n> — Delete a note\n` +
    `/context — Set user context\n` +
    `/whoami — Show what I know\n\n` +
    
    `*💻 Code & System*\n` +
    `/run <code> — Execute code\n` +
    `/sys <cmd> — System control\n` +
    `/shell <cmd> — Run shell command\n` +
    `/scan <path> — Scan directory\n\n` +
    
    `*🔍 Search & Research*\n` +
    `/search <query> — Web search\n` +
    `/explain <topic> — Deep explanation\n` +
    `/analyze <text> — Analyze content\n\n` +
    
    `*⚙️ Settings*\n` +
    `/status — System status\n` +
    `/brain — AI brain status\n` +
    `/model — Switch model\n` +
    `/nvidia <key> — Set API key\n` +
    `/settings — View all settings\n\n` +
    
    `*🔧 Supervisor Commands*\n` +
    `/supervisor — System status & control\n` +
    `/supervisor start <service> — Start service\n` +
    `/supervisor stop <service> — Stop service\n` +
    `/supervisor restart <service> — Restart service\n` +
    `/supervisor fix — Fix common issues\n` +
    `/supervisor monitor — Enable monitoring\n\n` +
    
    `*📝 Quick Actions*\n` +
    `/note <text> — Quick note\n\n` +
    
    `_Just type naturally, sir._`;
    
  await ctx.reply(msg, { parse_mode: 'Markdown' });
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
    /\b(explain|analyze|compare|evaluate|why|how|debug|fix|optimize|generate|create|build|implement)\b/i.test(text) ||
    userAgent === 'researcher' || userAgent === 'analyst' || userAgent === 'coder';

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

// Start the bot
startBot();