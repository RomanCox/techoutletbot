export type Row = Record<string, string>

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
        const cols = lines[i].split(',')
        const row: Row = {}
        header.forEach((key, idx) => (row[key] = (cols[idx] ?? '').trim()))
        rows.push(row)
    }
    return rows
}

/** Универсально: вернёт массив объектов-строк по заголовкам */
export async function loadSheetAsRows(sheetId: string, gid: number | string = 0): Promise<Row[]> {
    const attempts = [
        { kind: 'export-tsv', url: exportTsvUrl(sheetId, gid), parse: parseTsv },
        { kind: 'export-csv', url: exportCsvUrl(sheetId, gid), parse: parseCsv },
        { kind: 'gviz-tsv',   url: gvizTsvUrl(sheetId, gid),  parse: parseTsv },
    ] as const

    for (const a of attempts) {
        try {
            console.log(`[sheetTsv] try ${a.kind} → ${a.url}`)
            const res = await fetch(a.url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
            console.log(`[sheetTsv] ${a.kind} status:`, res.status)
            if (!res.ok) continue
            const text = await res.text()
            const rows = a.parse(text)
            console.log(`[sheetTsv] ${a.kind} parsed rows:`, rows.length)
            if (rows.length) return rows
        } catch (e) {
            console.error(`[sheetTsv] ${a.kind} error:`, (e as Error).message)
        }
    }
    console.warn('[sheetTsv] no rows parsed for', sheetId, gid)
    return []
}