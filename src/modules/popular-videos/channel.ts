export type ChannelInput =
  | { type: 'id'; value: string }
  | { type: 'handle'; value: string }
  | { type: 'username'; value: string }

export function parseChannelInput(raw: string): ChannelInput {
  // Raw channel ID (YouTube channel IDs are 24 chars starting with UC)
  if (/^UC[\w-]{22}$/.test(raw)) {
    return { type: 'id', value: raw }
  }

  // @handle (without URL)
  if (raw.startsWith('@')) {
    return { type: 'handle', value: raw.slice(1) }
  }

  // URL forms
  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    throw new Error(`Cannot parse channel input: ${raw}`)
  }

  const pathname = url.pathname

  // /channel/UCxxx
  const channelMatch = pathname.match(/^\/channel\/(UC[\w-]+)/)
  if (channelMatch) return { type: 'id', value: channelMatch[1] }

  // /@handle
  const handleMatch = pathname.match(/^\/@([\w-]+)/)
  if (handleMatch) return { type: 'handle', value: handleMatch[1] }

  // /user/username
  const userMatch = pathname.match(/^\/user\/([\w-]+)/)
  if (userMatch) return { type: 'username', value: userMatch[1] }

  throw new Error(`Cannot parse channel input: ${raw}`)
}
