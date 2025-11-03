import type { Button } from '@core/types.js'
import { formatPrice } from '@core/utils/format.js'

export function num(v: unknown): number | undefined {
    if (v == null) return undefined
    const n = Number(String(v).replace(/[^\d.]/g, ''))
    return Number.isFinite(n) ? n : undefined
}

export function priceOf(r: any): number | undefined {
    return num(r['price'] ?? r['стоимость'] ?? r['цена'])
}

export function renderItemLabel(btn: Button): string {
    const name = btn.label ?? 'ITEM'

    const mem =
        btn.memory && btn.memory.trim() !== '' && btn.memory !== '0'
            ? `${btn.memory} GB`
            : ''

    const priceText = btn.price
        ? (btn.priceFrom ? `от ${formatPrice(btn.price)}` : `${formatPrice(btn.price)}`)
        : 'уточняйте'

    const left = [name, mem].filter(Boolean).join(' ')
    return `${left} — ${priceText}`
}