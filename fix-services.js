// JARVIS Service Fixer - Addresses specific issues: Telegram conflicts and gateway auth
'use strict';

const { execSync, exec } = require('child_process');
const fs = require('fs');

class JarvisServiceFixer {
  constructor() {
    this.logFile = '/tmp/jarvis-fixer.log';
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(this.logFile, logEntry);
  }
  
  fixTelegramConflicts() {
    this.log('🔧 Fixing Telegram conflicts...');
    try {
      // Clear webhook and getUpdates to resolve conflicts
      execSync(`curl -s "https://api.telegram.org/bot8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y/deleteWebhook?drop_pending_updates=true"`, { stdio: 'ignore' });
      execSync(`curl -s "https://api.telegram.org/bot8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y/getUpdates?offset=999999999&timeout=0"`, { stdio: 'ignore' });
      this.log('✅ Telegram conflicts cleared');
      return true;
    } catch (error) {
      this.log(`❌ Failed to fix Telegram conflicts: ${error.message}`);
      return false;
    }
  }
  
  fixGatewayAuth() {
    this.log('🔧 Fixing gateway authorization issues...');
    try {
      // Stop and restart gateway to reset auth
      execSync('openclaw gateway stop 2>/dev/null || true', { stdio: 'ignore' });
      // Wait a moment
      setTimeout(() => {
        // Start gateway again
        const gatewayProcess = require('child_process').spawn('/opt/homebrew/lib/node_modules/openclaw/dist/index.js', ['gateway', '--port', '18789'], {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        gatewayProcess.unref();
        this.log('✅ Gateway authorization fixed');
      }, 2000);
      return true;
    } catch (error) {
      this.log(`❌ Failed to fix gateway auth: ${error.message}`);
      return false;
    }
  }
  
  runFixes() {
    this.log('🚀 Running JARVIS service fixes...');
    
    // Fix Telegram conflicts first (most common issue)
    this.fixTelegramConflicts();
    
    // Fix gateway authorization
    this.fixGatewayAuth();
    
    this.log('✅ Service fixes completed');
  }
}

// Run fixes if this file is executed directly
if (require.main === module) {
  const fixer = new JarvisServiceFixer();
  fixer.runFixes();
}

module.exports = JarvisServiceFixer;