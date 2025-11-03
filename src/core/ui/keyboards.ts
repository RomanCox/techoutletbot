import { Markup } from 'telegraf'
import type { Ctx, Button } from '@core/types.js'
import { renderItemLabel } from '@core/utils/helper.js'

// ⚙️ Админ-панель
export function adminMenuKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Импорт данных (все листы)', 'ADM_IMPORT_ALL_SHEETS')],
        [Markup.button.callback('➕ Добавить кнопку', 'ADM_ADD_BTN')],
        [Markup.button.callback('📝 Редактировать кнопку', 'ADM_EDIT_BTN')],
        [Markup.button.callback('🗑 Удалить кнопку', 'ADM_DEL_BTN')],
        [Markup.button.callback('📋 Список кнопок', 'ADM_LIST_BTNS')],
        [Markup.button.callback('💬 Изменить приветствие', 'ADM_SET_WELCOME')],
        [Markup.button.callback('💡 Изменить ответ payload', 'ADM_SET_RESPONSE')],
        [Markup.button.callback('👤➕ Добавить админа', 'ADM_ADD_ADMIN')],
        [Markup.button.callback('👤➖ Удалить админа', 'ADM_DEL_ADMIN')],
        [Markup.button.callback('⬅️ В главное меню', 'ADM_BACK_TO_MAIN')],
    ])
}

export function buildKeyboard(ctx: Ctx | undefined, chapter: string, config: any) {
    const rows = (config.get().buttons as Button[])
        .filter((b) => b.chapter === chapter && b.chapter !== '_HIDDEN')
        .map((b) => {
            if (b.type === 'callback') {
                const text =
                    typeof b.payload === 'string' && b.payload.startsWith('ITEM:')
                        ? renderItemLabel(b)          // <-- товары форматируем аккуратно
                        : b.label                     // категории/меню показываем как есть

                return [Markup.button.callback(text, b.payload as string)]
            } else {
                return [Markup.button.url(b.label, b.url)]
            }
        })

    // ↩️ «В главное меню» — во всех разделах, кроме MAIN
    if (chapter !== 'MAIN') {
        const parents: Record<string, string> = config.get().parents || {}

        // если родитель не задан, считаем, что родитель = MAIN (это вернёт поведение для PRODUCT_GROUP)
        const parent = parents[chapter] || 'MAIN'

        const isFirstLevel = parent === 'MAIN' // т.е. мы на первом уровне под MAIN (например, PRODUCT_GROUP → APPLE = false; PRODUCT_GROUP сам → true)

        // Показываем «⬅️ Назад» ТОЛЬКО если это не первый уровень
        if (!isFirstLevel) {
            rows.push([Markup.button.callback('⬅️ Назад', parent)])
        }

        // «⬅️ В главное меню» показываем всегда (кроме MAIN)
        rows.push([Markup.button.callback('⬅️ В главное меню', 'MAIN')])
    }

    // ⚙️ Admin Panel — ТОЛЬКО в главном меню
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

    // Нормализация: https://t.me/@user → https://t.me/user
    const raw = baseUrl.replace('https://t.me/@', 'https://t.me/')
    const encodedText = encodeURIComponent(prefill)

    try {
        const u = new URL(raw)
        // Если это ссылка вида https://t.me/<username|bot> — используем ?text=...
        if (u.hostname === 't.me' && u.pathname && u.pathname !== '/share/url') {
            // Собираем query вручную, чтобы пробелы были %20, а не +
            const base = `${u.origin}${u.pathname}`
            return `${base}?text=${encodedText}`
        }
    } catch {
        // ignore and fallback below
    }

    // Fallback: универсальный шэрер
    const encodedUrl = encodeURIComponent(raw)
    return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
}