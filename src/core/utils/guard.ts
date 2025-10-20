// src/core/utils/guard.ts
import type { Ctx } from '@core/types.js';

export const onlyPrivate = (ctx: Ctx) => ctx.chat?.type === 'private'

export const ensureAdmin = (ctx: Ctx, config: any) => {
    const userId = ctx.from?.id
    if (!userId || !config.isAdmin(userId)) {
        ctx.reply('⛔ Недостаточно прав.')
        return false
    }
    return true
}

export const ensureSuper = (ctx: Ctx, config: any) => {
    const userId = ctx.from?.id
    if (!userId || !config.isSuper(userId)) {
        ctx.reply('⛔ Только суперпользователь может это сделать.')
        return false
    }
    return true
}
