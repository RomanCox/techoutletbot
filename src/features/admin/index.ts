import type { Telegraf } from 'telegraf'
import type { Ctx } from '@core/types.js'
import { adminMenuKeyboard, buildKeyboard } from '@core/ui/keyboards.js'
import { getAdminSession, resetAdminSession, setAdminSession } from '@core/session/fsm.js'
import { importWorkbookGroups } from '@core/importers/sheetGroup.js'
import { show, showReplaceFromCallback } from '@core/ui/switcher.js'
import { listSheets } from '@core/importers/listSheets.js'

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
            `⚙️ Admin Panel`,
            adminMenuKeyboard()
        )
    })

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

    bot.on('message', async (ctx) => {
        if (ctx.chat?.type !== 'private') return
        const uid = ctx.from?.id
        if (!uid) return
        if (!config.isSuper(uid)) return

        const s = getAdminSession(uid)
        const text = (ctx.message as any).text?.trim() || ''
        if (!text) return

        if (s.mode === 'ADD_ADMIN__ASK_ID') {
            try {
                const targetId = Number(text)
                if (!Number.isFinite(targetId) || !/^\d+$/.test(text)) {
                    await ctx.eReply('Введите числовой ID пользователя.')
                    return
                }

                const current = config.get()
                const admins: number[] = Array.isArray(current.adminUserIds) ? current.adminUserIds : []

                if (admins.includes(targetId) || config.isSuper(targetId)) {
                    await ctx.eReply(
                        `Пользователь ${targetId} ${await usernameOf(bot, targetId)} уже является администратором.`,
                        adminMenuKeyboard()
                    )
                    resetAdminSession(uid)
                    return
                }

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
            }
            return
        }

        if (s.mode === 'DEL_ADMIN__ASK_ID') {
            try {
                const targetId = Number(text)
                if (!Number.isFinite(targetId) || !/^\d+$/.test(text)) {
                    await ctx.eReply('Введите числовой ID администратора.')
                    return
                }

                const current = config.get()
                const admins: number[] = Array.isArray(current.adminUserIds) ? current.adminUserIds : []

                if (!admins.includes(targetId)) {
                    await ctx.eReply(
                        `Пользователь ${targetId} ${await usernameOf(bot, targetId)} не является администратором.`,
                        adminMenuKeyboard()
                    )
                    resetAdminSession(uid)
                    return
                }

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
            }
            return
        }
    })

    bot.action('ADM_IMPORT_ALL_SHEETS', async (ctx) => {
        if (!config.isSuper(ctx.from?.id ?? -1)) {
            await ctx.answerCbQuery('⛔ Только суперпользователь может это сделать.', { show_alert: true })
            return
        }

        const s: any = (ctx as any).session ?? ((ctx as any).session = {})

        if (s.isImporting) {
            try { await ctx.answerCbQuery('Импорт уже выполняется…') } catch {}
            return
        }

        const SHEET_ID = process.env.GOOGLE_SHEET_ID!
        if (!SHEET_ID) {
            const kb = buildKeyboard(ctx as any, 'MAIN', config)
            await showReplaceFromCallback(
                ctx as any,
                '❌ GOOGLE_SHEET_ID не задан в .env',
                kb,
            )
            return
        }

        s.isImporting = true

        try {
            try {
                await ctx.answerCbQuery('Импорт запущен…')
            } catch {}

            const kbBusy = adminMenuKeyboard(true)
            await showReplaceFromCallback(
                ctx as any,
                '⏳ Импорт данных из таблицы…\nЭто может занять несколько секунд.',
                kbBusy,
            )

            const allSheets = await listSheets(SHEET_ID)

            const SHEETS = allSheets
                .filter(s => !s.title.startsWith('_'))
                .map(s => ({ gid: s.gid, title: s.title }))

            if (!SHEETS.length) {
                const kb = buildKeyboard(ctx as any, 'MAIN', config)
                await showReplaceFromCallback(
                    ctx as any,
                    '⚠️ Не нашёл ни одной вкладки для импорта.',
                    kb,
                )
                return
            }

            const res = await importWorkbookGroups(config, SHEET_ID, SHEETS)

            const text =
                `✅ Импорт завершён.\n` +
                `Добавлено: ${res.added}\n` +
                `Обновлено: ${res.updated}\n` +
                `Групп добавлено: ${res.groupsAdded}\n` +
                `Разделов добавлено: ${res.chaptersAdded}`

            const kbAdmin = buildKeyboard(ctx as any, 'MAIN', config)
            await showReplaceFromCallback(ctx as any, text, kbAdmin)
        } catch (e: any) {
            console.error('[ADM_IMPORT_ALL_SHEETS] error', e)
            const kbAdmin = adminMenuKeyboard(false)
            await showReplaceFromCallback(
                ctx as any,
                '⚠️ Ошибка импорта. Проверь доступ к таблице / лог сервера.',
                kbAdmin,
            )
        } finally {
            s.isImporting = false
        }
    })

    bot.action('ADM_BACK_TO_MAIN', async (ctx) => {
        try { await ctx.answerCbQuery() } catch {}

        const uid = ctx.from?.id
        if (!uid) return

        resetAdminSession(uid)

        const cfg = config.get()
        const text = cfg.texts.welcome
        const kb = buildKeyboard(ctx, 'MAIN', config)

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