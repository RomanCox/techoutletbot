import { Context } from 'telegraf';

export type Ctx = Context & {
	// удобный доступ к from.id
	from: NonNullable<Context['from']>;
};

export type Button =
	| { id: string; chapter: string; label: string; type: 'callback'; payload: string }
	| { id: string; chapter: string; label: string; type: 'url'; url: string };

export interface BotConfig {
	superUserIds: number[];
	admins: number[];
	texts: {
		welcome: string;
	};
	responses: Record<string, string>; // ответы на callback-пэйлоады
	buttons: Button[];
}

export type AdminMode =
	| 'IDLE'
	| 'ADD_BTN__ASK_ALL'          // ожидание строки: id|label|type|chapter|payload_or_url
	| 'DEL_BTN__ASK_ID'           // ожидание id
	| 'EDIT_BTN__ASK_ID'          // ожидание id
	| 'EDIT_BTN__ASK_KEY'         // ожидание ключа для редактирования
	| 'EDIT_BTN__ASK_VALUE'       // ожидание нового значения ключа
	| 'SET_WELCOME__ASK_TEXT'     // ожидание текста приветствия
	| 'SET_RESPONSE__ASK_BOTH'    // ожидание payload|текст
	;

export type AdminSession = {
	mode: AdminMode;
	workingButtonId?: string;
	workingKey?: string;
};