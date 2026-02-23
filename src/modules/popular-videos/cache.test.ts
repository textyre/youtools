import { isCacheFresh } from './cache'

describe('isCacheFresh', () => {
  it('returns true when fetchedAt is within TTL', () => {
    const fetchedAt = new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min ago
    expect(isCacheFresh(fetchedAt, 3600)).toBe(true)
  })

  it('returns false when fetchedAt is older than TTL', () => {
    const fetchedAt = new Date(Date.now() - 1000 * 60 * 90).toISOString() // 90 min ago
    expect(isCacheFresh(fetchedAt, 3600)).toBe(false)
  })

  it('returns false for TTL of 0', () => {
    const fetchedAt = new Date(Date.now() - 1).toISOString()
    expect(isCacheFresh(fetchedAt, 0)).toBe(false)
  })
})
