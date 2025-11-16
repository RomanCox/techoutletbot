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
    if (!v) return 'уточняйте'
    const s = String(v).trim()
    return s.replace(/\s+/g, ' ')
}

export function prettyProductLabel(key: string): string {
    switch (key) {
        case 'IPHONES': return '📱 iPhones'
        case 'AIRPODS': return '🎧 AirPods'
        case 'MACBOOKS': return '💻 MacBooks'
        case 'IPADS': return '📲 iPads'
        case 'APPLE_WATCHES': return '⌚️ Apple Watches'
        default: return toCapitalize(key || 'Категория')
    }
}