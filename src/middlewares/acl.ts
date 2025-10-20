// src/middlewares/acl.ts
import type { MiddlewareFn } from 'telegraf';
import type { Ctx } from '@core/types.js';

export const aclMiddleware = (opts: { onlyPrivate?: boolean } = {}): MiddlewareFn<Ctx> => {
    return async (ctx, next) => {
        if (opts.onlyPrivate && ctx.chat?.type !== 'private') return
        return next()
    }
}
