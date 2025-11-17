import type { Telegraf } from 'telegraf'
import type { Ctx } from '@core/types.js'
import { adminMenuKeyboard } from '@core/ui/keyboards.js'
import { show } from '@core/ui/switcher.js'
import { listSheets } from '@core/importers/listSheets.js'

export function registerDebug(bot: Telegraf<Ctx>, config: any) {
    bot.action('DBG_ROWS', async (ctx) => {
        if (!config.isSuper(ctx.from?.id ?? -1)) {
            await ctx.answerCbQuery('⛔ Только суперпользователь.', { show_alert: true })
            return
        }
        try { await ctx.answerCbQuery() } catch {}

        const SHEET_ID = process.env.GOOGLE_SHEET_ID
        if (!SHEET_ID) {
            await show(ctx, '❗️ Переменная окружения <b>GOOGLE_SHEET_ID</b> не задана.', adminMenuKeyboard())
            return
        }

        try {
            const sheets = await listSheets(SHEET_ID)
            if (!sheets.length) {
                await show(ctx, 'Похоже, нет доступных листов (проверь доступ или ID).', adminMenuKeyboard())
                return
            }

            const lines = sheets
                .map(s => `• <b>${s.title}</b> — <code>${s.gid}</code>`)
                .join('\n')

            const text =
                `🧪 <b>Список листов</b>\n` +
                `Spreadsheet ID: <code>${SHEET_ID}</code>\n\n` +
                lines

            await show(ctx, text, adminMenuKeyboard())
        } catch (e: any) {
            await show(ctx, `⚠️ Ошибка: <code>${e?.message || String(e)}</code>`, adminMenuKeyboard())
        }
    })
}