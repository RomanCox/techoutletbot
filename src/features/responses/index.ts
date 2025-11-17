import { type Telegraf, Markup } from 'telegraf'
import { show, showReplaceFromCallback } from '@core/ui/switcher.js'
import { buildDeepLink, buildKeyboard } from '@core/ui/keyboards.js'
import type { Ctx, ButtonUrl } from '@core/types.js'

export function registerResponses(bot: Telegraf<Ctx>, config: any) {
    bot.on('callback_query', async (ctx) => {
        const data = (ctx.callbackQuery as any)?.data as string | undefined
        if (!data) return

        if (data === 'ADMIN' || data.startsWith('ADM_')) {
            return
        }

        if (data.startsWith('ITEM:')) {
            const id = data.slice('ITEM:'.length)

            const cfg = config.get()
            const btn = cfg.buttons.find(
                (b: any) => b.id === id
            ) as (import('@core/types.js').ButtonCallback | undefined)

            if (!btn) {
                await ctx.answerCbQuery()
                await ctx.eReply('Товар не найден. Обновите список.')
                return
            }

            const listChapter = btn.chapter
            const name = btn.label

            const rawPrice =
                typeof btn.price === 'string'
                    ? btn.price.trim()
                    : btn.price != null
                        ? String(btn.price).trim()
                        : ''

            const hasPrice = rawPrice.length > 0

            const priceText = btn.priceRequest
                ? 'под запрос'
                : hasPrice
                    ? rawPrice
                    : 'уточняйте'

            const parts = [
                `📱 Модель: ${name}`,
                `💶 Цена: ${priceText}`,
                btn.priceFrom
                    ? 'ℹ️ Цена зависит от региона поставки и цвета'
                    : null,
                ' ',
                '<b>✅ Под заказ со склада 1-2 дня.</b>',
                '<b>✅ Новые, коробка запечатана.</b>',
                '<b>✅ Гарантия 12 месяцев.</b>',
                '<b>✅ Самовывоз или доставка.</b>',
                '<b>✅ Оплата наличными при получении.</b>',
                '<b>♻️ Выгодный Trade-In.</b>',
                ' ',
                'Выберите товар:',
            ]

            const text = parts.filter(Boolean).join('\n')

            const buyBtn = cfg.buttons.find(
                (b: any) => b.id === 'ORDER' && b.type === 'url'
            ) as (ButtonUrl | undefined)

            let buyRow: any[] = []
            if (buyBtn?.url) {
                const buyText = btn.priceFrom
                    ? '💸 Выбрать цвет и заказать'
                    : '🛒 Заказать'

                const prefill = [
                    buyBtn.prefillText ?? 'Здравствуйте! Хочу заказать',
                    name,
                    priceText ? `- ${priceText}.` : undefined,
                ]
                    .filter(Boolean)
                    .join(' ')

                const deepUrl = buildDeepLink(buyBtn.url, prefill)
                buyRow = [Markup.button.url(buyText, deepUrl)]
            }

            const kb = Markup.inlineKeyboard([
                ...(buyRow.length ? [buyRow] : []),
                [Markup.button.callback('⬅️ Назад', listChapter)],
                [Markup.button.callback('⬅️ В главное меню', 'MAIN')],
            ])

            await show(ctx, text, kb)
            return
        }

        const cfg = config.get()
        const isChapter =
            data === 'MAIN' ||
            data === 'PRODUCT_GROUP' ||
            cfg.buttons.some((b: any) => b.chapter === data)

        if (isChapter) {
            const parents: Record<string, string> = cfg.parents || {}

            const hasButtonsInChapter = cfg.buttons.some(
                (b: any) => b.chapter === data && b.chapter !== '_HIDDEN'
            )

            let text: string

            if (data === 'MAIN') {
                text = cfg.texts.welcome

            } else if (data === 'PRODUCT_GROUP') {
                const hasAnyGroups = cfg.buttons.some(
                    (b: any) => b.chapter === 'PRODUCT_GROUP'
                )

                text = hasAnyGroups
                    ? 'Выберите категорию:'
                    : 'Сейчас товары недоступны.\n\n' +
                    'Пожалуйста, загляните позже или напишите менеджеру — мы поможем подобрать вариант вручную.'

            } else {
                const parent = parents[data]

                if (!hasButtonsInChapter) {
                    text =
                        'В этой категории пока нет товаров.\n\n' +
                        'Попробуйте вернуться назад или выбрать другую категорию.'
                } else {
                    text =
                        parent === 'PRODUCT_GROUP'
                            ? 'Выберите категорию:'
                            : `<b>✅ Под заказ со склада 1-2 дня.</b>
<b>✅ Новые, коробка запечатана.</b>
<b>✅ Гарантия 12 месяцев.</b>
<b>✅ Самовывоз или доставка.</b>
<b>✅ Оплата наличными при получении.</b>
<b>♻️ Выгодный Trade-In.</b>

Выберите товар:`
                }
            }

            const kb = buildKeyboard(ctx, data, config)
            if (data === 'MAIN') {
                await showReplaceFromCallback(ctx, text, kb)
            } else {
                await show(ctx, text, kb)
            }
            return
        }

        const resp = cfg.responses[data]
        const kb = buildKeyboard(ctx, 'MAIN', config)
        await show(
            ctx,
            resp ?? 'Нет текста для этой кнопки. Админ может задать через /setresponse.',
            kb
        )
    })
}