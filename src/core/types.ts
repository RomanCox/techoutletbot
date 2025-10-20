// src/core/types.ts
import type { Context } from 'telegraf';

/**
 * Базовый контекст Telegraf.
 * Если позже добавишь свои поля (например, session), расширишь тут.
 */
export type Ctx = Context

/** Глава (раздел) меню. Резервируем MAIN, остальные — любые строки. */
export type Chapter = 'MAIN' | string

/** Зарезервированные payload’ы для служебных кнопок. */
export type ReservedPayload = 'ADMIN' | 'MAIN' | `ADM_${string}`

/** Кнопки меню */
export interface ButtonBase {
    id: string
    label: string
    chapter: Chapter
}

export interface ButtonCallback extends ButtonBase {
    type: 'callback'
    payload: string // может совпадать с названием chapter для перехода в раздел
}

export interface ButtonUrl extends ButtonBase {
    type: 'url'
    url: string
}

export type Button = ButtonCallback | ButtonUrl

/** Конфигурация бота, которую хранит ConfigStore */
export interface ConfigData {
    texts: {
        welcome: string
    }
    buttons: Button[]
    responses: Record<string, string>
    adminUserIds: number[]
    superUserIds: number[]
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
