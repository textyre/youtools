import { compositeSort } from './sort'
import { VideoRecord } from './types'

const v = (id: string, views: number, likes: number, comments: number): VideoRecord => ({
  id,
  title: id,
  publishedAt: '2024-01-01T00:00:00Z',
  description: '',
  viewCount: views,
  likeCount: likes,
  commentCount: comments,
})

describe('compositeSort', () => {
  it('sorts by single key desc', () => {
    const videos = [v('a', 100, 5, 1), v('b', 200, 3, 1), v('c', 50, 9, 1)]
    const result = compositeSort(videos, ['views'], 'desc')
    expect(result.map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts by single key asc', () => {
    const videos = [v('a', 100, 5, 1), v('b', 200, 3, 1), v('c', 50, 9, 1)]
    const result = compositeSort(videos, ['views'], 'asc')
    expect(result.map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })

  it('uses second key as tiebreaker', () => {
    const videos = [v('a', 100, 5, 1), v('b', 100, 10, 1), v('c', 100, 3, 1)]
    const result = compositeSort(videos, ['views', 'likes'], 'desc')
    expect(result.map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('supports comments key', () => {
    const videos = [v('a', 100, 5, 20), v('b', 100, 5, 5), v('c', 100, 5, 50)]
    const result = compositeSort(videos, ['comments'], 'desc')
    expect(result.map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate the input array', () => {
    const videos = [v('a', 100, 5, 1), v('b', 200, 3, 1)]
    const original = [...videos]
    compositeSort(videos, ['views'], 'desc')
    expect(videos).toEqual(original)
  })
})
