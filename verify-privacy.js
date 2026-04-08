// Verify privacy mode is actually off
const https = require('https');

const BOT_TOKEN = '8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y';

async function verify() {
  console.log('=== VERIFYING PRIVACY MODE ===');
  
  // Clear webhook and pending updates
  console.log('\n1. Clearing webhook...');
  await new Promise(r => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`,
      method: 'GET'
    }, res => {
      console.log(`   Status: ${res.statusCode}`);
      res.resume();
      res.on('end', r);
    });
    req.end();
  });
  
  // Wait
  await new Promise(r => setTimeout(r, 2000));
  
  // Send a message
  console.log('\n2. Sending message...');
  const sendResult = await new Promise(r => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/sendMessage?chat_id=8466621162&text=Verify+privacy+test`,
      method: 'GET'
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => r(JSON.parse(data)));
    });
    req.end();
  });
  
  console.log(`   Message sent: ${sendResult.ok}`);
  
  // Try aggressive getUpdates
  console.log('\n3. Trying aggressive getUpdates...');
  
  // First get any pending updates with offset -1
  const initial = await new Promise(r => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getUpdates?offset=-5&limit=5`,
      method: 'GET',
      timeout: 10000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => r(JSON.parse(data)));
    });
    req.on('timeout', () => {
      console.log('   Timeout');
      r({});
    });
    req.end();
  });
  
  console.log(`   Initial: ${initial.result?.length || 0} updates`);
  
  if (initial.result && initial.result.length > 0) {
    const lastId = initial.result[initial.result.length - 1].update_id;
    console.log(`   Last update ID: ${lastId}`);
    
    // Now poll from lastId + 1 with timeout
    console.log(`\n4. Polling from offset ${lastId + 1}...`);
    const poll = await new Promise(r => {
      const req = https.request({
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${BOT_TOKEN}/getUpdates?offset=${lastId + 1}&timeout=5`,
        method: 'GET',
        timeout: 10000
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => r(JSON.parse(data)));
      });
      req.on('timeout', () => {
        console.log('   Poll timeout');
        r({});
      });
      req.end();
    });
    
    console.log(`   Poll result: ${poll.result?.length || 0} updates`);
    
    if (poll.result && poll.result.length > 0) {
      console.log('\n✅ SUCCESS! Bot is receiving updates!');
      console.log('   First update:', JSON.stringify(poll.result[0], null, 2));
    } else {
      console.log('\n⚠️  No updates received during poll');
      console.log('   Privacy mode might still be an issue');
    }
  } else {
    console.log('\n⚠️  No initial updates found');
    console.log('   This is unusual - even with privacy OFF, recent messages should appear');
    console.log('   Try:');
    console.log('   1. Restart Telegram app');
    console.log('   2. Send another message');
    console.log('   3. Wait a few minutes');
  }
}

verify().catch(console.error);