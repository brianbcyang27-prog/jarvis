// Debug bot to understand Telegram polling
const { Bot, GrammyError, HttpError } = require('grammy');

async function run() {
  console.log('=== DEBUG BOT STARTING ===');
  
  const bot = new Bot('8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y');
  
  // Middleware to log ALL updates
  bot.use(async (ctx, next) => {
    const updateId = ctx.update.update_id;
    const updateType = Object.keys(ctx.update).filter(k => k !== 'update_id')[0];
    console.log(`[${new Date().toLocaleTimeString()}] Update ${updateId} (${updateType})`);
    
    if (ctx.update.message) {
      const msg = ctx.update.message;
      console.log(`   Message from ${msg.from.id}: "${msg.text}"`);
    }
    
    await next();
  });
  
  bot.on('message:text', async (ctx) => {
    console.log(`[${new Date().toLocaleTimeString()}] Processing text message`);
    
    try {
      await ctx.reply(`Debug reply: ${ctx.message.text}`);
      console.log(`   ✅ Reply sent`);
    } catch (err) {
      console.log(`   ❌ Reply error: ${err.message}`);
    }
  });
  
  // Error handling
  bot.catch((err) => {
    if (err instanceof GrammyError) {
      console.error(`Grammy error: ${err.description}`);
    } else if (err instanceof HttpError) {
      console.error(`HTTP error: ${err.message}`);
    } else {
      console.error(`Unknown error:`, err);
    }
  });
  
  try {
    console.log('Starting bot...');
    const startResult = await bot.start({
      drop_pending_updates: true,
      allowed_updates: ['message'],
      onStart: (info) => {
        console.log(`✅ Bot started: @${info.username}`);
        console.log(`✅ Bot ID: ${info.id}`);
      }
    });
    console.log('✅ Bot polling active');
    
    // Keep bot running
    setInterval(() => {
      console.log(`[${new Date().toLocaleTimeString()}] Bot still alive`);
    }, 30000);
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

run();