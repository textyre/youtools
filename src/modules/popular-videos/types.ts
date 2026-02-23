export interface VideoRecord {
  id: string
  title: string
  publishedAt: string
  description: string
  viewCount: number
  likeCount: number
  commentCount: number
}

export type SortKey = 'views' | 'likes' | 'comments'
export type SortOrder = 'asc' | 'desc'
