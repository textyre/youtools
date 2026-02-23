import fs from 'fs'
import path from 'path'
import os from 'os'
import { google } from 'googleapis'
import open from 'open'
import http from 'http'

const CREDENTIALS_PATH = path.join(os.homedir(), '.config', 'youtools', 'credentials.json')

export async function ensureAuthClient() {
  const clientId = process.env.YT_OAUTH_CLIENT_ID
  const clientSecret = process.env.YT_OAUTH_CLIENT_SECRET
  const redirectPort = 54321
  if (!clientId || !clientSecret) {
    throw new Error('Set YT_OAUTH_CLIENT_ID and YT_OAUTH_CLIENT_SECRET in env')
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, `http://localhost:${redirectPort}/oauth2callback`)

  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf8')
    const token = JSON.parse(raw)
    oauth2Client.setCredentials(token)
    return oauth2Client
  } catch {
    // continue to auth
  }

  const scopes = ['https://www.googleapis.com/auth/youtube.readonly']
  const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes })
  await open(authUrl)

  const code = await new Promise<string>((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      if (!req.url) return
      const u = new URL(req.url, `http://localhost:${redirectPort}`)
      const c = u.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('You can close this window and return to the CLI')
      if (c) {
        resolve(c)
        srv.close()
      } else {
        reject(new Error('No code received'))
      }
    })
    srv.listen(redirectPort)
  })

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  try {
    fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true })
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(tokens), { mode: 0o600 })
  } catch {
    // ignore
  }

  return oauth2Client
}
