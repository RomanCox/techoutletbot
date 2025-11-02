import 'dotenv/config'
import { buildBot } from './bot.js'
import { ConfigStore } from '../core/config/configStore.js'
import { registerMenu } from '../features/menu/index.js'
import { registerAdmin } from '../features/admin/index.js'
import { registerResponses } from '../features/responses/index.js'

async function main() {
    const config = new ConfigStore()
    await config.load()

    const bot = buildBot({ token: process.env.BOT_TOKEN!, config })

    // Подключаем «фичи»
    registerMenu(bot, config)
    registerAdmin(bot, config)
    registerResponses(bot, config)

    await bot.launch()
    console.log('✅ Bot started')

    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
