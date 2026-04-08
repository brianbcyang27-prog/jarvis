// JARVIS Supervisor Agent - Monitors and fixes JARVIS services
'use strict';

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class JarvisSupervisor {
  constructor() {
    this.services = [
      { name: 'OpenClaw Gateway', check: 'openclaw.*gateway', start: '/Users/openclaw/Desktop/openclaw/START-OPENCLAW.command' },
      { name: 'JARVIS Dashboard', check: 'jarvis-dashboard.*server|node.*server.js', start: '/Users/openclaw/Desktop/openclaw/START-OPENCLAW.command' },
      { name: 'JARVIS Middleware', check: 'jarvis-middleware.*jarvis.js|node.*jarvis.js', start: '/Users/openclaw/Desktop/openclaw/START-OPENCLAW.command' }
    ];
    
    this.logFile = '/tmp/jarvis-supervisor.log';
    this.checkInterval = 30000; // 30 seconds
    this.maxRestartAttempts = 3;
    this.restartCounts = {};
    
    // Initialize restart counts
    this.services.forEach(service => {
      this.restartCounts[service.name] = 0;
    });
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(this.logFile, logEntry);
  }
  
  isServiceRunning(serviceName) {
    for (const service of this.services) {
      if (service.name === serviceName) {
        try {
          const output = execSync(`pgrep -f "${service.check}"`, { encoding: 'utf8' });
          return output.trim() !== '';
        } catch (error) {
          return false;
        }
      }
    }
    return false;
  }
  
  startService(serviceName) {
    this.log(`Attempting to start ${serviceName}...`);
    
    // Find the service
    const service = this.services.find(s => s.name === serviceName);
    if (!service) {
      this.log(`Error: Service ${serviceName} not found`);
      return false;
    }
    
    try {
      // Special handling for gateway since it needs clean startup
      if (serviceName === 'OpenClaw Gateway') {
        execSync('openclaw gateway stop 2>/dev/null || true', { stdio: 'ignore' });
        execSync(`${service.start}`, { stdio: ['ignore', 'pipe', 'pipe'] });
      } else {
        // For other services, use the start command which handles cleanup
        execSync(`${service.start}`, { stdio: ['ignore', 'pipe', 'pipe'] });
      }
      
      // Wait a bit for service to start
      setTimeout(() => {
        if (this.isServiceRunning(serviceName)) {
          this.log(`✅ ${serviceName} started successfully`);
          this.restartCounts[serviceName] = 0; // Reset counter on success
        } else {
          this.log(`❌ Failed to start ${serviceName}`);
        }
      }, 5000);
      
      return true;
    } catch (error) {
      this.log(`❌ Error starting ${serviceName}: ${error.message}`);
      return false;
    }
  }
  
  checkAndFixServices() {
    this.log('🔍 Supervisor checking service status...');
    
    for (const service of this.services) {
      const isRunning = this.isServiceRunning(service.name);
      
      if (!isRunning) {
        const attempts = this.restartCounts[service.name] || 0;
        
        if (attempts < this.maxRestartAttempts) {
          this.log(`⚠️  ${service.name} is not running (attempt ${attempts + 1}/${this.maxRestartAttempts})`);
          this.startService(service.name);
          this.restartCounts[service.name] = attempts + 1;
        } else {
          this.log(`❌ ${service.name} failed to start after ${this.maxRestartAttempts} attempts. Manual intervention required.`);
          // Send alert via Telegram if possible
          this.sendTelegramAlert(`🚨 ${service.name} has failed repeatedly and requires manual attention`);
        }
      } else {
        // Service is running, reset counter
        if (this.restartCounts[service.name] > 0) {
          this.log(`✅ ${service.name} is running normally`);
          this.restartCounts[service.name] = 0;
        }
      }
    }
  }
  
  sendTelegramAlert(message) {
    // This would integrate with the existing Telegram bot
    // For now, just log it
    this.log(`📢 TELEGRAM ALERT: ${message}`);
  }
  
  start() {
    this.log('🚀 JARVIS Supervisor Agent started');
    this.log(`📋 Monitoring ${this.services.length} services every ${this.checkInterval/1000} seconds`);
    
    // Initial check
    this.checkAndFixServices();
    
    // Set up periodic checks
    setInterval(() => {
      this.checkAndFixServices();
    }, this.checkInterval);
  }
}

// Start the supervisor if this file is run directly
if (require.main === module) {
  const supervisor = new JarvisSupervisor();
  supervisor.start();
}

module.exports = JarvisSupervisor;