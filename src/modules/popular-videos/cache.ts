import fs from 'fs'
import path from 'path'
import os from 'os'
import { VideoRecord } from './types'

const CACHE_DIR = path.join(os.homedir(), '.cache', 'youtools')

function cacheFilePath(channelId: string): string {
  return path.join(CACHE_DIR, `${channelId}-videos.json`)
}

export function isCacheFresh(fetchedAt: string, ttlSeconds: number): boolean {
  if (ttlSeconds <= 0) return false
  const age = Date.now() - new Date(fetchedAt).getTime()
  return age < ttlSeconds * 1000
}

export function readCache(channelId: string, ttlSeconds: number): VideoRecord[] | null {
  const file = cacheFilePath(channelId)
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const data = JSON.parse(raw) as { fetchedAt: string; videos: VideoRecord[] }
    if (!isCacheFresh(data.fetchedAt, ttlSeconds)) return null
    return data.videos
  } catch {
    return null
  }
}

export function writeCache(channelId: string, videos: VideoRecord[]): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 })
    const file = cacheFilePath(channelId)
    const data = { fetchedAt: new Date().toISOString(), videos }
    fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 })
  } catch {
    // cache write failure is non-fatal
  }
}
