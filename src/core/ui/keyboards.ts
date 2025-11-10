import { Markup } from 'telegraf'
import type { Ctx, Button } from '@core/types.js'
import { renderItemLabel } from '@core/utils/helper.js'

export function adminMenuKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Импорт данных (все листы)', 'ADM_IMPORT_ALL_SHEETS')],
        // [Markup.button.callback('➕ Добавить кнопку', 'ADM_ADD_BTN')],
        // [Markup.button.callback('📝 Редактировать кнопку', 'ADM_EDIT_BTN')],
        // [Markup.button.callback('🗑 Удалить кнопку', 'ADM_DEL_BTN')],
        // [Markup.button.callback('📋 Список кнопок', 'ADM_LIST_BTNS')],
        // [Markup.button.callback('💬 Изменить приветствие', 'ADM_SET_WELCOME')],
        // [Markup.button.callback('💡 Изменить ответ payload', 'ADM_SET_RESPONSE')],
        // [Markup.button.callback('👤➕ Добавить админа', 'ADM_ADD_ADMIN')],
        // [Markup.button.callback('👤➖ Удалить админа', 'ADM_DEL_ADMIN')],
        [Markup.button.callback('⬅️ В главное меню', 'ADM_BACK_TO_MAIN')],
    ])
}

export function buildKeyboard(ctx: Ctx | undefined, chapter: string, config: any) {
    const rows = (config.get().buttons as Button[])
        .filter((b) => b.chapter === chapter && b.chapter !== '_HIDDEN')
        .map((b) => {
            if (b.type === 'callback') {
                const text =
                    b.payload.startsWith('ITEM:')
                        ? renderItemLabel(b)
                        : b.label

                return [Markup.button.callback(text, b.payload as string)]
            } else {
                const deep = buildDeepLink(b.url, b.prefillText)
                return [Markup.button.url(b.label, deep)]
            }
        })

    if (chapter !== 'MAIN') {
        const parents: Record<string, string> = config.get().parents || {}

        const parent = parents[chapter] || 'MAIN'

        const isFirstLevel = parent === 'MAIN'

        if (!isFirstLevel) {
            rows.push([Markup.button.callback('⬅️ Назад', parent)])
        }

        rows.push([Markup.button.callback('⬅️ В главное меню', 'MAIN')])
    }

    if (
        chapter === 'MAIN' &&
        ctx &&
        ctx.chat?.type === 'private' &&
        ctx.from?.id &&
        config.isAdmin(ctx.from.id)
    ) {
        rows.push([Markup.button.callback('⚙️ Admin Panel', 'ADMIN')])
    }

    return Markup.inlineKeyboard(rows)
}

export function buildDeepLink(baseUrl: string, prefill?: string) {
    if (!prefill) return baseUrl

    const raw = baseUrl.replace('https://t.me/@', 'https://t.me/')
    const encodedText = encodeURIComponent(prefill)

    try {
        const u = new URL(raw)
        if (u.hostname === 't.me' && u.pathname && u.pathname !== '/share/url') {
            const base = `${u.origin}${u.pathname}`
            return `${base}?text=${encodedText}`
        }
    } catch {
    }

    const encodedUrl = encodeURIComponent(raw)
    return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
}