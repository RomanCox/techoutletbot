import type { Button } from '@core/types.js'
import { formatPrice } from '@core/utils/format.js'

export function num(v: unknown): number | undefined {
    if (v == null) return undefined
    const n = Number(String(v).replace(/[^\d.]/g, ''))
    return Number.isFinite(n) ? n : undefined
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

export function resolveColumnKey(headers: string[], variants: string[]): string | null {
    const canon = headers.map(h => h.trim().toLowerCase())
    for (const v of variants) {
        const idx = canon.indexOf(v.toLowerCase())
        if (idx !== -1) return headers[idx]
    }
    return null
}