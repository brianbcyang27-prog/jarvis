// coder.js v3 — skills library, no temp scripts, global HTML hosting
const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const http = require('http');
const { matchSkill } = require('./skills');

const DESKTOP  = '/Users/openclaw/Desktop';
const PROJECTS = '/Users/openclaw/Projects';

// Active HTML servers: port → { server, url }
const activeServers = {};

function getOllamaHost() {
  // Use M4 if available
  try {
    const cfg = JSON.parse(fs.readFileSync('/Users/openclaw/.openclaw/openclaw.json','utf8'));
    const model = cfg.agents?.defaults?.model?.primary || '';
    if (model.startsWith('ollama-m4')) return { host:'192.168.50.192', model:'qwen2.5:14b' };
  } catch(e) {}
  return { host:'localhost', model:'qwen2.5:3b' };
}

// Generate code via Ollama
function generateCode(task, language, errorContext, callback) {
  const { host, model } = getOllamaHost();
  const prompt = errorContext
    ? `Fix this ${language} error. Return ONLY the fixed code, nothing else:\n\nError: ${errorContext}\n\nTask was: ${task}`
    : `Write complete working ${language} code for: "${task}"\n\nRules:\n- Output ONLY raw code\n- No markdown fences\n- No explanations\n- No comments unless needed\n- Must be complete and runnable`;

  const body = JSON.stringify({
    model, prompt, stream: false,
    options: { num_predict: 1500, temperature: 0.05 }
  });

  const req = http.request({
    hostname: host, port: 11434, path: '/api/generate', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        let code = (JSON.parse(data).response || '').trim();
        code = code.replace(/^```[\w]*\n?/gm,'').replace(/^```$/gm,'').trim();
        callback(null, code);
      } catch(e) { callback(e); }
    });
  });
  req.on('error', callback);
  req.setTimeout(90000, () => { req.destroy(); callback(new Error('Ollama timeout')); });
  req.write(body); req.end();
}

function detectLanguage(task) {
  const t = task.toLowerCase();
  if (/\bhtml\b|\bwebpage\b|\bweb\s*page\b|\bwebsite\b|\bland.*page\b/.test(t))
    return { lang:'html', ext:'html', run:null, gui:true };
  if (/\bjavascript\b|\bnode\.?js\b/.test(t))
    return { lang:'javascript', ext:'js', run:'node', gui:false };
  if (/\bbash\b|\bshell\b/.test(t))
    return { lang:'bash', ext:'sh', run:'bash', gui:false };
  return { lang:'python', ext:'py', run:'python3', gui:false };
}

function getFilename(task, ext) {
  const named = task.match(/(?:called?|named?)\s+['"]*(\w[\w.-]*)['".]*/i);
  if (named) return named[1].includes('.') ? named[1] : named[1]+'.'+ext;
  const found = task.match(/\b(\w+\.(py|js|sh|html|css))\b/i);
  if (found) return found[1];
  const kw = task.toLowerCase().match(/\b(game|calc|timer|quiz|todo|clock|chat|app|tool|bot|weather|news|dashboard)\b/);
  return (kw ? kw[1] : 'script')+'.'+ext;
}

function isGui(code, lang) {
  if (lang === 'html') return true;
  if (lang === 'python')
    return /\btkinter\b|\bpygame\b|\bpyqt\b|\bwxpython\b/.test(code.toLowerCase());
  return false;
}

// Serve HTML file and get a public URL via cloudflared
function serveHtml(filepath, filename, sendMsg) {
  const port = 8800 + Math.floor(Math.random() * 100);

  // Simple static file server
  const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    fs.createReadStream(filepath).pipe(res);
  });

  server.listen(port, '0.0.0.0', () => {
    sendMsg(`🌐 Serving \`${filename}\` locally on port ${port}...\nGetting public URL via Cloudflare...`);

    // Use cloudflared to get a public URL
    const tunnel = exec(
      `/opt/homebrew/bin/cloudflared tunnel --url http://localhost:${port} 2>&1`,
      { timeout: 120000 }
    );

    let urlFound = false;
    tunnel.stdout?.on('data', d => {
      if (urlFound) return;
      const match = d.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        urlFound = true;
        const url = match[0];
        activeServers[port] = { server, tunnel, url };
        sendMsg(
          `✅ *HTML Live*, sir!\n\n` +
          `🔗 Public URL: ${url}\n` +
          `📁 File: \`${filename}\`\n\n` +
          `_Link works anywhere — share it. Closes when JARVIS restarts._`,
          true
        );
      }
    });

    tunnel.on('error', () => {
      // Fallback: open locally + localtunnel
      exec(`npx --yes localtunnel --port ${port}`, { timeout:60000 }, (err, stdout) => {
        const ltMatch = stdout?.match(/https?:\/\/[^\s]+/);
        if (ltMatch) {
          sendMsg(`✅ *HTML Live* (localtunnel), sir!\n\n🔗 ${ltMatch[0]}\n📁 \`${filename}\``, true);
        } else {
          exec(`open "${filepath}"`, ()=>{});
          sendMsg(`✅ \`${filename}\` opened locally, sir. (No tunnel available — check cloudflared install)`, true);
        }
      });
    });
  });
}

