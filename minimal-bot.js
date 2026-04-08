// Minimal Telegram bot to test message processing
const { Bot } = require('grammy');

async function run() {
  console.log('=== MINIMAL BOT STARTING ===');
  
  const bot = new Bot('8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y');
  
  // Add basic logging middleware
  bot.use(async (ctx, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] Update received`);
    await next();
  });
  
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;
    console.log(`[${new Date().toLocaleTimeString()}] Message from ${userId}: "${text}"`);
    
    try {
      await ctx.reply(`Minimal bot says: ${text}`);
      console.log(`   ✅ Reply sent`);
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  });
  
  // Add error handler
  bot.catch((err) => {
    console.error('Bot error:', err.message);
  });
  
  try {
    console.log('Starting polling...');
    await bot.start({
      drop_pending_updates: true,
      allowed_updates: ['message'],
      onStart: (info) => {
        console.log(`✅ Bot started: @${info.username}`);
      }
    });
    console.log('✅ Bot polling started');
  } catch (err) {
    console.error('❌ Failed to start:', err.message);
  }
}

run();