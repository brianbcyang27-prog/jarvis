// jarvis-system-control.js — Real computer control for JARVIS
// Enables JARVIS to actually control the macOS system

const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_FILE = '/tmp/jarvis-system.log';
const DESKTOP = '/Users/openclaw/Desktop';

function log(action, message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${action}: ${message}\n`;
    fs.appendFileSync(LOG_FILE, line);
    console.log(line.trim());
}

// Self-debugging system
class JARVISDebugger {
    constructor() {
        this.errorHistory = [];
        this.maxHistory = 50;
    }
    
    logError(error, context = '') {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            error: error.message || error,
            stack: error.stack || '',
            context,
            resolved: false
        };
        
        this.errorHistory.push(errorEntry);
        if (this.errorHistory.length > this.maxHistory) {
            this.errorHistory.shift();
        }
        
        log('ERROR', `${context}: ${error.message || error}`);
        return this.analyzeError(errorEntry);
    }
    
    analyzeError(errorEntry) {
        const patterns = {
            'ENOENT': { type: 'file_not_found', fix: 'check_path' },
            'EACCES': { type: 'permission_denied', fix: 'request_permission' },
            'ETIMEDOUT': { type: 'timeout', fix: 'retry_with_longer_timeout' },
            '409': { type: 'telegram_conflict', fix: 'wait_60_seconds' },
            'ECONNREFUSED': { type: 'connection_refused', fix: 'check_service_running' },
            'SIGKILL': { type: 'process_killed', fix: 'restart_process' }
        };
        
        for (const [code, info] of Object.entries(patterns)) {
            if (errorEntry.error.includes(code)) {
                return {
                    ...info,
                    suggestion: this.getFixSuggestion(info.fix)
                };
            }
        }
        
        return { type: 'unknown', fix: 'manual_intervention', suggestion: 'Check logs manually' };
    }
    
    getFixSuggestion(fixType) {
        const suggestions = {
            'check_path': 'File or directory does not exist. Verify the path is correct.',
            'request_permission': 'Permission denied. Try running with elevated privileges or check file permissions.',
            'retry_with_longer_timeout': 'Operation timed out. Increase timeout duration or check network connection.',
            'wait_60_seconds': 'Telegram session conflict detected. Wait 60 seconds before restarting.',
            'check_service_running': 'Connection refused. Ensure the target service is running.',
            'restart_process': 'Process was killed. Restart the process and monitor for issues.'
        };
        return suggestions[fixType] || 'No automated fix available.';
    }
    
    async attemptAutoFix(errorEntry, analysis) {
        log('AUTOFIX', `Attempting to fix: ${analysis.type}`);
        
        switch (analysis.fix) {
            case 'check_path':
                // Already handled by system control
                return { success: false, message: 'Path verification needed' };
            
            case 'restart_process':
                // Restart the process if possible
                return { success: true, message: 'Process restart recommended' };
            
            case 'wait_60_seconds':
                await new Promise(resolve => setTimeout(resolve, 60000));
                return { success: true, message: 'Waited 60 seconds for Telegram' };
            
            default:
                return { success: false, message: 'No automatic fix available' };
        }
    }
}

const debugger_instance = new JARVISDebugger();

// System Control Functions
const SystemControl = {
    // Application control
    async openApp(appName) {
        try {
            const result = execSync(`open -a "${appName}"`, { encoding: 'utf8' });
            log('APP', `Opened ${appName}`);
            return { success: true, message: `${appName} opened successfully` };
        } catch (error) {
            return debugger_instance.logError(error, `Opening ${appName}`);
        }
    },
    
    async closeApp(appName) {
        try {
            execSync(`pkill -9 "${appName}"`, { encoding: 'utf8' });
            log('APP', `Closed ${appName}`);
            return { success: true, message: `${appName} closed` };
        } catch (error) {
            return debugger_instance.logError(error, `Closing ${appName}`);
        }
    },
    
    // File operations
    async createFile(filename, content = '') {
        try {
            const filepath = path.join(DESKTOP, filename);
            fs.writeFileSync(filepath, content, 'utf8');
            log('FILE', `Created ${filename}`);
            return { success: true, message: `Created ${filename} on Desktop`, path: filepath };
        } catch (error) {
            return debugger_instance.logError(error, `Creating ${filename}`);
        }
    },
    
    async readFile(filepath) {
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            log('FILE', `Read ${filepath}`);
            return { success: true, content, path: filepath };
        } catch (error) {
            return debugger_instance.logError(error, `Reading ${filepath}`);
        }
    },
    
    async deleteFile(filepath) {
        try {
            fs.unlinkSync(filepath);
            log('FILE', `Deleted ${filepath}`);
            return { success: true, message: `Deleted ${filepath}` };
        } catch (error) {
            return debugger_instance.logError(error, `Deleting ${filepath}`);
        }
    },
    
    // System commands
    async runCommand(command, timeout = 30000) {
        return new Promise((resolve) => {
            exec(command, { timeout, cwd: DESKTOP }, (error, stdout, stderr) => {
                if (error) {
                    const result = debugger_instance.logError(error, `Command: ${command}`);
                    resolve(result);
                } else {
                    log('CMD', `Executed: ${command}`);
                    resolve({ success: true, stdout, stderr });
                }
            });
        });
    },
    
    // Screenshot
    async takeScreenshot() {
        try {
            const filename = `screenshot_${Date.now()}.png`;
            const filepath = path.join(DESKTOP, filename);
            execSync(`screencapture -x "${filepath}"`, { encoding: 'utf8' });
            log('SCREEN', `Captured screenshot: ${filename}`);
            return { success: true, filepath, filename };
        } catch (error) {
            return debugger_instance.logError(error, 'Taking screenshot');
        }
    },
    
    // Volume control
    async setVolume(level) {
        try {
            const volume = Math.max(0, Math.min(100, level));
            execSync(`osascript -e "set volume output volume ${volume}"`, { encoding: 'utf8' });
            log('AUDIO', `Set volume to ${volume}%`);
            return { success: true, message: `Volume set to ${volume}%` };
        } catch (error) {
            return debugger_instance.logError(error, 'Setting volume');
        }
    },
    
    // System info
    getSystemInfo() {
        try {
            const info = {
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname(),
                uptime: os.uptime(),
                totalmem: Math.round(os.totalmem() / 1024 / 1024 / 1024),
                freemem: Math.round(os.freemem() / 1024 / 1024 / 1024),
                cpus: os.cpus().length,
                loadavg: os.loadavg(),
                homedir: os.homedir(),
                userinfo: os.userInfo()
            };
            log('SYSTEM', 'Retrieved system info');
            return { success: true, info };
        } catch (error) {
            return debugger_instance.logError(error, 'Getting system info');
        }
    },
    
    // Process management
    async listProcesses() {
        try {
            const result = execSync('ps aux | head -20', { encoding: 'utf8' });
            log('PROCESS', 'Listed processes');
            return { success: true, processes: result };
        } catch (error) {
            return debugger_instance.logError(error, 'Listing processes');
        }
    },
    
    async killProcess(pid) {
        try {
            execSync(`kill -9 ${pid}`, { encoding: 'utf8' });
            log('PROCESS', `Killed process ${pid}`);
            return { success: true, message: `Process ${pid} terminated` };
        } catch (error) {
            return debugger_instance.logError(error, `Killing process ${pid}`);
        }
    },
    
    // Network operations
    async checkNetwork() {
        try {
            const result = execSync('networksetup -listallhardwareports', { encoding: 'utf8' });
            log('NETWORK', 'Checked network status');
            return { success: true, info: result };
        } catch (error) {
            return debugger_instance.logError(error, 'Checking network');
        }
    },
    
    // Browser control
    async openURL(url) {
        try {
            execSync(`open "${url}"`, { encoding: 'utf8' });
            log('BROWSER', `Opened ${url}`);
            return { success: true, message: `Opened ${url}` };
        } catch (error) {
            return debugger_instance.logError(error, `Opening ${url}`);
        }
    },
    
    // Clipboard
    async getClipboard() {
        try {
            const content = execSync('pbpaste', { encoding: 'utf8' });
            log('CLIPBOARD', 'Retrieved clipboard content');
            return { success: true, content };
        } catch (error) {
            return debugger_instance.logError(error, 'Getting clipboard');
        }
    },
    
    async setClipboard(text) {
        try {
            execSync(`echo '${text}' | pbcopy`, { encoding: 'utf8' });
            log('CLIPBOARD', 'Set clipboard content');
            return { success: true, message: 'Clipboard updated' };
        } catch (error) {
            return debugger_instance.logError(error, 'Setting clipboard');
        }
    },
    
    // Notifications
    async notify(title, message) {
        try {
            execSync(`osascript -e 'display notification "${message}" with title "${title}"'`, { encoding: 'utf8' });
            log('NOTIFY', `Sent notification: ${title}`);
            return { success: true };
        } catch (error) {
            return debugger_instance.logError(error, 'Sending notification');
        }
    }
};

module.exports = {
    SystemControl,
    debugger: debugger_instance,
    log
};
