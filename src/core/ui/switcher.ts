import type { Ctx } from '@core/types.js'
import type { InlineKeyboardMarkup } from 'telegraf/types'

/** Универсально: пытаемся редактировать, иначе — новое + delete старого */
export async function show(ctx: Ctx, text: string, keyboard: any): Promise<void> {
    const replyMarkup: InlineKeyboardMarkup | undefined = keyboard?.reply_markup
    const cbMsg: any = (ctx.callbackQuery as any)?.message
    const origChatId = cbMsg?.chat?.id as number | undefined
    const origMsgId  = cbMsg?.message_id as number | undefined

    try { await ctx.answerCbQuery() } catch {}

    if (origChatId && origMsgId) {
        try {
            await ctx.editMessageText(text, { reply_markup: replyMarkup, parse_mode: 'HTML' })
            if (ctx.session) (ctx.session as any).activeMessageId = origMsgId
            return
        } catch {}
    }

    // fallback: eReply (сам удалит activeMessageId), затем попробуем снести старое
    const msg = await ctx.eReply(text, { reply_markup: replyMarkup, parse_mode: 'HTML' })
    if (origChatId && origMsgId && msg?.message_id !== origMsgId) {
        try { await ctx.telegram.deleteMessage(origChatId, origMsgId) } catch {}
    }
}

/** Специально для MAIN: всегда шлём новое, потом удаляем старое (никакого edit) */
export async function showReplaceFromCallback(ctx: Ctx, text: string, keyboard: any): Promise<void> {
    const replyMarkup: InlineKeyboardMarkup | undefined = keyboard?.reply_markup
    const cbMsg: any = (ctx.callbackQuery as any)?.message
    const origChatId = cbMsg?.chat?.id as number | undefined
    const origMsgId  = cbMsg?.message_id as number | undefined

    try { await ctx.answerCbQuery() } catch {}

    const msg = await ctx.eReply(text, { reply_markup: replyMarkup, parse_mode: 'HTML' })

    if (origChatId && origMsgId && msg?.message_id !== origMsgId) {
        try { await ctx.telegram.deleteMessage(origChatId, origMsgId) } catch {}
    }
}