// src/features/menu/index.ts
import type { Telegraf } from 'telegraf';
import { buildKeyboard } from '@core/ui/keyboards.js';
import type { Ctx } from '@core/types.js';

export function registerMenu(bot: Telegraf<Ctx>, config: any) {
    bot.start(async (ctx) => {
        if (ctx.chat?.type !== 'private') return
        const name = ctx.from?.first_name ? `, ${ctx.from.first_name}` : ''
        await ctx.reply(`${config.get().texts.welcome}${name}`, buildKeyboard(ctx, 'MAIN', config))
    })

    bot.command('menu', async (ctx) => {
        if (ctx.chat?.type !== 'private') return
        await ctx.reply('Выберите действие:', buildKeyboard(ctx, 'MAIN', config))
    })
}
