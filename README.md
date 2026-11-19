# World Cup WhatsApp bot

Sends a daily World Cup 2026 review to WhatsApp through [Green API](https://green-api.com). `server.py` runs the schedule (09:00 Israel time) and `bot.py` builds and sends the message.

## Required environment variables

All configuration is read from environment variables. Set them in your hosting provider's environment settings (or export them before running locally). Never commit their values to the repository.

| Variable | Purpose |
| --- | --- |
| `GREEN_API_ID` | Green API instance ID (`idInstance`) |
| `GREEN_API_TOKEN` | Green API instance token (`apiTokenInstance`) |
| `MY_PHONE` | Recipient number in international format, without `+` (e.g. `9725XXXXXXXX`) |
| `GEMINI_API_KEY` | Google Gemini API key, used to write the review (a fixed template is sent if the call fails) |
| `FOOTBALL_API_KEY` | [football-data.org](https://www.football-data.org) API token, used for the match results |
