# load to host

@client (~/Developer/techoutlet):
```bash
tar -czf techoutletbot-$(date +%Y%m%d-%H%M).tar.gz \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude="dist" \
  --exclude=".env" \
  techoutletbot
  ```
  
load to host
@host (~/apps):
```bash
tar -xzf techoutletbot-*.tar.gz
```

```bash
cd techoutletbot
nano .env
```

```bash
NODE_ENV=production
BOT_TOKEN=8085291538:AAGlxFsbqO9e6pScGAnTiavVHdWXcIv91Uw
GOOGLE_SHEET_ID=1_lH4wr7BrgYxHS3e3wNJLAby28diEkTr84Lx_I5823M
APPLE_SHEET_GID=0
APPLE_SHEET_LABEL=APPLE
```

```bash
npm i
npm run build
```

```bash
pm2 delete techoutlet-bot 2>/dev/null || true
pm2 start dist/app/index.js --name techoutlet-bot
pm2 save
pm2 logs techoutlet-bot --lines 50
```
