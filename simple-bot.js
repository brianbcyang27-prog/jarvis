// Simple bot without fancy error handling
const { Bot } = require('grammy');

async function main() {
  console.log('Starting simple bot...');
  
  const bot = new Bot('8715045984:AAGw1JqL_mHi5t7PBzlQaE6uv8mjmbxd_3Y');
  
  bot.on('message:text', async (ctx) => {
    console.log(`Got message: ${ctx.message.text}`);
    await ctx.reply(`You said: ${ctx.message.text}`);
  });
  
  bot.command('start', async (ctx) => {
    console.log('Start command');
    await ctx.reply('Simple bot started!');
  });
  
  try {
    console.log('Attempting to start bot...');
    await bot.start({
      onStart: (info) => {
        console.log(`Bot started: @${info.username}`);
      },
      drop_pending_updates: true
    });
    console.log('Bot started successfully');
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Full error:', err);
  }
}

main();