# youtools

CLI tools for YouTube. This repository contains a `popular-comments` module that fetches popular comments for a video and renders them in an ASCII-friendly terminal table.

Quick start

1. Install dependencies (recommended pnpm):

```bash
pnpm install
pnpm build
```

2. Create OAuth credentials in Google Cloud Console (OAuth Client ID) and set env vars:

```bash
export YT_OAUTH_CLIENT_ID=your_client_id
export YT_OAUTH_CLIENT_SECRET=your_client_secret
```

3. Run the command and follow the browser auth flow:

```bash
pnpm dev -- video VIDEO_ID
```

Example:

```bash
pnpm dev -- video dQw4w9WgXcQ --limit 30 --sort likes_plus_author --ascii
```

Notes:
- Detecting whether the channel owner "liked" a comment is not available via the official API. This tool marks comments as special when the channel owner replied to them (heuristic).
- Tokens are saved to `~/.config/youtools/credentials.json` with permissions set to 600.
