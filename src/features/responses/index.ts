import { type Telegraf, Markup } from 'telegraf'
import { show, showReplaceFromCallback } from '@core/ui/switcher.js'
import { buildDeepLink, buildKeyboard } from '@core/ui/keyboards.js'
import { formatMemory, formatPrice } from '@core/utils/format.js'
import type { Ctx } from '@core/types.js'

export function registerResponses(bot: Telegraf<Ctx>, config: any) {
    bot.on('callback_query', async (ctx) => {
        const data = (ctx.callbackQuery as any)?.data as string | undefined
        if (!data) return

        // 👇 Эти payload'ы обрабатывают спец-хендлеры из admin-модуля
        if (data === 'ADMIN' || data.startsWith('ADM_')) {
            // ничего не делаем — пусть обработает registerAdmin
            return
        }

        // 1) ДИНАМИЧЕСКИЕ ТОВАРЫ
        if (data.startsWith('ITEM:')) {
            const id = data.slice('ITEM:'.length)

            const cfg = config.get()
            const btn = cfg.buttons.find((b: any) => b.id === id) as (import('@core/types.js').ButtonCallback | undefined)

            if (!btn) {
                await ctx.answerCbQuery()
                await ctx.eReply('Товар не найден. Обновите список.')
                return
            }

            // Родительская секция для «Назад»
            // const parent = (cfg.parents?.[btn.chapter] ?? 'PRODUCT_GROUP')
            const listChapter = btn.chapter

            const name = btn.label
            const mem = formatMemory(btn.memory)
            const price = formatPrice(btn.price)

            const text =
                `📱 Модель: ${name}
💾 Память: ${mem}
💶 Цена: от ${price}
ℹ️ Цена зависит от региона поставки и цвета

<b>Под заказ 1–2 дня.</b>
<b>Новые, коробка запечатана.</b>
<b>Официальная гарантия 12 месяцев.</b>
<b>Цена указана в у.е для информации.</b>
<b>Оплата наличными по курсу в рублях.</b>

Выберите товар:`

            // Клавиатура карточки: контакт, назад, в главное
            const buyBtn = cfg.buttons.find(
                (b: any) => b.id === 'CHOOSE_COLOR_AND_BUY' && b.type === 'url'
            ) as (import('@core/types.js').ButtonUrl | undefined)

            let buyRow: any[] = []
            if (buyBtn?.url) {
                // соберём префилл: префикс из конфига + модель/память/цена
                const prefillParts = [
                    (buyBtn.prefillText ?? 'Здравствуйте! Хочу купить'),
                    name,
                    mem !== '—' ? mem : undefined,
                    price !== 'уточняйте' ? 'от ' + price + '.' : undefined,
                    'Какие цвета есть в наличие?'
                ].filter(Boolean)

                const prefill = prefillParts.join(' ')
                const deepUrl = buildDeepLink(buyBtn.url, prefill)
                buyRow = [Markup.button.url('💸 Выбрать цвет и купить', deepUrl)]
            }
            const kb = Markup.inlineKeyboard([
                ...(buyRow.length ? [buyRow] : []),
                // [Markup.button.callback('⬅️ Назад', parent)],
                [Markup.button.callback('⬅️ Назад', listChapter)],
                [Markup.button.callback('⬅️ В главное меню', 'MAIN')],
            ])

            await show(ctx, text, kb)
            return
        }

        // 2) Переходы по разделам (chapter), включая возврат в MAIN
        const cfg = config.get()
        const isChapter =
            data === 'MAIN' || cfg.buttons.some((b: any) => b.chapter === data)
        if (isChapter) {
            const parents: Record<string, string> = cfg.parents || {}

            let text: string
            if (data === 'MAIN') {
                text = `${cfg.texts.welcome}${ctx.from?.first_name ? `, ${ctx.from.first_name}` : ''}`
            } else if (data === 'PRODUCT_GROUP') {
                text = 'Выберите категорию:'
            } else {
                const parent = parents[data]
                text = parent === 'PRODUCT_GROUP'
                    ? 'Выберите категорию:'
                    : `<b>Под заказ 1–2 дня.</b>
<b>Новые, коробка запечатана.</b>
<b>Официальная гарантия 12 месяцев.</b>
<b>Цена указана в у.е для информации.</b>
<b>Оплата наличными по курсу в рублях.</b>

Выберите товар:`
            }

            const kb = buildKeyboard(ctx, data, config)
            if (data === 'MAIN') {
                await showReplaceFromCallback(ctx, text, kb)
            } else {
                // Остальные разделы — как раньше
                await show(ctx, text, kb)
            }
            return
        }

        // Ответы по payload
        const resp = cfg.responses[data]
        const kb = buildKeyboard(ctx, 'MAIN', config)
        await show(ctx, resp ?? 'Нет текста для этой кнопки. Админ может задать через /setresponse.', kb)
    })
}
