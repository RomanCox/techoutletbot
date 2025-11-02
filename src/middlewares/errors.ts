import type { MiddlewareFn } from 'telegraf'
import type { Context } from 'telegraf'

/**
 * Универсальный error-мидлвар.
 * Ловит исключения в любом handler, логирует и не даёт боту “упасть”.
 */
export const errorsMiddleware = (): MiddlewareFn<Context> => {
    return async (ctx: any, next) => {
        try {
            await next()
        } catch (err) {
            console.error('[Telegraf Error]', err)
            try {
                if (ctx?.chat?.type === 'private') {
                    await ctx.eReply?.('⚠️ Произошла ошибка. Мы уже разбираемся.')
                }
            } catch {}
        }
    }
}

/**
 * Дополнительно можно повесить глобальный catcher Telegraf (необязательно).
 * Вызывай в точке сборки, если хочешь перехватывать ошибки вне middleware-цепочки.
 */
export function registerGlobalErrorHandler(bot: import('telegraf').Telegraf) {
    bot.catch((err, _ctx) => {
        console.error('[Telegraf Global Catch]', err)
        // try { ctx.reply('⚠️ Непредвиденная ошибка.') } catch {}
    })
}
