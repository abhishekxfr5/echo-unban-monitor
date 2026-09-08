# Echo Unban Monitor

Discord bot for monitoring Instagram account availability, managing recovery timers, generating premium Instagram profile cards, and automatically posting a recovery result.

## Features

- `/monitor username` — starts a monitor and fetches Instagram profile data through Apify.
- Live recovery monitoring — checks active monitors periodically and requires consecutive valid profile checks before auto-completing.
- Edit / Complete / Delete buttons.
- Custom auto-complete timer from the Edit modal (`30m`, `2h`, `1d 4h`, `Off`).
- Premium compact Instagram-style profile card saved as `profile-cards/<monitorId>.png`.
- `/list`, `/dashboard`, `/edit`, `/ping`.
- SQLite persistence.
- Railway-ready configuration with optional persistent Volume support.

## Environment

Copy `.env.example` to `.env` and fill in your own values.

`MONITOR_INTERVAL_SECONDS=60` controls live checks. Minimum is 30 seconds.

`RECOVERY_CONFIRMATIONS=2` means the profile must be returned successfully twice before automatic recovery. This reduces false positives from temporary scraper/API errors.

## Local

```powershell
npm install
npm run deploy
npm start
```

## Railway + SQLite

1. Push the project to a private GitHub repository. Do **not** commit `.env`.
2. Create a Railway service from that repository.
3. Add the variables from `.env.example` in Railway Variables.
4. Add a Railway Volume mounted at `/data`.
5. Set `DB_PATH=/data/monitor.db`.
6. Deploy with `npm start`.

The profile-card directory is created automatically. For durable cards on Railway, mount a Volume at `/data` and optionally set `PROFILE_CARDS_DIR=/data/profile-cards` if you want cards to survive redeploys too.

## Important

Instagram availability detection here is scraper-based via Apify, not the official Instagram API for arbitrary accounts. A temporary scraper failure is treated as `not recovered`; the bot does not complete on an error.
