import type { ConfigStore } from '@core/config/ConfigStore.js'

export interface SessionData {
    activeMessageId?: number
}

declare module 'telegraf' {
    interface Context {
        session: SessionData
        config: ConfigStore
        eReply: (
            text: string,
            extra?: Parameters<Context['reply']>[1]
        ) => Promise<import('telegraf/types').Message.TextMessage>
    }
}