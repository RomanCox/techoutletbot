// src/middlewares/errors.ts
import type { MiddlewareFn } from 'telegraf'
import type { Context } from 'telegraf'

/**
 * Универсальный error-мидлвар.
 * Ловит исключения в любом handler, логирует и не даёт боту “упасть”.
 */
export const errorsMiddleware = (): MiddlewareFn<Context> => {
    return async (ctx, next) => {
        try {
            await next()
        } catch (err: unknown) {
            // Лог в консоль — чтобы видеть stack trace в dev/prod
            console.error('[Telegraf Error]', err)

            // По желанию: тихо уведомим пользователя
            // (не в инлайне, чтобы не сыпать алертами в группах)
            try {
                if (ctx?.chat?.type === 'private') {
                    await ctx.reply('⚠️ Произошла ошибка. Мы уже разбираемся.')
                }
            } catch {
                // игнорим вторичную ошибку отправки сообщения
            }
        }
    }
}

/**
 * Дополнительно можно повесить глобальный catcher Telegraf (необязательно).
 * Вызывай в точке сборки, если хочешь перехватывать ошибки вне middleware-цепочки.
 */
export function registerGlobalErrorHandler(bot: import('telegraf').Telegraf) {
    bot.catch((err, ctx) => {
        console.error('[Telegraf Global Catch]', err)
        // try { ctx.reply('⚠️ Непредвиденная ошибка.') } catch {}
    })
}
