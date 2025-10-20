import { readFile, writeFile } from 'node:fs/promises';
import { access, constants } from 'node:fs';
import type { ConfigData, Button } from '@core/types.js';

const CONFIG_PATH = './config.json';

export class ConfigStore {
	private data!: ConfigData;
	private saving = Promise.resolve();

	async load(): Promise<ConfigData> {
		// если файла нет — бросим ошибку с подсказкой
		try {
			await new Promise<void>((resolve, reject) =>
				access(CONFIG_PATH, constants.F_OK, (err) => (err ? reject(err) : resolve()))
			);
		} catch {
			throw new Error(
				`Файл ${CONFIG_PATH} не найден. Создайте его по образцу из инструкции.`
			);
		}

		const raw = await readFile(CONFIG_PATH, 'utf-8');
		this.data = JSON.parse(raw);
		return this.data;
	}

	get(): ConfigData {
		if (!this.data) throw new Error('Config not loaded');
		return this.data;
	}

	async save(): Promise<void> {
		const json = JSON.stringify(this.data, null, 2);
		// простая последовательная запись (на случай частых апдейтов)
		this.saving = this.saving.then(() => writeFile(CONFIG_PATH, json, 'utf-8'));
		await this.saving;
	}

	// ——— Rights management utilities ———
	isSuper(userId: number) {
		return Array.isArray(this.data.superUserIds) && this.data.superUserIds.includes(userId);
	}
	isAdmin(userId: number) {
		return this.isSuper(userId) || (Array.isArray(this.data.adminUserIds) && this.data.adminUserIds.includes(userId));
	}
	addAdmin(userId: number) {
		if (!this.data.adminUserIds.includes(userId) && !this.isSuper(userId)) {
			this.data.adminUserIds.push(userId);
		}
	}
	removeAdmin(userId: number) {
		this.data.adminUserIds = this.data.adminUserIds.filter((id) => id !== userId);
	}

	// ——— Texts ———
	setWelcome(text: string) {
		this.data.texts.welcome = text;
	}
	setResponse(payload: string, text: string) {
		this.data.responses[payload] = text;
	}

	// ——— Buttons ———
	addButton(button: Button) {
		if (this.data.buttons.some((b) => b.id === button.id)) {
			throw new Error(`Кнопка с id "${button.id}" уже существует`);
		}
		this.data.buttons.push(button);
	}
	removeButton(id: string) {
		this.data.buttons = this.data.buttons.filter((b) => b.id !== id);
	}
	renameButton(id: string, newLabel: string) {
		const btn = this.data.buttons.find((b) => b.id === id);
		if (!btn) throw new Error(`Кнопка "${id}" не найдена`);
		btn.label = newLabel;
	}
}
