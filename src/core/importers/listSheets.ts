import 'dotenv/config'
import { google } from 'googleapis'

export async function listSheets(sheetId: string) {
    // 1️⃣ Загружаем JSON из переменной окружения
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!)

    // 2️⃣ Создаём объект авторизации (современный способ)
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    // 3️⃣ Инициализируем Google Sheets API
    const sheets = google.sheets({ version: 'v4', auth })

    // 4️⃣ Получаем список вкладок (только ID и имя)
    const res = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'sheets.properties(sheetId,title)',
    })

    // 5️⃣ Возвращаем удобный массив [{ gid, title }]
    return (res.data.sheets ?? [])
        .map(s => ({
            gid: s.properties?.sheetId!,
            title: s.properties?.title ?? '',
        }))
        .filter(x => x.gid != null && x.title)
}