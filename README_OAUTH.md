OAuth setup

1. Go to https://console.developers.google.com/
2. Create a project and enable YouTube Data API v3
3. Create OAuth 2.0 Client ID (type: Desktop app)
4. Set `YT_OAUTH_CLIENT_ID` and `YT_OAUTH_CLIENT_SECRET` as env vars
5. Run `pnpm dev -- video VIDEO_ID` and complete the browser flow

Tokens saved to `~/.config/youtools/credentials.json`
