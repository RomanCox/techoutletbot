export type IphoneItem = {
    product: string
    name: string
    memory?: number
    price: number
}

type Row = Record<string, string>

function exportTsvUrl(sheetId: string, gid: number | string = 0) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=tsv&gid=${gid}`
}
function exportCsvUrl(sheetId: string, gid: number | string = 0) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}
function gvizTsvUrl(sheetId: string, gid: number | string = 0) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:tsv&gid=${gid}`
}

function cleanText(s: string): string {
    return s.replace(/^\uFEFF/, '').replace(/^\)]}'\s*\n?/, '').trim()
}

function parseTsv(tsv: string): Row[] {
    const lines = cleanText(tsv).split(/\r?\n/)
    if (!lines.length) return []
    const header = lines[0].split('\t').map(h => h.trim())
    if (!header.length || header.every(h => !h)) return []
    const rows: Row[] = []
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t')
        const row: Row = {}
        header.forEach((key, idx) => (row[key] = (cols[idx] ?? '').trim()))
        rows.push(row)
    }
    return rows
}

function parseCsv(csv: string): Row[] {
    const text = cleanText(csv)
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (!lines.length) return []
    const header = lines[0].split(',').map(h => h.trim())
    if (!header.length || header.every(h => !h)) return []
    const rows: Row[] = []
    for (let i = 1; i < lines.length; i++) {
        // простой CSV без кавычек — для “честного” экспорта Google обычно хватает
        const cols = lines[i].split(',')
        const row: Row = {}
        header.forEach((key, idx) => (row[key] = (cols[idx] ?? '').trim()))
        rows.push(row)
    }
    return rows
}

function resolveColumnKey(headers: string[], variants: string[]): string | null {
    const canon = headers.map(h => h.trim().toLowerCase())
    for (const v of variants) {
        const idx = canon.indexOf(v.toLowerCase())
        if (idx !== -1) return headers[idx]
    }
    return null
}

function toNumber(val?: string | null): number | undefined {
    if (!val) return undefined
    const s = String(val)
        .replace(/\s+/g, '')
        .replace(/,/g, '.')
        .replace(/[^\d.]/g, '')
    if (!s) return undefined
    const n = Number(s)
    return Number.isFinite(n) ? n : undefined
}

function toInt(val?: string | null): number | undefined {
    if (!val) return undefined
    const m = String(val).match(/\d+/)
    return m ? Number(m[0]) : undefined
}

export async function loadIphonesFromSheet(
    sheetId: string,
    gid: number | string = 0
): Promise<IphoneItem[]> {
    const attempts = [
        { kind: 'export-tsv', url: exportTsvUrl(sheetId, gid), parse: parseTsv },
        { kind: 'export-csv', url: exportCsvUrl(sheetId, gid), parse: parseCsv },
        { kind: 'gviz-tsv',   url: gvizTsvUrl(sheetId, gid),  parse: parseTsv },
    ] as const

    let rows: Row[] = []
    for (const a of attempts) {
        try {
            const res = await fetch(a.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
            if (!res.ok) {
                console.log(`[sheets] ${a.kind} HTTP ${res.status}`)
                continue
            }
            const text = await res.text()
            const parsed = a.parse(text)
            console.log(`[sheets] ${a.kind} parsed rows:`, parsed.length)
            if (parsed.length) {
                rows = parsed
                break
            }
        } catch (e) {
            console.log(`[sheets] ${a.kind} failed:`, (e as Error).message)
        }
    }

    if (!rows.length) return []

    const headers = Object.keys(rows[0])
    const productKey = resolveColumnKey(headers, ['product', 'товар']) ?? 'product'
    const nameKey    = resolveColumnKey(headers, ['name', 'название', 'модель']) ?? 'name'
    const memoryKey  = resolveColumnKey(headers, ['memory', 'память']) ?? 'memory'
    const priceKey   = resolveColumnKey(headers, ['price', 'стоимость', 'цена']) ?? 'price'

    return rows
        .map((r) => {
            const product = (r[productKey] ?? '').trim()
            const name    = (r[nameKey]    ?? '').trim()
            const memory  = toInt(r[memoryKey])
            const price   = toNumber(r[priceKey]) ?? 0
            return { product, name, memory, price }
        })
        .filter(x => x.product || x.name)
}