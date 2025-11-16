import type { Button } from '@core/types.js'
import { prettyProductLabel, toCapitalize, toCode } from '@core/utils/format.js'
import { loadSheetAsRows } from '@core/importers/sheetTsv.js'
import { num, resolveColumnKey } from '@core/utils/helper.js'
import { MANAGER_ACCOUNT } from '@core/constants.js'

type SheetSpec = { gid: number | string; title: string }

export async function importWorkbookGroups(
    config: any,
    sheetId: string,
    sheets: SheetSpec[],
): Promise<{ added: number; updated: number; groupsAdded: number; chaptersAdded: number }> {

    const cur = config.get()
    const superUserIds: number[] = Array.isArray(cur.superUserIds) ? cur.superUserIds : []
    const adminUserIds: number[] = Array.isArray(cur.adminUserIds) ? cur.adminUserIds : []
    const welcome: string = cur?.texts?.welcome ?? 'Привет!'

    const baseResponses: Record<string, string> = {
        PRODUCT_GROUP: 'Выбери группу товаров:',
    }

    const defaultMainButtons: Button[] = [
        {
            id: 'PRODUCT_GROUP',
            chapter: 'MAIN',
            label: '🛍 Группа товаров',
            type: 'callback',
            payload: 'PRODUCT_GROUP',
        },
        {
            id: 'CONTACT_MANAGER',
            chapter: 'MAIN',
            label: '👤 Связаться с менеджером',
            type: 'url',
            url: MANAGER_ACCOUNT,
            prefillText: 'Здравствуйте! Нужна консультация по ',
        } as any,
        {
            id: 'ORDER',
            chapter: '_HIDDEN',
            label: '💸 Выбрать цвет и заказать',
            type: 'url',
            url: MANAGER_ACCOUNT,
            prefillText: 'Здравствуйте! Хочу заказать',
        } as any,
    ]

    const buttons: Button[] = [...defaultMainButtons]
    const parents: Record<string, string> = {}
    const responses: Record<string, string> = { ...baseResponses }

    let added = 0
    let updated = 0
    let groupsAdded = 0
    let chaptersAdded = 0

    const indexById = new Map<string, number>()
    const upsert = (btn: Button): 'added' | 'updated' => {
        const idx = indexById.get(btn.id)
        if (idx == null) {
            indexById.set(btn.id, buttons.length)
            buttons.push(btn)
            return 'added'
        } else {
            buttons[idx] = btn
            return 'updated'
        }
    }

    let hasAnyImported = false

    for (const sheet of sheets) {
        const { gid, title } = sheet
        const allRows = await loadSheetAsRows(sheetId, gid)
        if (!allRows.length) continue

        const headers = Object.keys(allRows[0] ?? {})
        const priceKeyName =
            resolveColumnKey(headers, ['price', 'стоимость', 'цена']) ?? 'price'

        const rows = allRows.filter(r => {
            const raw = String(r[priceKeyName] ?? '').trim().toLowerCase()
            if (!raw) return false
            return !(raw === '0' || raw === '0.0' || raw === '0,0')
        })

        if (!rows.length) {
            continue
        }

        hasAnyImported = true

        const pageChapter = toCode(title)
        parents[pageChapter] = 'PRODUCT_GROUP'
        chaptersAdded++

        const groupBtn: Button = {
            id: pageChapter,
            chapter: 'PRODUCT_GROUP',
            label: `🍏 ${toCapitalize(title)}`,
            type: 'callback',
            payload: pageChapter,
        }
        if (upsert(groupBtn) === 'added') groupsAdded++; else updated++

        const productSet = new Set<string>()
        for (const r of rows) {
            const rawProduct = String(r['product'] ?? r['Product'] ?? r['товар'] ?? '').trim()
            if (!rawProduct) continue
            productSet.add(rawProduct.toUpperCase())
        }

        for (const productKey of productSet) {
            const productChapter = toCode(productKey)
            parents[productChapter] = pageChapter

            const productBtn: Button = {
                id: productChapter,
                chapter: pageChapter,
                label: prettyProductLabel(productKey),
                type: 'callback',
                payload: productChapter,
            }
            if (upsert(productBtn) === 'added') groupsAdded++; else updated++
        }

        for (const r of rows) {
            const rawProduct = String(r['product'] ?? r['Product'] ?? r['товар'] ?? '').trim()
            if (!rawProduct) continue
            const productKey = rawProduct.toUpperCase()
            const productChapter = toCode(productKey)

            const name: string = String(
                r['name'] ?? r['Название'] ?? r['модель'] ?? ''
            ).trim()
            if (!name) continue

            const rawPriceOriginal = String(r[priceKeyName] ?? '').trim()
            if (!rawPriceOriginal) continue

            const rawPrice = rawPriceOriginal.replace(/\s+/g, ' ')
            const lower = rawPrice.toLowerCase()

            let priceRequest = false
            let priceFrom = false
            let priceNum: number | undefined

            if (lower.includes('запрос')) {
                priceRequest = true
            } else {
                if (lower.startsWith('от')) {
                    priceFrom = true
                }

                priceNum = num(rawPrice)

                if (!priceNum || priceNum === 0) {
                    continue
                }
            }

            const id = toCode(name)

            const btn: Button = {
                id,
                chapter: productChapter,
                label: name || 'ITEM',
                type: 'callback',
                payload: `ITEM:${id}`,
                price: rawPrice,
                priceFrom,
                priceRequest,
            } as any

            if (upsert(btn) === 'added') added++; else updated++
        }
    }

    if (!hasAnyImported) {
        console.warn('[importWorkbookGroups] nothing imported – keeping existing config.json as-is')
        return { added: 0, updated: 0, groupsAdded: 0, chaptersAdded: 0 }
    }

    const nextData = {
        superUserIds,
        adminUserIds,
        texts: { welcome },
        buttons,
        responses,
        parents,
    }

    config.setAll(nextData)
    await config.save()

    return { added, updated, groupsAdded, chaptersAdded }
}