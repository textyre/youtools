import type { SortKey, SortOrder } from '../popular-videos/types'

export type { VideoRecord, SortKey, SortOrder } from '../popular-videos/types'

export interface SearchCfg {
  query: string
  channel?: string
  limit: number
  sort: SortKey[]
  order: SortOrder
  ascii: boolean
  wide: boolean
}
