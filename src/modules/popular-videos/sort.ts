import { VideoRecord, SortKey, SortOrder } from './types'

function getValue(v: VideoRecord, key: SortKey): number {
  if (key === 'views') return v.viewCount
  if (key === 'likes') return v.likeCount
  return v.commentCount
}

export function compositeSort(videos: VideoRecord[], keys: SortKey[], order: SortOrder): VideoRecord[] {
  const dir = order === 'desc' ? -1 : 1
  return [...videos].sort((a, b) => {
    for (const key of keys) {
      const diff = (getValue(a, key) - getValue(b, key)) * dir
      if (diff !== 0) return diff
    }
    return 0
  })
}
