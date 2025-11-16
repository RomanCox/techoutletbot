import type { Context } from 'telegraf'
import type { ConfigStore } from '@core/config/configStore.js'
import type { SessionData } from '@core/ambient/telegraf.js'

/**
 * Базовый контекст Telegraf.
 * Если позже добавишь свои поля (например, session), расширишь тут.
 */
export type Ctx = Context

declare module 'telegraf' {
    interface Context {
        session: SessionData
        config: ConfigStore
        eReply: (text: string, extra?: Parameters<Context['reply']>[1]) => Promise<import('telegraf/types').Message.TextMessage>
    }
}

/** Глава (раздел) меню. Резервируем MAIN, остальные — любые строки. */
export type Chapter = 'MAIN' | string

/** Зарезервированные payload’ы для служебных кнопок. */
export type ReservedPayload = 'ADMIN' | 'MAIN' | `ADM_${string}`

/** Кнопки меню */
export interface ButtonBase {
    id: string
    label: string
    chapter: Chapter
    price?: string
    priceFrom?: boolean
    priceRequest?: boolean
}

export interface ButtonCallback extends ButtonBase {
    type: 'callback'
    payload: string
}

export interface ButtonUrl extends ButtonBase {
    type: 'url'
    url: string
    /** опционально: текст, которым нужно предзаполнить сообщение менеджеру */
    prefillText?: string
}

export type Button = ButtonCallback | ButtonUrl

/** Конфигурация бота, которую хранит ConfigStore */
export interface ConfigData {
    superUserIds: number[]
    adminUserIds: number[]
    texts: {
        welcome: string
    }
    buttons: Button[]
    responses: Record<string, string>
    parents?: Record<string, string>
}

/** Интерфейс хранилища конфигурации */
export interface IConfigStore {
    load(): Promise<void>
    save(): Promise<void>
    get(): ConfigData

    isAdmin(userId: number): boolean
    isSuper(userId: number): boolean

    setWelcome(text: string): void
    setResponse(payload: string, text: string): void

    addButton(btn: Button): void
    removeButton(id: string): void
    renameButton(id: string, newLabel: string): void
}

/** Режимы FSM для админ-панели */
export type AdminMode =
    | 'IDLE'
    | 'ADD_BTN__ASK_ALL'
    | 'DEL_BTN__ASK_ID'
    | 'EDIT_BTN__ASK_ID'
    | 'EDIT_BTN__ASK_KEY'
    | 'EDIT_BTN__ASK_VALUE'
    | 'SET_WELCOME__ASK_TEXT'
    | 'SET_RESPONSE__ASK_BOTH'
    | 'ADD_ADMIN__ASK_ID'
    | 'DEL_ADMIN__ASK_ID'

/** Сессия администратора (FSM состояние) */
export interface AdminSession {
    mode: AdminMode
    /** Временные поля для редактирования */
    workingButtonId?: string
    workingKey?: 'id' | 'label' | 'type' | 'chapter' | 'payload' | 'url'
}

/**
 * Если захочешь расширить Telegraf Context глобально, можно так:
 *
 * declare module 'telegraf' {
 *   interface Context {
 *     // session?: { ...твои поля... }
 *   }
 * }
 */
