import 'dotenv/config';
import { Telegraf, Markup, Context } from 'telegraf';
import { ConfigStore } from './configStore.js';
import type { AdminSession, Ctx } from './types.js';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('❌ BOT_TOKEN не указан в .env');

const config = new ConfigStore();
await config.load();

const bot = new Telegraf<Ctx>(token);

// ——— helpers ———
const onlyPrivate = (ctx: Context) => ctx.chat?.type === 'private';
const ensureAdmin = (ctx: Ctx) => {
	if (!config.isAdmin(ctx.from.id)) {
		ctx.reply('⛔ Недостаточно прав.');
		return false;
	}
	return true;
};
const ensureSuper = (ctx: Ctx) => {
	if (!config.isSuper(ctx.from.id)) {
		ctx.reply('⛔ Только суперпользователь может это сделать.');
		return false;
	}
	return true;
};

const adminSessions = new Map<number, AdminSession>();

function getSession(userId: number): AdminSession {
	const s = adminSessions.get(userId);
	if (s) return s;
	const fresh: AdminSession = { mode: 'IDLE' };
	adminSessions.set(userId, fresh);
	return fresh;
}

function resetSession(userId: number) {
	adminSessions.set(userId, { mode: 'IDLE' });
}

function adminMenuKeyboard() {
	return Markup.inlineKeyboard([
		[Markup.button.callback('➕ Добавить кнопку', 'ADM_ADD_BTN')],
		[Markup.button.callback('📝 Редактировать кнопку', 'ADM_EDIT_BTN')],
		[Markup.button.callback('🗑 Удалить кнопку', 'ADM_DEL_BTN')],
		[Markup.button.callback('📋 Список кнопок', 'ADM_LIST_BTNS')],
		[Markup.button.callback('💬 Изменить приветствие', 'ADM_SET_WELCOME')],
		[Markup.button.callback('💡 Изменить ответ payload', 'ADM_SET_RESPONSE')],
		[Markup.button.callback('⬅️ В главное меню', 'ADM_BACK_TO_MAIN')],
	]);
}

async function sendAdminPanel(ctx: Ctx) {
	const help =
		`⚙️ Admin Panel

Выберите действие:
• Добавить кнопку
• Редактировать кнопку (любой ключ)
• Удалить кнопку
• Список кнопок
• Изменить приветствие
• Изменить ответ по payload`;
	await ctx.reply(help, adminMenuKeyboard());
}

function buildKeyboard(ctx: Ctx | undefined, chapter: string) {
	const rows = config.get().buttons
		.filter((b) => b.chapter === chapter)
		.map((b) => {
			return b.type === 'callback'
				? [Markup.button.callback(b.label, b.payload)]
				: [Markup.button.url(b.label, b.url)];
		});

	// ↩️ Добавляем «Назад в главное меню» во всех разделах, кроме MAIN
	if (chapter !== 'MAIN') {
		rows.push([Markup.button.callback('⬅️ Назад в главное меню', 'MAIN')]);
	}

	// Добавляем админ-кнопку только для админов/суперюзеров
	if (ctx && ctx.chat?.type === 'private' && config.isAdmin(ctx.from.id)) {
		rows.push([Markup.button.callback('⚙️ Admin Panel', 'ADMIN')]);
	}

	return Markup.inlineKeyboard(rows);
}

// ——— Команды справки ———
bot.command('whoami', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	await ctx.reply(`Ваш ID: \`${ctx.from.id}\``, { parse_mode: 'Markdown' });
});

