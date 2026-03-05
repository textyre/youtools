import type { SortKey, SortOrder } from '../popular-videos/types'

export type { VideoRecord, SortKey, SortOrder } from '../popular-videos/types'

export interface SearchCfg {
  query: string
  channel?: string
  limit: number
  maxScan: number
  sort: SortKey[]
  order: SortOrder
  table: boolean
  ascii: boolean
  wide: boolean
}
