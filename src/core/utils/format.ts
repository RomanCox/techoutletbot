export function toCapitalize(s: string): string {
    if (!s) return ''
    const low = s.toLowerCase()
    return low[0].toUpperCase() + low.slice(1)
}

export function toCode(s: string): string {
    return (s || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]+/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .toUpperCase()
}

export const formatPrice = (v?: string | number) => {
    if (v == null || v === '') return 'уточняйте'
    const n = Number(String(v).replace(/[^\d.,]/g, '').replace(',', '.'))
    if (!isFinite(n)) return String(v)
    return `$${n.toLocaleString('en-US', {
        maximumFractionDigits: 0
    })}`
}

export const formatMemory = (v?: string) => {
    if (!v) return '—'
    const s = v.trim().replace(/\s*gb$/i, '')
    return `${s} GB`
}