bot.command('help', async (ctx) => {
	if (!onlyPrivate(ctx)) return;

	const isAdmin = config.isAdmin(ctx.from.id);
	const isSuper = config.isSuper(ctx.from.id);

	const base = [
		'Доступные команды:',
		'• /menu — показать меню (глава MAIN)',
		'• /whoami — показать ваш Telegram ID',
		'• /help — эта справка',
	];

	const admin = !isAdmin ? [] : [
		'',
		'— Админ-команды —',
		'• Нажмите кнопку «⚙️ Admin Panel» внизу — там интерактивное меню.',
		'• /setwelcome <текст> — изменить приветствие',
		'• /setresponse <payload> | <текст> — текст ответа на callback-кнопку',
		'• /addbtn_callback <id> | <label> | <payload>',
		'• /addbtn_callback <id> | <label> | <chapter> | <payload>',
		'• /addbtn_url <id> | <label> | <url>',
		'• /addbtn_url <id> | <label> | <chapter> | <url>',
		'• /renamebtn <id> | <new label> — переименовать кнопку',
		'• /delbtn <id> — удалить кнопку',
		'',
		'Примечания:',
		'• chapter определяет, в каком «разделе» показывается кнопка (например, MAIN, PRODUCT_GROUP).',
		'• Если payload совпадает с названием главы, по нажатию откроется эта глава.',
	];

	const superSec = !isSuper ? [] : [
		'',
		'— Команды суперпользователя —',
		'• /addadmin <userId> — выдать права админа',
		'• /addadmin (ответом на сообщение пользователя) — выдать права адресату',
		'• /deladmin <userId> — забрать права админа',
	];

	const helpText = [...base, ...admin, ...superSec].join('\n');

	await ctx.reply(helpText);
});


// ——— Базовое меню и старт ———
bot.start(async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	const name = ctx.from?.first_name ? `, ${ctx.from.first_name}` : '';
	await ctx.reply(`${config.get().texts.welcome}${name}`, buildKeyboard(ctx as Ctx, 'MAIN'));
});

bot.command('menu', (ctx) => {
	if (!onlyPrivate(ctx)) return;
	ctx.reply('Выберите действие:', buildKeyboard(ctx as Ctx, 'MAIN'));
});

// ——— Динамические кнопки (callback) ———
bot.on('callback_query', async (ctx) => {
	const data = (ctx.callbackQuery as any)?.data as string | undefined;
	if (!data) return;

	// ADMIN — «раздел» админ-панели
	if (data === 'ADMIN') {
		if (!config.isAdmin((ctx as Ctx).from.id)) {
			await ctx.answerCbQuery('⛔ Недостаточно прав.', { show_alert: true });
			return;
		}
		await ctx.answerCbQuery();
		resetSession((ctx as Ctx).from.id);
		await sendAdminPanel(ctx as Ctx);
		return;
	}

	// ADM_* — элементы админ-меню (единая обработка тут)
	if (data.startsWith('ADM_')) {
		const uid = (ctx as Ctx).from.id;
		if (!config.isAdmin(uid)) {
			await ctx.answerCbQuery('⛔ Недостаточно прав.', { show_alert: true });
			return;
		}
		await ctx.answerCbQuery();
		const s = getSession(uid);

		switch (data) {
			case 'ADM_ADD_BTN':
				s.mode = 'ADD_BTN__ASK_ALL';
				await ctx.reply(
					'Отправьте параметры кнопки в одной строке:\n' +
					'`id | label | type(callback|url) | chapter | payload_or_url`',
					{ parse_mode: 'Markdown' }
				);
				return;

			case 'ADM_DEL_BTN':
				s.mode = 'DEL_BTN__ASK_ID';
				await ctx.reply('Укажите `id` кнопки, которую нужно удалить.', { parse_mode: 'Markdown' });
				return;

			case 'ADM_EDIT_BTN':
				s.mode = 'EDIT_BTN__ASK_ID';
				await ctx.reply('Укажите `id` кнопки, которую будем редактировать.', { parse_mode: 'Markdown' });
				return;

			case 'ADM_LIST_BTNS': {
				const btns = config.get().buttons
					.map(b => `• id: ${b.id} | label: ${b.label} | type: ${'type' in b ? b.type : 'n/a'} | chapter: ${b.chapter}`)
					.join('\n');
				await ctx.reply(btns || 'Список пуст.');
				return;
			}

			case 'ADM_SET_WELCOME':
				s.mode = 'SET_WELCOME__ASK_TEXT';
				await ctx.reply('Отправьте новый текст приветствия (одним сообщением).');
				return;

			case 'ADM_SET_RESPONSE':
				s.mode = 'SET_RESPONSE__ASK_BOTH';
				await ctx.reply('Отправьте строку: `payload | текст ответа`', { parse_mode: 'Markdown' });
				return;

			case 'ADM_BACK_TO_MAIN':
				resetSession(uid);
				await ctx.reply('Главное меню:', buildKeyboard(ctx as Ctx, 'MAIN'));
				return;

			default:
				// неизвестный ADM_ кейс — просто ничего
				return;
		}
	}

	// Обычная логика разделов/ответов
	await ctx.answerCbQuery();

	const cfg = config.get();

	// переход в раздел (если payload совпадает с chapter)
	const hasChapter = cfg.buttons.some((b) => b.chapter === data);
	if (hasChapter) {
		// отрисовываем клавиши этой раздела
		await ctx.reply('Выберите категорию:', buildKeyboard(ctx as Ctx, data));
		return;
	}

	const resp = cfg.responses[data];
	if (resp) {
		await ctx.reply(resp, buildKeyboard(ctx as Ctx, 'MAIN'));
	} else {
		await ctx.reply('Нет текста для этой кнопки. Админ может задать через /setresponse.', buildKeyboard(ctx as Ctx, 'MAIN'));
	}
});

