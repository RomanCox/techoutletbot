// src/core/ui/keyboards.ts
import { Markup } from 'telegraf';
import type { Ctx } from '@core/types.js';

export function adminMenuKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить кнопку', 'ADM_ADD_BTN')],
        [Markup.button.callback('📝 Редактировать кнопку', 'ADM_EDIT_BTN')],
        [Markup.button.callback('🗑 Удалить кнопку', 'ADM_DEL_BTN')],
        [Markup.button.callback('📋 Список кнопок', 'ADM_LIST_BTNS')],
        [Markup.button.callback('💬 Изменить приветствие', 'ADM_SET_WELCOME')],
        [Markup.button.callback('💡 Изменить ответ payload', 'ADM_SET_RESPONSE')],
        [Markup.button.callback('⬅️ В главное меню', 'ADM_BACK_TO_MAIN')],
    ])
}

export function buildKeyboard(ctx: Ctx | undefined, chapter: string, config: any) {
    const rows = config.get().buttons
        .filter((b: any) => b.chapter === chapter)
        .map((b: any) =>
            b.type === 'callback'
                ? [Markup.button.callback(b.label, b.payload)]
                : [Markup.button.url(b.label, b.url)]
        )

    // ↩️ «Назад в главное меню» — во всех разделах, кроме MAIN
    if (chapter !== 'MAIN') {
        rows.push([Markup.button.callback('⬅️ Назад в главное меню', 'MAIN')])
    }

    // ⚙️ Admin Panel — ТОЛЬКО в главном меню
    if (
        chapter === 'MAIN' &&                     // ← ключевая правка
        ctx &&
        ctx.chat?.type === 'private' &&
        ctx.from?.id &&
        config.isAdmin(ctx.from.id)
    ) {
        rows.push([Markup.button.callback('⚙️ Admin Panel', 'ADMIN')])
    }

    return Markup.inlineKeyboard(rows)
}

