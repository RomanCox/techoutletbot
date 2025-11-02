import type { Telegraf } from 'telegraf'
import type { Ctx } from '@core/types.js'
import { adminMenuKeyboard, buildKeyboard } from '@core/ui/keyboards.js'
import { getAdminSession, resetAdminSession, setAdminSession } from '@core/session/fsm.js'
import { importWorkbookGroups } from '@core/importers/sheetGroup.js'
import { show, showReplaceFromCallback } from '@core/ui/switcher.js'

/**
 * Получить ник или имя пользователя по ID (если бот когда-либо видел его)
 */
async function usernameOf(bot: Telegraf<Ctx>, userId: number): Promise<string> {
    try {
        const chat = await bot.telegram.getChat(userId)
        const u = chat as any
        if (u?.username) return '@' + u.username
        if (u?.first_name || u?.last_name) return [u.first_name, u.last_name].filter(Boolean).join(' ')
        return '—'
    } catch {
        return '—'
    }
}

/**
 * Получить список админов (id + username, если доступен)
 */
async function adminsListText(bot: Telegraf<Ctx>, config: any): Promise<string> {
    const ids: number[] = Array.isArray(config.get().adminUserIds) ? config.get().adminUserIds : []
    if (!ids.length) return 'Администраторов пока нет.'
    const lines = await Promise.all(
        ids.map(async (id) => `• ${id} ${await usernameOf(bot, id)}`)
    )
    return `Текущие администраторы:\n${lines.join('\n')}`
}

/**
 * Регистрация действий по управлению админами
 */