// ➕ Добавить кнопку
bot.action('ADM_ADD_BTN', async (ctx) => {
	await ctx.answerCbQuery();
	const uid = (ctx as Ctx).from.id;
	if (!config.isAdmin(uid)) return ctx.reply('⛔ Недостаточно прав.');
	const s = getSession(uid);
	s.mode = 'ADD_BTN__ASK_ALL';
	await ctx.reply(
		'Отправьте параметры кнопки в одной строке:\n' +
		'`id | label | type(callback|url) | chapter | payload_or_url`',
		{ parse_mode: 'Markdown' }
	);
});

// 🗑 Удалить кнопку
bot.action('ADM_DEL_BTN', async (ctx) => {
	await ctx.answerCbQuery();
	const uid = (ctx as Ctx).from.id;
	if (!config.isAdmin(uid)) return ctx.reply('⛔ Недостаточно прав.');
	const s = getSession(uid);
	s.mode = 'DEL_BTN__ASK_ID';
	await ctx.reply('Укажите `id` кнопки, которую нужно удалить.', { parse_mode: 'Markdown' });
});

// 📝 Редактировать кнопку (любой ключ)
bot.action('ADM_EDIT_BTN', async (ctx) => {
	await ctx.answerCbQuery();
	const uid = (ctx as Ctx).from.id;
	if (!config.isAdmin(uid)) return ctx.reply('⛔ Недостаточно прав.');
	const s = getSession(uid);
	s.mode = 'EDIT_BTN__ASK_ID';
	await ctx.reply('Укажите `id` кнопки, которую будем редактировать.', { parse_mode: 'Markdown' });
});

// 📋 Список кнопок
bot.action('ADM_LIST_BTNS', async (ctx) => {
	await ctx.answerCbQuery();
	const uid = (ctx as Ctx).from.id;
	if (!config.isAdmin(uid)) return ctx.reply('⛔ Недостаточно прав.');
	const btns = config.get().buttons
		.map(b => `• id: ${b.id} | label: ${b.label} | type: ${'type' in b ? b.type : 'n/a'} | chapter: ${b.chapter}`)
		.join('\n');
	await ctx.reply(btns || 'Список пуст.');
});

// 💬 Изменить приветствие
bot.action('ADM_SET_WELCOME', async (ctx) => {
	await ctx.answerCbQuery();
	const uid = (ctx as Ctx).from.id;
	if (!config.isAdmin(uid)) return ctx.reply('⛔ Недостаточно прав.');
	const s = getSession(uid);
	s.mode = 'SET_WELCOME__ASK_TEXT';
	await ctx.reply('Отправьте новый текст приветствия (одним сообщением).');
});

// 💡 Изменить ответ payload
bot.action('ADM_SET_RESPONSE', async (ctx) => {
	await ctx.answerCbQuery();
	const uid = (ctx as Ctx).from.id;
	if (!config.isAdmin(uid)) return ctx.reply('⛔ Недостаточно прав.');
	const s = getSession(uid);
	s.mode = 'SET_RESPONSE__ASK_BOTH';
	await ctx.reply('Отправьте строку: `payload | текст ответа`', { parse_mode: 'Markdown' });
});

