// Test bot privacy settings
const https = require('https');

const BOT_TOKEN = '8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y';

async function testBotSettings() {
  console.log('=== Testing Bot Settings ===');
  
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
  
  // Check if bot can read messages
  console.log('\nChecking bot capabilities:');
  console.log(`- can_read_all_group_messages: ${botInfo.result.can_read_all_group_messages}`);
  console.log(`- can_join_groups: ${botInfo.result.can_join_groups}`);
  console.log(`- supports_inline_queries: ${botInfo.result.supports_inline_queries}`);
  
  // Test sending and receiving
  console.log('\nTesting message flow:');
  
  // Send a message
  const sendResult = await new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendMessage?chat_id=8466621162&text=testing+privacy+settings`,
      method: 'GET'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.end();
  });
  
  console.log(`Message sent: ${sendResult.ok}`);
  
  // Wait and check for updates
  console.log('\nWaiting 2 seconds, then checking for updates...');
  await new Promise(r => setTimeout(r, 2000));
  
  const updates = await new Promise(resolve => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getUpdates?offset=-5&limit=5`,
      method: 'GET'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.end();
  });
  
  console.log(`Updates received: ${updates.result?.length || 0}`);
  if (updates.result && updates.result.length > 0) {
    console.log('Update details:', JSON.stringify(updates.result, null, 2));
  } else {
    console.log('No updates received - bot may have privacy mode enabled');
    console.log('Note: Bots in privacy mode cannot see messages sent to them');
  }
}

testBotSettings().catch(console.error);