export function registerAdmin(bot: Telegraf<Ctx>, config: any) {
    bot.action('ADMIN', async (ctx) => {
        if (!config.isAdmin(ctx.from?.id ?? -1)) {
            await ctx.answerCbQuery('⛔ Недостаточно прав.', { show_alert: true })
            return
        }
        await ctx.answerCbQuery()
        resetAdminSession(ctx.from!.id)

        await ctx.eReply(
            `⚙️ Admin Panel

Выберите действие:
• Добавить/Редактировать/Удалить кнопку
• Список кнопок
• Изменить приветствие / ответ на payload
• Управление администраторами (только для суперпользователя)`,
            adminMenuKeyboard()
        )
    })

    // 👤➕ Добавить админа
    bot.action('ADM_ADD_ADMIN', async (ctx) => {
        if (!config.isSuper(ctx.from?.id ?? -1)) {
            await ctx.answerCbQuery('⛔ Только суперпользователь может это сделать.', { show_alert: true })
            return
        }
        await ctx.answerCbQuery()

        const list = await adminsListText(bot, config)
        await show(ctx, `${list}\n\nОтправьте ID пользователя, которого нужно добавить в администраторы:`, adminMenuKeyboard())

        const s = getAdminSession(ctx.from!.id)
        s.mode = 'ADD_ADMIN__ASK_ID'
        setAdminSession(ctx.from!.id, s)
    })

    // 👤➖ Удалить админа
    bot.action('ADM_DEL_ADMIN', async (ctx) => {
        if (!config.isSuper(ctx.from?.id ?? -1)) {
            await ctx.answerCbQuery('⛔ Только суперпользователь может это сделать.', { show_alert: true })
            return
        }
        await ctx.answerCbQuery()

        const list = await adminsListText(bot, config)
        await show(ctx, `${list}\n\nОтправьте ID администратора, которого нужно удалить:`, adminMenuKeyboard())

        const s = getAdminSession(ctx.from!.id)
        s.mode = 'DEL_ADMIN__ASK_ID'
        setAdminSession(ctx.from!.id, s)
    })

    // Обработка сообщений с ID
    bot.on('message', async (ctx) => {
        if (ctx.chat?.type !== 'private') return
        const uid = ctx.from?.id
        if (!uid) return
        if (!config.isSuper(uid)) return

        const s = getAdminSession(uid)
        const text = (ctx.message as any).text?.trim() || ''
        if (!text) return

        // ➕ Добавление админа
        if (s.mode === 'ADD_ADMIN__ASK_ID') {
            try {
                const targetId = Number(text)
                if (!Number.isFinite(targetId) || !/^\d+$/.test(text)) {
                    await ctx.eReply('Введите числовой ID пользователя.')
                    return
                }

                const current = config.get()
                const admins: number[] = Array.isArray(current.adminUserIds) ? current.adminUserIds : []

                // Уже админ/супер — сообщаем и выходим
                if (admins.includes(targetId) || config.isSuper(targetId)) {
                    await ctx.eReply(
                        `Пользователь ${targetId} ${await usernameOf(bot, targetId)} уже является администратором.`,
                        adminMenuKeyboard()
                    )
                    resetAdminSession(uid)
                    return
                }

                // Добавляем и сохраняем
                config.addAdmin(targetId)
                await config.save()
                resetAdminSession(uid)

                const uname = await usernameOf(bot, targetId)
                const list = await adminsListText(bot, config)
                await ctx.eReply(
                    `✅ Пользователь ${targetId} ${uname} добавлен в администраторы.\n\n${list}`,
                    adminMenuKeyboard()
                )
            } catch (e) {
                console.error('[ADD_ADMIN__ASK_ID error]', e)
                await ctx.eReply('Не удалось добавить администратора. Проверьте ID и попробуйте снова.', adminMenuKeyboard())
                // сессию не сбрасываем — можно ввести ещё раз
            }
            return
        }

        // ➖ Удаление админа
        if (s.mode === 'DEL_ADMIN__ASK_ID') {
            try {
                const targetId = Number(text)
                if (!Number.isFinite(targetId) || !/^\d+$/.test(text)) {
                    await ctx.eReply('Введите числовой ID администратора.')
                    return
                }

                const current = config.get()
                const admins: number[] = Array.isArray(current.adminUserIds) ? current.adminUserIds : []

                // Не админ — сообщаем и выходим
                if (!admins.includes(targetId)) {
                    await ctx.eReply(
                        `Пользователь ${targetId} ${await usernameOf(bot, targetId)} не является администратором.`,
                        adminMenuKeyboard()
                    )
                    resetAdminSession(uid)
                    return
                }

                // Удаляем и сохраняем
                config.removeAdmin(targetId)
                await config.save()
                resetAdminSession(uid)

                const uname = await usernameOf(bot, targetId)
                const list = await adminsListText(bot, config)
                await ctx.eReply(
                    `✅ Пользователь ${targetId} ${uname} удалён из администраторов.\n\n${list}`,
                    adminMenuKeyboard()
                )
            } catch (e) {
                console.error('[DEL_ADMIN__ASK_ID error]', e)
                await ctx.eReply('Не удалось удалить администратора. Проверьте ID и попробуйте снова.', adminMenuKeyboard())
                // сессию не сбрасываем — можно ввести ещё раз
            }
            return
        }
    })

    // 🔄 Импорт страниц из Google Sheets
    bot.action('ADM_IMPORT_ALL_SHEETS', async (ctx) => {
        if (!config.isSuper(ctx.from?.id ?? -1)) {
            await ctx.answerCbQuery('⛔ Только суперпользователь может это сделать.', { show_alert: true })
            return
        }
        await ctx.answerCbQuery()

        try {
            const SHEET_ID = '1_lH4wr7BrgYxHS3e3wNJLAby28diEkTr84Lx_I5823M'

            // Сейчас у тебя один лист. Когда появятся новые — просто добавь ещё объекты.
            const SHEETS = [
                { gid: 0, title: 'APPLE' },
                // { gid: 12345, title: 'ANDROID' },
                // { gid: 67890, title: 'CONSOLES' },
            ]

            const res = await importWorkbookGroups(config, SHEET_ID, SHEETS)

            await ctx.eReply(
                `✅ Импорт завершён.
Добавлено: ${res.added}
Обновлено: ${res.updated}
Групп добавлено: ${res.groupsAdded}
Разделов добавлено: ${res.chaptersAdded}`,
                { reply_markup: (adminMenuKeyboard() as any).reply_markup }
            )
        } catch (e) {
            console.error('[ADM_IMPORT_ALL_SHEETS]', e)
            await ctx.eReply('⚠️ Ошибка импорта. Проверь доступ и формат таблицы.', {
                reply_markup: (adminMenuKeyboard() as any).reply_markup,
            })
        }
    })

    bot.action('ADM_BACK_TO_MAIN', async (ctx) => {
        try { await ctx.answerCbQuery() } catch {}

        const uid = ctx.from?.id
        if (!uid) return

        resetAdminSession(uid)

        const cfg = config.get()
        const text = `${cfg.texts.welcome}${ctx.from?.first_name ? `, ${ctx.from.first_name}` : ''}`
        const kb = buildKeyboard(ctx, 'MAIN', config)

        // ВАЖНО: именно форс-замена (НЕ ctx.reply, НЕ show)
        await showReplaceFromCallback(ctx as any, text, kb)
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

    await show(ctx, text, adminMenuKeyboard())
}