// ⬅️ Назад в главное меню
bot.action('ADM_BACK_TO_MAIN', async (ctx) => {
	await ctx.answerCbQuery();
	resetSession((ctx as Ctx).from.id);
	await ctx.reply('Главное меню:', buildKeyboard(ctx as Ctx, 'MAIN'));
});

bot.on('message', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	const uid = (ctx as Ctx).from.id;
	if (!config.isAdmin(uid)) return; // игнорируем тексты не-админов в режимах

	const s = getSession(uid);
	const text = (ctx.message as any).text?.trim() || '';

	// 1) ADD_BTN__ASK_ALL
	if (s.mode === 'ADD_BTN__ASK_ALL') {
		const parts = text.split('|').map((x: string) => x.trim());
		const [id, label, typeRaw, chapter, rest] = parts;
		if (!id || !label || !typeRaw || !chapter || !rest) {
			return ctx.reply('Нужно 5 полей: `id | label | type(callback|url) | chapter | payload_or_url`', { parse_mode: 'Markdown' });
		}
		const type = typeRaw.toLowerCase();
		try {
			if (type === 'callback') {
				config.addButton({ id, label, chapter, type: 'callback', payload: rest });
			} else if (type === 'url') {
				config.addButton({ id, label, chapter, type: 'url', url: rest });
			} else {
				return ctx.reply('Поле type должно быть `callback` или `url`.');
			}
			await config.save();
			resetSession(uid);
			await ctx.reply(`✅ Кнопка "${id}" добавлена.`, adminMenuKeyboard());
		} catch (e: any) {
			await ctx.reply('Ошибка: ' + e.message);
		}
		return;
	}

	// 2) DEL_BTN__ASK_ID
	if (s.mode === 'DEL_BTN__ASK_ID') {
		const id = text;
		config.removeButton(id);
		await config.save();
		resetSession(uid);
		await ctx.reply(`✅ Кнопка "${id}" удалена.`, adminMenuKeyboard());
		return;
	}

	// 3) EDIT_BTN__ASK_ID -> затем EDIT_BTN__ASK_KEY -> затем EDIT_BTN__ASK_VALUE
	if (s.mode === 'EDIT_BTN__ASK_ID') {
		const id = text;
		const btn = config.get().buttons.find(b => b.id === id);
		if (!btn) return ctx.reply('Кнопка с таким id не найдена. Попробуйте снова или посмотрите список.');
		s.workingButtonId = id;
		s.mode = 'EDIT_BTN__ASK_KEY';
		const hintKeys =
			`Доступные ключи:\n` +
			`id, label, type(callback|url), chapter, payload(для callback), url(для url)\n` +
			`Отправьте имя ключа, который нужно изменить.`;
		await ctx.reply(hintKeys);
		return;
	}

	if (s.mode === 'EDIT_BTN__ASK_KEY') {
		const key = text;
		s.workingKey = key;
		s.mode = 'EDIT_BTN__ASK_VALUE';
		await ctx.reply(`Отправьте новое значение для ключа "${key}".`);
		return;
	}

	if (s.mode === 'EDIT_BTN__ASK_VALUE') {
		const id = s.workingButtonId!;
		const key = s.workingKey!;
		const value = text;

		const all = config.get().buttons;
		const idx = all.findIndex(b => b.id === id);
		if (idx === -1) {
			resetSession(uid);
			return ctx.reply('Кнопка не найдена (возможно, удалена).', adminMenuKeyboard());
		}

		const btn = all[idx];

		try {
			// универсальное изменение с валидациями по ключам
			if (key === 'id') {
				if (all.some(b => b.id === value && b !== btn)) throw new Error('id уже используется');
				(btn as any).id = value;
			} else if (key === 'label' || key === 'chapter') {
				(btn as any)[key] = value;
			} else if (key === 'type') {
				const low = value.toLowerCase();
				if (low !== 'callback' && low !== 'url') throw new Error('type должен быть callback или url');
				// при смене типа корректируем поля
				if (low === 'callback') {
					(btn as any).type = 'callback';
					delete (btn as any).url;
					if (!(btn as any).payload) (btn as any).payload = '';
				} else {
					(btn as any).type = 'url';
					delete (btn as any).payload;
					if (!(btn as any).url) (btn as any).url = 'https://';
				}
			} else if (key === 'payload') {
				if ((btn as any).type !== 'callback') throw new Error('payload допустим только для type=callback');
				(btn as any).payload = value;
			} else if (key === 'url') {
				if ((btn as any).type !== 'url') throw new Error('url допустим только для type=url');
				(btn as any).url = value;
			} else {
				throw new Error('Неизвестный ключ. Разрешённые: id, label, type, chapter, payload, url');
			}

			all[idx] = btn;
			await config.save();
			resetSession(uid);
			await ctx.reply(`✅ Кнопка "${id}" обновлена.`, adminMenuKeyboard());
		} catch (e: any) {
			await ctx.reply('Ошибка: ' + e.message);
		}
		return;
	}

	// 4) SET_WELCOME__ASK_TEXT
	if (s.mode === 'SET_WELCOME__ASK_TEXT') {
		config.setWelcome(text);
		await config.save();
		resetSession(uid);
		await ctx.reply('✅ Приветствие обновлено.', adminMenuKeyboard());
		return;
	}

	// 5) SET_RESPONSE__ASK_BOTH
	if (s.mode === 'SET_RESPONSE__ASK_BOTH') {
		const msgText = (ctx.message as any).text;
		if (typeof msgText !== 'string') {
			return ctx.reply('Пришлите текст вида: `payload | текст ответа`', { parse_mode: 'Markdown' });
		}

		const [payload, ...rest] = msgText
			.split('|')
			.map((x: string) => x.trim());  // ← типизировали x

		const ans = rest.join('|').trim();

		if (!payload || !ans) {
			return ctx.reply('Нужно: `payload | текст ответа`', { parse_mode: 'Markdown' });
		}

		config.setResponse(payload, ans);
		await config.save();
		resetSession(uid);
		await ctx.reply(`✅ Ответ для payload "${payload}" сохранён.`, adminMenuKeyboard());
		return;
	}

	// если мы тут — либо IDLE, либо неинтересный текст → ничего
});

