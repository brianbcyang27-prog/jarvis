// JARVIS Supervisor Agent - Monitors and fixes JARVIS services
// This agent runs above all services and can fix issues automatically
// It does NOT connect to Telegram as a bot to avoid token conflicts
'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class JarvisSupervisorAgent {
  constructor() {
    // Service definitions - using openclaw commands for proper service management
    this.services = {
      'gateway': {
        name: 'OpenClaw Gateway',
        check: 'openclaw.*gateway',
        startCmd: 'openclaw gateway start',
        stopCmd: 'openclaw gateway stop',
        restartCmd: 'openclaw gateway restart'
      },
      'dashboard': {
        name: 'JARVIS Dashboard',
        check: 'jarvis-dashboard.*server|node.*server.js',
        startCmd: '/opt/homebrew/bin/node /Users/openclaw/jarvis-dashboard/server.js',
        stopCmd: 'pkill -f "jarvis-dashboard.*server|node.*server.js"',
        restartCmd: 'pkill -f "jarvis-dashboard.*server|node.*server.js" && sleep 2 && /opt/homebrew/bin/node /Users/openclaw/jarvis-dashboard/server.js'
      },
      'middleware': {
        name: 'JARVIS Middleware',
        check: 'jarvis-middleware.*jarvis.js|node.*jarvis.js',
        startCmd: '/opt/homebrew/bin/node /Users/openclaw/jarvis-middleware/jarvis.js',
        stopCmd: 'pkill -f "jarvis-middleware.*jarvis.js|node.*jarvis.js"',
        restartCmd: 'pkill -f "jarvis-middleware.*jarvis.js|node.*jarvis.js" && sleep 2 && /opt/homebrew/bin/node /Users/openclaw/jarvis-middleware/jarvis.js'
      }
    };
    
    this.logFile = '/tmp/jarvis-supervisor-agent.log';
    this.checkInterval = 15000; // 15 seconds for faster response
    this.maxRestartAttempts = 3;
    this.restartCounts = {};
    this.fixAttempts = {};
    
    // Initialize counters
    Object.keys(this.services).forEach(key => {
      this.restartCounts[key] = 0;
      this.fixAttempts[key] = 0;
    });
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(this.logFile, logEntry);
  }
  
  isServiceRunning(serviceKey) {
    const service = this.services[serviceKey];
    if (!service) return false;
    
    try {
      const output = execSync(`pgrep -f "${service.check}"`, { encoding: 'utf8' });
      return output.trim() !== '';
    } catch (error) {
      return false;
    }
  }
  
  startService(serviceKey) {
    const service = this.services[serviceKey];
    if (!service) return false;
    
    this.log(`🚀 Starting ${service.name}...`);
    
    try {
      // Special handling for each service type
      if (serviceKey === 'gateway') {
        // Use openclaw command for proper service management
        execSync('openclaw gateway stop 2>/dev/null || true', { stdio: 'ignore' });
        // Wait for clean shutdown
        setTimeout(() => {
          execSync(service.startCmd, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
        }, 1000);
      } else if (serviceKey === 'dashboard') {
        // Kill any existing dashboard processes first
        execSync('pkill -f "jarvis-dashboard.*server|node.*server.js" 2>/dev/null || true', { stdio: 'ignore' });
        setTimeout(() => {
          const dashboardProcess = spawn('/opt/homebrew/bin/node', ['/Users/openclaw/jarvis-dashboard/server.js'], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          dashboardProcess.unref();
        }, 1000);
      } else if (serviceKey === 'middleware') {
        // Kill any existing middleware processes first
        execSync('pkill -f "jarvis-middleware.*jarvis.js|node.*jarvis.js" 2>/dev/null || true', { stdio: 'ignore' });
        setTimeout(() => {
          const middlewareProcess = spawn('/opt/homebrew/bin/node', ['/Users/openclaw/jarvis-middleware/jarvis.js'], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          middlewareProcess.unref();
        }, 1000);
      } else {
        execSync(service.startCmd, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
      }
      
      // Wait for service to start
      setTimeout(() => {
        if (this.isServiceRunning(serviceKey)) {
          this.log(`✅ ${service.name} started successfully`);
          this.restartCounts[serviceKey] = 0;
          this.fixAttempts[serviceKey] = 0;
        } else {
          this.log(`❌ Failed to start ${service.name}`);
        }
      }, 3000);
      
      return true;
    } catch (error) {
      this.log(`❌ Error starting ${service.name}: ${error.message}`);
      return false;
    }
  }
  
  stopService(serviceKey) {
    const service = this.services[serviceKey];
    if (!service) return false;
    
    this.log(`🛑 Stopping ${service.name}...`);
    
    try {
      execSync(service.stopCmd, { stdio: ['ignore', 'pipe', 'pipe'] });
      this.log(`✅ ${service.name} stopped`);
      return true;
    } catch (error) {
      this.log(`❌ Error stopping ${service.name}: ${error.message}`);
      return false;
    }
  }
  
  restartService(serviceKey) {
    this.log(`🔄 Restarting ${this.services[serviceKey].name}...`);
    this.stopService(serviceKey);
    setTimeout(() => {
      this.startService(serviceKey);
    }, 2000);
  }
  
  fixTelegramConflicts() {
    this.log('🔧 Fixing Telegram conflicts...');
    try {
      // Clear webhook and getUpdates with offset to resolve conflicts
      execSync(`curl -s "https://api.telegram.org/bot8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y/deleteWebhook?drop_pending_updates=true"`, { stdio: 'ignore' });
      execSync(`curl -s "https://api.telegram.org/bot8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y/getUpdates?offset=-1&timeout=0"`, { stdio: 'ignore' });
      // Set a proper offset to avoid conflicts
      execSync(`curl -s "https://api.telegram.org/bot8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y/getUpdates?offset=0&limit=1&timeout=0"`, { stdio: 'ignore' });
      this.log('✅ Telegram conflicts cleared');
      return true;
    } catch (error) {
      this.log(`❌ Failed to fix Telegram conflicts: ${error.message}`);
      return false;
    }
  }
  
  fixGatewayAuth() {
    this.log('🔧 Fixing gateway authorization...');
    try {
      // Stop gateway completely using openclaw command
      execSync('openclaw gateway stop 2>/dev/null || true', { stdio: 'ignore' });
      // Wait for clean shutdown
      setTimeout(() => {
        // Start gateway with proper authentication using openclaw command
        execSync('openclaw gateway start', { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
      }, 2000);
      this.log('✅ Gateway authorization fixed');
      return true;
    } catch (error) {
      this.log(`❌ Failed to fix gateway auth: ${error.message}`);
      return false;
    }
  }
  
  checkAndFixServices() {
    // Check each service
    for (const [serviceKey, service] of Object.entries(this.services)) {
      const isRunning = this.isServiceRunning(serviceKey);
      
      if (!isRunning) {
        const attempts = this.restartCounts[serviceKey] || 0;
        
        if (attempts < this.maxRestartAttempts) {
          this.log(`⚠️  ${service.name} is not running (attempt ${attempts + 1}/${this.maxRestartAttempts})`);
          this.startService(serviceKey);
          this.restartCounts[serviceKey] = attempts + 1;
        } else {
          this.log(`❌ ${service.name} failed to start after ${this.maxRestartAttempts} attempts`);
          // Try specific fixes based on service type
          if (serviceKey === 'middleware' && this.fixAttempts.middleware < 2) {
            this.log(`🔧 Attempting to fix Telegram conflicts for ${service.name}...`);
            if (this.fixTelegramConflicts()) {
              this.fixAttempts.middleware++;
              // Restart after fix
              setTimeout(() => {
                this.restartService(serviceKey);
              }, 3000);
            }
          } else if (serviceKey === 'gateway' && this.fixAttempts.gateway < 2) {
            this.log(`🔧 Attempting to fix gateway auth for ${service.name}...`);
            if (this.fixGatewayAuth()) {
              this.fixAttempts.gateway++;
              // Restart after fix
              setTimeout(() => {
                this.restartService(serviceKey);
              }, 3000);
            }
          }
        }
      } else {
        // Service is running, reset counters
        if (this.restartCounts[serviceKey] > 0 || this.fixAttempts[serviceKey] > 0) {
          this.log(`✅ ${service.name} is running normally`);
          this.restartCounts[serviceKey] = 0;
          this.fixAttempts[serviceKey] = 0;
        }
      }
    }
  }
  
  startMonitoring() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.log('▶️ Supervisor monitoring started');
    
    // Initial check
    this.checkAndFixServices();
    
    // Set up periodic checks
    this.monitoringInterval = setInterval(() => {
      this.checkAndFixServices();
    }, this.checkInterval);
  }
  
  stopMonitoring() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.log('⏸️ Supervisor monitoring stopped');
  }
  
  start() {
    this.log('🤖 JARVIS Supervisor Agent initialized');
    this.startMonitoring();
  }
}

// Start the supervisor agent if this file is run directly
if (require.main === module) {
  const supervisor = new JarvisSupervisorAgent();
  supervisor.start();
}

module.exports = JarvisSupervisorAgent;