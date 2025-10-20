// src/features/admin/index.ts
import type { Telegraf } from 'telegraf'
import type { Ctx } from '@core/types.js'
import { adminMenuKeyboard } from '@core/ui/keyboards.js'
import { ensureAdmin } from '@core/utils/guard.js'
import { resetAdminSession } from '@core/session/fsm.js'

/**
 * Регистрирует команды и кнопки админ-панели.
 */
export function registerAdmin(bot: Telegraf<Ctx>, config: any) {
    // /admin — открыть панель
    bot.command('admin', async (ctx) => {
        if (ctx.chat?.type !== 'private') return
        if (!ensureAdmin(ctx as Ctx, config)) return
        await sendAdminPanel(ctx)
    })

    // Кнопка ⚙️ Admin Panel
    bot.action('ADMIN', async (ctx) => {
        if (!config.isAdmin(ctx.from.id)) {
            await ctx.answerCbQuery('⛔ Недостаточно прав.', { show_alert: true })
            return
        }
        await ctx.answerCbQuery()
        resetAdminSession(ctx.from.id)
        await sendAdminPanel(ctx)
    })

    // Пример: кнопка «Назад в меню» из панели
    bot.action('ADM_BACK_TO_MAIN', async (ctx) => {
        await ctx.answerCbQuery()
        await ctx.reply('Главное меню:', adminMenuKeyboard())
    })
}

/**
 * Отправляет текст и клавиатуру панели админа.
 */
async function sendAdminPanel(ctx: Ctx) {
    const text = `⚙️ Admin Panel

Выберите действие:
• Добавить кнопку
• Редактировать кнопку
• Удалить кнопку
• Список кнопок
• Изменить приветствие
• Изменить ответ payload`

    await ctx.reply(text, adminMenuKeyboard())
}
