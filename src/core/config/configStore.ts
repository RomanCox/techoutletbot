import fs from 'node:fs/promises'
import path from 'node:path'
import type { ConfigData, Button } from '@core/types.js'

export class ConfigStore {
    private filePath: string
    private data: ConfigData

    constructor(filePath = path.resolve(process.cwd(), 'config.json')) {
        this.filePath = filePath
        this.data = {
            superUserIds: [],
            adminUserIds: [],
            texts: {
                welcome: 'Привет! Я помогу с выбором товаров и связью с менеджером',
            },
            buttons: [],
            responses: {},
        }
    }

    /** Генерация новых данных */
    setAll(next: ConfigData) {
        this.data = next
    }

    /** Частичная генерация новых данных */
    set(partial: Partial<ConfigData>) {
        this.data = { ...this.data, ...partial }
    }

    /** Загружаем конфиг из файла */
    async load() {
        try {
            const raw = await fs.readFile(this.filePath, 'utf8')
            this.data = JSON.parse(raw) as ConfigData
        } catch (err) {
            console.warn('[ConfigStore] config.json не найден — создаём дефолтный')
            await this.save()
        }
    }

    /** Сохраняем конфиг в файл */
    async save() {
        await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
    }

    /** Возвращаем текущие данные */
    get() {
        return this.data
    }

    /** Проверка прав */
    isSuper(userId: number) {
        return (
            Array.isArray(this.data.superUserIds) &&
            this.data.superUserIds.includes(userId)
        )
    }

    isAdmin(userId: number) {
        return (
            this.isSuper(userId) ||
            (Array.isArray(this.data.adminUserIds) &&
                this.data.adminUserIds.includes(userId))
        )
    }

    /** Добавление/удаление админов */
    addAdmin(userId: number) {
        if (!this.data.adminUserIds.includes(userId) && !this.isSuper(userId)) {
            this.data.adminUserIds.push(userId)
        }
    }

    removeAdmin(userId: number) {
        this.data.adminUserIds = this.data.adminUserIds.filter((id) => id !== userId)
    }

    /** Работа с кнопками */
    addButton(btn: Button) {
        const idx = this.data.buttons.findIndex((b) => b.id === btn.id)
        if (idx !== -1) this.data.buttons[idx] = btn
        else this.data.buttons.push(btn)
    }

    removeButton(id: string) {
        this.data.buttons = this.data.buttons.filter((b) => b.id !== id)
    }
}