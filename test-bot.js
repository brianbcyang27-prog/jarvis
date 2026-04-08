// Simple test bot to verify Telegram connection
const { Bot } = require('grammy');

const BOT_TOKEN = '8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y';
const ALLOWED_ID = 8466621162;

async function runTestBot() {
  console.log('=== Starting Telegram Bot Test ===');
  
  const bot = new Bot(BOT_TOKEN);
  
  // Text messages
  bot.on('message:text', async ctx => {
    const text = ctx.message.text;
    const userId = ctx.from.id;
    
    console.log(`[${new Date().toLocaleTimeString()}] User ${userId}: "${text}"`);
    
    if (userId !== ALLOWED_ID) {
      console.log(`   ❌ Unauthorized user`);
      return;
    }
    
    try {
      console.log(`   ✅ Authorized, responding...`);
      await ctx.reply(`Test bot received: "${text}"`);
      console.log(`   ✅ Response sent`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  });
  
  // Commands
  bot.command('start', async ctx => {
    console.log(`Start command from ${ctx.from.id}`);
    await ctx.reply('Test bot started! Send any message to test.');
  });
  
  bot.command('status', async ctx => {
    console.log(`Status command from ${ctx.from.id}`);
    await ctx.reply('Test bot is running');
  });
  
  bot.command('ping', async ctx => {
    console.log(`Ping command from ${ctx.from.id}`);
    await ctx.reply('pong');
  });
  
  // Error handling
  bot.catch(err => {
    console.error('Bot error:', err.message);
  });
  
  // Log polling errors
  bot.api.config.use((prev) => async (method, payload, signal) => {
    try {
      return await prev(method, payload, signal);
    } catch (err) {
      console.error('API error:', err.message);
      throw err;
    }
  });
  
  try {
    console.log('Starting bot polling...');
    await bot.start({
      drop_pending_updates: true,
      allowed_updates: ['message'],
      onStart: info => {
        console.log(`✅ Bot started: @${info.username}`);
        console.log(`✅ Bot ID: ${info.id}`);
        console.log(`✅ Ready to receive messages`);
      }
    });
    console.log('✅ Bot is now listening for messages');
  } catch (error) {
    console.error(`❌ Failed to start bot: ${error.message}`);
    process.exit(1);
  }
}

runTestBot();