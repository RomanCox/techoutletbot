import type { Telegraf } from 'telegraf'
import { buildKeyboard } from '@core/ui/keyboards.js'
import type { Ctx } from '@core/types.js'

export function registerMenu(bot: Telegraf<Ctx>, config: any) {
    bot.start(async (ctx) => {
        if (ctx.chat?.type !== 'private') return
        const text = `${config.get().texts.welcome}`
        const kb = buildKeyboard(ctx, 'MAIN', config)
        await ctx.eReply(text, { reply_markup: (kb as any).reply_markup })
    })

    bot.command('menu', async (ctx) => {
        if (ctx.chat?.type !== 'private') return
        const kb = buildKeyboard(ctx, 'MAIN', config)
        await ctx.eReply('Выберите действие:', { reply_markup: (kb as any).reply_markup })
    })
}
