// src/app/bot.ts
import { Telegraf } from 'telegraf';
import type { Ctx } from '@core/types.js';
import { errorsMiddleware } from '@middlewares/errors.js';
import { aclMiddleware } from '@middlewares/acl.js';

export function buildBot({ token, config }: { token: string; config: any }) {
    const bot = new Telegraf<Ctx>(token)

    // глобальные middlewares
    bot.use(errorsMiddleware())
    bot.use(aclMiddleware({ onlyPrivate: true })) // применимо к командам, где нужно

    // при желании: bot.use(sessionMiddleware()) — см. раздел 4

    return bot
}
