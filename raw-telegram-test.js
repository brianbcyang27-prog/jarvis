// Raw Telegram API test without grammy
const https = require('https');

const BOT_TOKEN = '8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y';
const CHAT_ID = 8466621162;

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}${path}`,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Response ${res.statusCode}:`, data.substring(0, 200));
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function testTelegram() {
  console.log('=== RAW TELEGRAM API TEST ===');
  
  // 1. Test bot info
  console.log('\n1. Testing bot info...');
  const botInfo = await makeRequest('/getMe');
  console.log(`   Bot: @${botInfo.result?.username}`);
  
  // 2. Clear webhook
  console.log('\n2. Clearing webhook...');
  await makeRequest('/deleteWebhook?drop_pending_updates=true');
  
  // 3. Get current updates
  console.log('\n3. Checking for pending updates...');
  const updates = await makeRequest('/getUpdates?offset=-1&timeout=0');
  console.log(`   Pending updates: ${updates.result?.length || 0}`);
  
  if (updates.result && updates.result.length > 0) {
    console.log(`   Last update ID: ${updates.result[updates.result.length - 1].update_id}`);
  }
  
  // 4. Test sending a message
  console.log('\n4. Sending test message...');
  const sendResult = await makeRequest(`/sendMessage?chat_id=${CHAT_ID}&text=Raw+API+test+message`);
  console.log(`   Message sent: ${sendResult.ok ? '✅' : '❌'}`);
  
  // 5. Try to get updates with long polling
  console.log('\n5. Testing long polling (timeout=10s)...');
  console.log('   Starting long poll - this will wait for 10 seconds for new messages');
  
  const longPollPromise = makeRequest('/getUpdates?timeout=10');
  
  // Send another message while polling
  setTimeout(async () => {
    console.log('   Sending message during poll...');
    await makeRequest(`/sendMessage?chat_id=${CHAT_ID}&text=Message+during+poll`);
  }, 2000);
  
  try {
    const pollResult = await longPollPromise;
    console.log(`   Poll completed: ${pollResult.result?.length || 0} updates`);
    if (pollResult.result && pollResult.result.length > 0) {
      pollResult.result.forEach((update, i) => {
        console.log(`   Update ${i}: ID=${update.update_id}, Type=${Object.keys(update).filter(k => k !== 'update_id')[0]}`);
        if (update.message) {
          console.log(`      Message: "${update.message.text}"`);
        }
      });
    }
  } catch (err) {
    console.log(`   Poll error: ${err.message}`);
  }
  
  console.log('\n=== TEST COMPLETE ===');
}

testTelegram().catch(console.error);