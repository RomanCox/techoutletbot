import type { Button } from '@core/types.js'
import { loadIphonesFromSheet } from '@core/sheets.js'
import { toCapitalize, toCode } from '@core/utils/format.js'

type ImportMode = 'flat' | 'byProduct'
type SheetSpec = { gid: number | string; title?: string }

type SheetGroupOpts = {
    sheetId: string
    gid: number | string
    groupTitle?: string
    mode?: ImportMode
}

function productLabel(product: string): string {
    const key = (product || '').trim().toUpperCase()
    switch (key) {
        case 'IPHONES': return '📱 iPhones'
        case 'AIRPODS': return '🎧 AirPods'
        case 'MACBOOKS': return '💻 MacBooks'
        case 'IMACS': return '🖥 iMacs'
        case 'IPADS': return '📺 iPads'
        case 'APPLE_WATCHES': return '⌚️ Apple Watches'
        case 'APPLE_ACCESSORIES': return '🖱 Apple Accessories'
        // добавляй маппинги дальше...
        default: return toCapitalize(product || 'Категория')
    }
}

/** Импорт одного листа как группу товаров */
export async function importSheetAsGroup(config: any, opts: SheetGroupOpts) {
    const { sheetId, gid, mode = 'flat' } = opts
    const items = await loadIphonesFromSheet(sheetId, gid)
    if (!items.length) return { added: 0, updated: 0, groupsAdded: 0, chaptersAdded: 0 }

    // имя группы/лист
    const groupTitle = (opts.groupTitle || guessGroupTitle(items) || `SHEET_${gid}`).trim()
    const groupId = toCode(groupTitle)

    const data = config.get()
    const buttons: Button[] = data.buttons
    const parents: Record<string, string> = data.parents ?? (data.parents = {})

    const upsert = (btn: Button) => {
        const i = buttons.findIndex(b => b.id === btn.id)
        if (i === -1) { buttons.push(btn); return 'added' as const }
        buttons[i] = btn; return 'updated' as const
    }

    let added = 0, updated = 0, groupsAdded = 0, chaptersAdded = 0

    // Кнопка группы в PRODUCT_GROUP → открывает chapter=groupId
    {
        const btn: Button = {
            id: `GROUP_${groupId}`,
            chapter: 'PRODUCT_GROUP',
            //TODO add function for generate label with true emojies (🍏for Apple and etc)
            label: `🗂 ${toCapitalize(groupTitle)}`,
            type: 'callback',
            payload: groupId,
        }
        if (upsert(btn) === 'added') groupsAdded++
        parents[groupId] = 'PRODUCT_GROUP'
    }

    // Подкатегории = уникальные product
    const products = Array.from(new Set(items.map(i => (i.product || '').trim()).filter(Boolean)))

    for (const product of products) {
        const chapterId = toCode(product)
        const pBtn: Button = {
            id: `CAT_${groupId}_${chapterId}`,
            chapter: groupId,
            label: productLabel(product),
            type: 'callback',
            payload: chapterId,
        }
        if (upsert(pBtn) === 'added') chaptersAdded++
        parents[chapterId] = groupId
    }

    // Товары внутри product
    for (const it of items) {
        const product = (it.product || '').trim()
        if (!product) continue

        const productChapterId = toCode(product) // подкатегория = значение из столбца "product"
        const name = (it.name ?? '').trim()
        if (!name) continue

        const mem  = (it.memory ?? '').toString().trim() || undefined
        const pr   = (it.price  ?? '').toString().trim() || undefined

        const id = `${toCode(product)}_${toCode(name)}${mem ? `_${toCode(mem)}` : ''}`

        const btn: Button = {
            id,
            chapter: productChapterId,  // показываем товар внутри своей подкатегории (IPHONES, AIRPODS и т.д.)
            label: name,                // только имя; красивый текст формируем при клике
            memory: mem,                // "256" | "256 GB" — как в таблице
            price: pr,                  // "1099" и т.п.
            type: 'callback',
            payload: `ITEM:${id}`,      // маркер карточки товара
        }

        if (upsert(btn) === 'added') added++
        else updated++
    }

    await config.save()
    return { added, updated, groupsAdded, chaptersAdded }
}

/** Импорт нескольких листов одним вызовом */
export async function importWorkbookGroups(
    config: any,
    sheetId: string,
    sheets: SheetSpec[],
    mode: ImportMode = 'flat'
) {
    let total = { added: 0, updated: 0, groupsAdded: 0, chaptersAdded: 0 }
    for (const s of sheets) {
        const r = await importSheetAsGroup(config, {
            sheetId,
            gid: s.gid,
            groupTitle: s.title,
            mode,
        })
        total.added += r.added
        total.updated += r.updated
        total.groupsAdded += r.groupsAdded
        total.chaptersAdded += r.chaptersAdded
    }
    return total
}

/** Пытаемся угадать имя группы из данных листа */
function guessGroupTitle(items: Array<{ product?: string; name?: string }>): string | undefined {
    // 1) если product стабильно одинаков — берём его
    const uniq = Array.from(new Set(items.map(i => (i.product || '').trim()).filter(Boolean)))
    if (uniq.length === 1) return uniq[0]
    // 2) иначе “APPLE” как нейтральная заглушка; лучше передать явно в SheetSpec.title
    return undefined
}