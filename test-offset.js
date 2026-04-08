// Test Telegram offset handling
const https = require('https');

const BOT_TOKEN = '8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y';

function getUpdates(offset = -1) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=0`,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve({});
        }
      });
    });
    req.end();
  });
}

async function main() {
  console.log('Testing offset handling...');
  
  // Get current state
  const current = await getUpdates(-1);
  console.log('Current last updates:', JSON.stringify(current, null, 2));
  
  if (current.result && current.result.length > 0) {
    const lastId = current.result[current.result.length - 1].update_id;
    console.log(`Last update ID: ${lastId}`);
    
    // Poll from last ID + 1
    console.log(`\nPolling from offset ${lastId + 1}...`);
    const poll = await getUpdates(lastId + 1);
    console.log('Poll result:', JSON.stringify(poll, null, 2));
  } else {
    console.log('No recent updates found');
    
    // Send a test message
    console.log('\nSending test message...');
    const sendReq = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendMessage?chat_id=8466621162&text=test+offset+handling`,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Message sent');
        
        // Now check for updates
        setTimeout(async () => {
          console.log('\nChecking for new updates...');
          const newUpdates = await getUpdates(-1);
          console.log('New updates:', JSON.stringify(newUpdates, null, 2));
        }, 2000);
      });
    });
    sendReq.end();
  }
}

main();