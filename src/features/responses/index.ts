// src/features/responses/index.ts
import type { Telegraf } from 'telegraf';
import { buildKeyboard } from '@core/ui/keyboards.js';
import type { Ctx } from '@core/types.js';

export function registerResponses(bot: Telegraf<Ctx>, config: any) {
    bot.on('callback_query', async (ctx) => {
        const data = (ctx.callbackQuery as any)?.data as string | undefined
        if (!data) return

        const cfg = config.get()

        // Переходы по разделам (chapter), включая возврат в MAIN
        const isChapter =
            data === 'MAIN' || cfg.buttons.some((b: any) => b.chapter === data)

        if (isChapter) {
            await ctx.answerCbQuery()

            const text =
                data === 'MAIN'
                    ? `${cfg.texts.welcome}${ctx.from?.first_name ? `, ${ctx.from.first_name}` : ''}`
                    : 'Выберите категорию:'

            await ctx.reply(text, buildKeyboard(ctx as Ctx, data, config))
            return
        }

        // Ответы по payload
        await ctx.answerCbQuery()
        const resp = cfg.responses[data]
        if (resp) {
            await ctx.reply(resp, buildKeyboard(ctx as Ctx, 'MAIN', config))
        } else {
            await ctx.reply(
                'Нет текста для этой кнопки. Админ может задать через /setresponse.',
                buildKeyboard(ctx as Ctx, 'MAIN', config)
            )
        }
    })
}
