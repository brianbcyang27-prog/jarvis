// Test if privacy mode is actually off
const https = require('https');

const BOT_TOKEN = '8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y';

async function test() {
  console.log('=== Testing Privacy Mode ===');
  
  // Get bot info
  const botInfo = await new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getMe`,
      method: 'GET'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.end();
  });
  
  console.log('Bot info:', JSON.stringify(botInfo.result, null, 2));
  
  // Check specific privacy-related fields
  console.log('\nPrivacy-related fields:');
  console.log('- can_read_all_group_messages:', botInfo.result.can_read_all_group_messages);
  console.log('- Note: This is for GROUP messages only');
  console.log('- For private chats, privacy mode is a separate setting');
  
  // Send a message
  console.log('\nSending test message...');
  const sendResult = await new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendMessage?chat_id=8466621162&text=Privacy+test+message`,
      method: 'GET'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.end();
  });
  
  console.log('Message sent:', sendResult.ok);
  
  // Try to get updates with a more aggressive approach
  console.log('\nTrying to get updates with various offsets...');
  
  // Try offset -1
  const updates1 = await new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getUpdates?offset=-1&limit=10`,
      method: 'GET'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.end();
  });
  
  console.log('Offset -1:', updates1.result?.length || 0, 'updates');
  
  // Try offset 0
  const updates2 = await new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getUpdates?offset=0&limit=10`,
      method: 'GET'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.end();
  });
  
  console.log('Offset 0:', updates2.result?.length || 0, 'updates');
  
  // Try with allowed_updates
  const updates3 = await new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getUpdates?offset=-5&limit=5&allowed_updates=["message"]`,
      method: 'GET'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.end();
  });
  
  console.log('With allowed_updates:', updates3.result?.length || 0, 'updates');
  
  if (updates1.result && updates1.result.length > 0) {
    console.log('\nFound updates! First update:');
    console.log(JSON.stringify(updates1.result[0], null, 2));
  } else {
    console.log('\n⚠️  No updates found. Possible issues:');
    console.log('1. Privacy mode might still be ON (check @BotFather → /setprivacy → Disable)');
    console.log('2. Bot might be restricted');
    console.log('3. There might be a Telegram API issue');
  }
}

test().catch(console.error);