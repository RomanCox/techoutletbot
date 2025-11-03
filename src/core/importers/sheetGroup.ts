import type { Button } from '@core/types.js'
import { toCode, toCapitalize, prettyProductLabel } from '@core/utils/format.js'
import { loadSheetAsRows } from '@core/importers/sheetTsv.js'
import { num, priceOf } from '@core/utils/helper.js'

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
        { id: 'PRODUCT_GROUP', chapter: 'MAIN', label: '🛍 Группа товаров', type: 'callback', payload: 'PRODUCT_GROUP' },
        { id: 'CONTACT_MANAGER', chapter: 'MAIN', label: '👤 Связаться с менеджером', type: 'url', url: 'https://t.me/FBImen', prefillText: 'Здравствуйте! Нужна консультация по ' } as any,
        { id: 'ORDER', chapter: '_HIDDEN', label: '💸 Выбрать цвет и заказать', type: 'url', url: 'https://t.me/FBImen', prefillText: 'Здравствуйте! Хочу заказать' } as any,
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

    for (const sheet of sheets) {
        const { gid, title } = sheet
        const allRows = await loadSheetAsRows(sheetId, gid)
        if (!allRows.length) continue

        const rows = allRows.filter(r => {
            const p = priceOf(r)
            return p != null && p > 0
        })
        if (!rows.length) {
            // можно оставить группу/страницу пустой, или скипнуть весь лист — выбери поведение
            continue
        }

        const pageChapter = toCode(title)
        parents[pageChapter] = 'PRODUCT_GROUP'
        chaptersAdded++

        const groupBtn: Button = {
            id: `GROUP_${pageChapter}`,
            chapter: 'PRODUCT_GROUP',
            //TODO add function for generate label with true emojies (🍏for Apple and etc)
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
            const productBtnId = `GROUP_${productChapter}`
            const productBtn: Button = {
                id: productBtnId,
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

            const name: string = String(r['name'] ?? r['Название'] ?? r['модель'] ?? '').trim()
            if (!name) continue

            const memoryNum = num(r['memory'] ?? r['память'])
            const rawPrice = String(r['price'] ?? r['стоимость'] ?? r['цена'] ?? '').trim()
            const priceFrom = /^от\s*/i.test(rawPrice)
            const priceNum = num(rawPrice)

            if (!priceNum) continue

            const singular = productKey.endsWith('S') ? productKey.slice(0, -1) : productKey
            const idParts = [toCode(singular), toCode(name)]
            if (memoryNum !== undefined && memoryNum > 0) idParts.push(toCode(String(memoryNum)))
            const id = idParts.join('_')

            const btn: Button = {
                id,
                chapter: productChapter,
                label: name || 'ITEM',
                type: 'callback',
                payload: `ITEM:${id}`,
                memory: String(memoryNum),
                price: String(priceNum),
                priceFrom,
            } as any

            if (upsert(btn) === 'added') added++; else updated++
        }
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