// ——— Админ-функционал ———
// /setwelcome <текст>
bot.command('setwelcome', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	if (!ensureAdmin(ctx as Ctx)) return;
	const text = ctx.message?.text?.replace('/setwelcome', '').trim();
	if (!text) return ctx.reply('Использование: /setwelcome <текст>');
	config.setWelcome(text);
	await config.save();
	await ctx.reply('✅ Приветствие обновлено.');
});

// /setresponse <payload> | <текст>
bot.command('setresponse', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	if (!ensureAdmin(ctx as Ctx)) return;
	const raw = ctx.message?.text?.replace('/setresponse', '').trim() || '';
	const [payload, ...rest] = raw.split('|').map((s) => s.trim());
	const text = rest.join('|').trim();
	if (!payload || !text) {
		return ctx.reply('Использование: /setresponse <payload> | <текст>');
	}
	config.setResponse(payload, text);
	await config.save();
	await ctx.reply(`✅ Ответ для payload "${payload}" обновлён.`);
});

// /addbtn_callback <id> | <label> | <payload>
bot.command('addbtn_callback', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	if (!ensureAdmin(ctx as Ctx)) return;

	const raw = ctx.message?.text?.replace('/addbtn_callback', '').trim() || '';
	const parts = raw.split('|').map((s: string) => s.trim()).filter(Boolean);

	let id: string | undefined;
	let label: string | undefined;
	let chapter = 'MAIN';
	let payload: string | undefined;

	if (parts.length === 3) {
		[id, label, payload] = parts;
	} else if (parts.length === 4) {
		[id, label, chapter, payload] = parts;
	} else {
		return ctx.reply(
			'Использование:\n' +
			'• /addbtn_callback <id> | <label> | <payload>\n' +
			'• /addbtn_callback <id> | <label> | <chapter> | <payload>'
		);
	}

	if (!id || !label || !payload) {
		return ctx.reply('Не хватает параметров. Проверьте ввод.');
	}

	try {
		config.addButton({ id, label, chapter, type: 'callback', payload });
		await config.save();
		await ctx.reply(`✅ Кнопка "${id}" добавлена (chapter: ${chapter}).`);
	} catch (e: any) {
		await ctx.reply('Ошибка: ' + e.message);
	}
});

