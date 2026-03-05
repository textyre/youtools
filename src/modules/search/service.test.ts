import { buildSearchResults } from './service'
import { VideoRecord } from './types'

describe('buildSearchResults', () => {
  it('maps search items + stats to VideoRecord[]', () => {
    const searchItems = [
      { id: { videoId: 'vid1' } },
      { id: { videoId: 'vid2' } },
    ]
    const statsItems = [
      {
        id: 'vid1',
        snippet: { title: 'Video One', publishedAt: '2024-01-01T00:00:00Z', description: 'desc one' },
        statistics: { viewCount: '1000', likeCount: '50', commentCount: '10' },
      },
      {
        id: 'vid2',
        snippet: { title: 'Video Two', publishedAt: '2024-06-01T00:00:00Z', description: 'desc two' },
        statistics: { viewCount: '2000', likeCount: '100', commentCount: '20' },
      },
    ]

    const result = buildSearchResults(searchItems as any, statsItems as any)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual<VideoRecord>({
      id: 'vid1',
      title: 'Video One',
      publishedAt: '2024-01-01T00:00:00Z',
      description: 'desc one',
      viewCount: 1000,
      likeCount: 50,
      commentCount: 10,
    })
    expect(result[1].id).toBe('vid2')
    expect(result[1].viewCount).toBe(2000)
  })

  it('handles missing statistics gracefully', () => {
    const searchItems = [{ id: { videoId: 'vid1' } }]
    const statsItems = [
      {
        id: 'vid1',
        snippet: { title: 'No Stats', publishedAt: '2024-01-01T00:00:00Z', description: '' },
        statistics: {},
      },
    ]

    const result = buildSearchResults(searchItems as any, statsItems as any)

    expect(result[0].viewCount).toBe(0)
    expect(result[0].likeCount).toBe(0)
    expect(result[0].commentCount).toBe(0)
  })

  it('skips search items with no videoId', () => {
    const searchItems = [
      { id: { videoId: 'vid1' } },
      { id: {} }, // no videoId
    ]
    const statsItems = [
      {
        id: 'vid1',
        snippet: { title: 'Good', publishedAt: '2024-01-01T00:00:00Z', description: '' },
        statistics: { viewCount: '500', likeCount: '10', commentCount: '2' },
      },
    ]

    const result = buildSearchResults(searchItems as any, statsItems as any)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('vid1')
  })

  it('skips stats items with no id', () => {
    const searchItems = [{ id: { videoId: 'vid1' } }]
    const statsItems = [
      {
        // no id field
        snippet: { title: 'Orphan', publishedAt: '', description: '' },
        statistics: { viewCount: '100', likeCount: '5', commentCount: '1' },
      },
    ]

    const result = buildSearchResults(searchItems as any, statsItems as any)
    // vid1 has no matching stats entry, so it gets zero stats
    expect(result[0].viewCount).toBe(0)
  })
})
