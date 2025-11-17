import 'dotenv/config'
import { google } from 'googleapis'

type SheetInfo = {
    gid: number
    title: string
}

export async function listSheets(sheetId: string): Promise<SheetInfo[]> {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!)

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    const res = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'sheets.properties(sheetId,title)',
    })

    return (res.data.sheets ?? [])
        .map(s => ({
            gid: s.properties?.sheetId!,
            title: s.properties?.title ?? '',
        }))
        .filter(s => s.gid != null && s.title)
}