// Main handler
function handleCodingTask(task, chatId, sendMsg) {
  const { lang, ext, run, gui } = detectLanguage(task);
  const useDesktop = /\bdesktop\b/i.test(task);
  const saveDir    = useDesktop ? DESKTOP : PROJECTS;
  const filename   = getFilename(task, ext);
  const filepath   = path.join(saveDir, filename);

  fs.mkdirSync(saveDir, { recursive: true });

  // Try skills library first — instant, no generation needed
  const skill = matchSkill(task);
  if (skill) {
    const skillPath = path.join(saveDir, skill.name+'.'+skill.ext);
    fs.writeFileSync(skillPath, skill.code, 'utf8');
    exec(`open "${skillPath}"`, () => {});
    sendMsg(`✅ Done, sir — \`${skill.name}.${skill.ext}\` created from skills library and opened.`, true);
    return;
  }

  let attempts = 0;

  function attempt(errorContext) {
    attempts++;

    generateCode(task, lang, errorContext, (genErr, code) => {
      if (genErr || !code || code.length < 30) {
        if (attempts < 3) {
          sendMsg(`⚠️ Attempt ${attempts} failed — retrying, sir...`);
          setTimeout(() => attempt(genErr?.message || 'empty response'), 2000);
        } else {
          sendMsg(`❌ Failed after 3 attempts.\nError: ${genErr?.message || 'empty code'}`);
        }
        return;
      }

      // Write ONLY the output file — no generator scripts
      fs.writeFileSync(filepath, code, 'utf8');
      if (ext === 'sh') fs.chmodSync(filepath, '755');

      // HTML → serve with public URL
      if (lang === 'html' || (gui && ext === 'html')) {
        serveHtml(filepath, filename, sendMsg);
        return;
      }

      // GUI Python app → just open
      if (isGui(code, lang)) {
        exec(`open "${filepath}"`, () => {});
        sendMsg(`✅ Done, sir — \`${filename}\` created and opened.`, true);
        return;
      }

      // Runnable script → execute and show output
      exec(`${run} "${filepath}" 2>&1`, { timeout: 20000 }, (runErr, stdout) => {
        const output = (stdout || '').trim();
        const ok = !runErr || runErr.code === 0;

        if (!ok && output && attempts < 3) {
          sendMsg(`⚠️ Attempt ${attempts} — error detected. Fixing, sir...`);
          setTimeout(() => attempt(output.slice(0, 400)), 2000);
          return;
        }

        exec(`open "${filepath}"`, () => {});
        const preview = output ? `\n\`\`\`\n${output.slice(0, 500)}\n\`\`\`` : '';
        sendMsg(`✅ Done, sir — \`${filename}\` created and tested.${preview}`, true);
      });
    });
  }

  attempt(null);
}

module.exports = { handleCodingTask };
