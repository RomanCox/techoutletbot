import type { MiddlewareFn } from 'telegraf'
import type { Ctx } from '@core/types.js'

type LockerState = {
    lastAt: number
    locked: boolean
}

export type AntiSpamOptions = {
    /** Минимальный интервал между кликами (мс). По умолчанию 800 мс. */
    cooldownMs?: number
    /** Ставит «замок» на обработчик, чтобы не запускать второй раз, пока первый не завершился. */
    enableLock?: boolean
    /**
     * Список payload’ов, которые пропускаем без ограничений.
     * Рекомендуется whitelisting: MAIN, ADMIN, ADM_BACK_TO_MAIN и т.п.
     */
    whitelistPayloads?: string[]
}

/**
 * Антиспам для callback_query:
 * - Игнорирует клики чаще чем cooldownMs
 * - (опционально) Ставит «замок» на время выполнения обработчика
 * - Позволяет whitelist’ить payload’ы (например, "MAIN")
 */
export function callbacksAntiSpam(opts: AntiSpamOptions = {}): MiddlewareFn<Ctx> {
    const cooldownMs = Math.max(0, opts.cooldownMs ?? 800)
    const enableLock = !!opts.enableLock
    const whitelist = new Set<string>(opts.whitelistPayloads ?? [])

    // ключ — `${fromId}:${chatId}`
    const store = new Map<string, LockerState>()

    return async (ctx, next) => {
        // интересуют только callback_query
        const cq: any = (ctx as any).callbackQuery
        if (!cq) return next()

        const data: string | undefined = cq?.data
        if (!data) return next()

        // payload из вайтлиста — пропускаем
        if (whitelist.has(data)) return next()

        const fromId = ctx.from?.id
        const chatId =
            ctx.chat?.id ??
            cq?.message?.chat?.id ??
            (ctx.message as any)?.chat?.id

        if (!fromId || !chatId) return next()

        const key = `${fromId}:${chatId}`
        const now = Date.now()

        const st = store.get(key) ?? { lastAt: 0, locked: false }

        // 1) проверка на замок
        if (enableLock && st.locked) {
            try { await ctx.answerCbQuery('Подождите, выполняется действие…') } catch {}
            return // НЕ пускаем дальше
        }

        // 2) проверка cooldown
        const delta = now - st.lastAt
        if (delta < cooldownMs) {
            try { await ctx.answerCbQuery('Слишком часто. Попробуйте ещё раз чуть позже.') } catch {}
            return // НЕ пускаем дальше
        }

        // проходим: фиксируем время + ставим замок (если включён)
        st.lastAt = now
        if (enableLock) st.locked = true
        store.set(key, st)

        try {
            await next() // запускаем основной обработчик
        } finally {
            // снимаем замок и фиксируем «реальное» время завершения
            if (enableLock) st.locked = false
            st.lastAt = Date.now()
            store.set(key, st)
        }
    }
}