// /addbtn_url <id> | <label> | <url>
bot.command('addbtn_url', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	if (!ensureAdmin(ctx as Ctx)) return;

	const raw = ctx.message?.text?.replace('/addbtn_url', '').trim() || '';
	const parts = raw.split('|').map((s: string) => s.trim()).filter(Boolean);

	let id: string | undefined;
	let label: string | undefined;
	let chapter = 'MAIN';
	let url: string | undefined;

	if (parts.length === 3) {
		[id, label, url] = parts;
	} else if (parts.length === 4) {
		[id, label, chapter, url] = parts;
	} else {
		return ctx.reply(
			'Использование:\n' +
			'• /addbtn_url <id> | <label> | <url>\n' +
			'• /addbtn_url <id> | <label> | <chapter> | <url>'
		);
	}

	if (!id || !label || !url) {
		return ctx.reply('Не хватает параметров. Проверьте ввод.');
	}

	try {
		config.addButton({ id, label, chapter, type: 'url', url });
		await config.save();
		await ctx.reply(`✅ Кнопка "${id}" добавлена (chapter: ${chapter}).`);
	} catch (e: any) {
		await ctx.reply('Ошибка: ' + e.message);
	}
});

// /renamebtn <id> | <new label>
bot.command('renamebtn', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	if (!ensureAdmin(ctx as Ctx)) return;
	const raw = ctx.message?.text?.replace('/renamebtn', '').trim() || '';
	const [id, newLabel] = raw.split('|').map((s) => s.trim());
	if (!id || !newLabel) {
		return ctx.reply('Использование: /renamebtn <id> | <new label>');
	}
	try {
		config.renameButton(id, newLabel);
		await config.save();
		await ctx.reply(`✅ Кнопка "${id}" переименована.`);
	} catch (e: any) {
		await ctx.reply('Ошибка: ' + e.message);
	}
});

// /delbtn <id>
bot.command('delbtn', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	if (!ensureAdmin(ctx as Ctx)) return;
	const id = ctx.message?.text?.replace('/delbtn', '').trim();
	if (!id) return ctx.reply('Использование: /delbtn <id>');
	config.removeButton(id);
	await config.save();
	await ctx.reply(`✅ Кнопка "${id}" удалена.`);
});

// ——— Суперпользователь: управление админами ———
// /addadmin <userId>  ИЛИ в ответ на сообщение пользователя: /addadmin
bot.command('addadmin', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	if (!ensureSuper(ctx as Ctx)) return;

	const text = ctx.message?.text || '';
	const arg = text.replace('/addadmin', '').trim();

	let userId: number | null = null;

	if (arg) {
		const parsed = Number(arg);
		if (!Number.isFinite(parsed)) {
			return ctx.reply('Использование: /addadmin <userId> или ответом на сообщение пользователя.');
		}
		userId = parsed;
	} else {
		const reply = (ctx.message as any).reply_to_message;
		if (reply?.from?.id) userId = reply.from.id;
	}

	if (!userId) return ctx.reply('Не смог определить userId. Укажи /addadmin <userId> или ответь на сообщение пользователя командой /addadmin.');
	if (Array.isArray(config.get().superUserIds) && config.get().superUserIds.includes(userId)) {
		return ctx.reply('Это и так суперпользователь 🙂');
	}

	config.addAdmin(userId);
	await config.save();
	await ctx.reply(`✅ Пользователь ${userId} назначен админом.`);
});

// /deladmin <userId>
bot.command('deladmin', async (ctx) => {
	if (!onlyPrivate(ctx)) return;
	if (!ensureSuper(ctx as Ctx)) return;
	const arg = ctx.message?.text?.replace('/deladmin', '').trim();
	const id = Number(arg);
	if (!arg || !Number.isFinite(id)) {
		return ctx.reply('Использование: /deladmin <userId>');
	}
	if (Array.isArray(config.get().superUserIds) && config.get().superUserIds.includes(id)) {
		return ctx.reply('Нельзя снять права с суперпользователя.');
	}
	config.removeAdmin(id);
	await config.save();
	await ctx.reply(`✅ Пользователь ${id} больше не админ.`);
});

// ——— Запуск ———
bot.launch().then(() => console.log('✅ Bot started with dynamic admin & menu')).catch(console.error);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
