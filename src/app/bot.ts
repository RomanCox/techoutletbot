import { Telegraf, session } from 'telegraf'
import type { Ctx } from '@core/types.js'
import type { SessionData } from '@core/ambient/telegraf.d.ts'
import { errorsMiddleware } from '@middlewares/errors.js'
import { aclMiddleware } from '@middlewares/acl.js'
import { callbacksAntiSpam } from '@middlewares/antispam.js'

export function buildBot({ token, config }: { token: string; config: any }) {
    const bot = new Telegraf<Ctx>(token)

    bot.use(errorsMiddleware())

    const sessionMw = session({
        getSessionKey: (ctx) => {
            const fromId = ctx.from?.id
            const chatId =
                ctx.chat?.id ??
                (ctx.callbackQuery as any)?.message?.chat?.id ??
                (ctx.message as any)?.chat?.id
            return fromId && chatId ? `${fromId}:${chatId}` : undefined
        },
        defaultSession: (): SessionData => ({}),
    }) as unknown as import('telegraf').Middleware<Ctx>

    bot.use(sessionMw)

    bot.use((ctx, next) => {
        ctx.config = config

        const origReply = ctx.reply.bind(ctx)

        ctx.eReply = async (text, extra) => {
            const chatId =
                ctx.chat?.id ??
                (ctx.callbackQuery as any)?.message?.chat?.id ??
                (ctx.message as any)?.chat?.id

            const prevId = ctx.session.activeMessageId
            if (chatId && prevId) {
                try { await ctx.telegram.deleteMessage(chatId, prevId) } catch {}
                ctx.session.activeMessageId = undefined
            }

            const msg = await origReply(text, extra)
            ctx.session.activeMessageId = msg.message_id
            return msg
        }

        return next()
    })

    bot.use(aclMiddleware({ onlyPrivate: true }))

    // ✅ антиспам по кликам (подключаем ДО registerFeatures)
    bot.use(
        callbacksAntiSpam({
            cooldownMs: 500,
            enableLock: true,
            whitelistPayloads: [
                'MAIN',
                'ADMIN',
                'ADM_BACK_TO_MAIN',
                'ADM_IMPORT_ALL_SHEETS',
            ],
        })
    )

    return bot
}