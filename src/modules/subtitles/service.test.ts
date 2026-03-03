import { parseSrt, srtToPlainText, searchInSubtitles, TimestampedEntry } from './service'

const SAMPLE_SRT = [
  '1',
  '00:00:01,000 --> 00:00:04,000',
  'Hello world, this is a test.',
  '',
  '2',
  '00:00:05,000 --> 00:00:08,000',
  'TypeScript is great for building tools.',
  '',
  '3',
  '00:00:09,000 --> 00:00:12,000',
  "Let's build something amazing today.",
].join('\n')

// ---------------------------------------------------------------------------
// parseSrt
// ---------------------------------------------------------------------------

describe('parseSrt', () => {
  it('parses multi-block SRT into timestamped entries with correct timestamps and text', () => {
    const entries = parseSrt(SAMPLE_SRT)

    expect(entries).toHaveLength(3)

    expect(entries[0]).toEqual({
      timestamp: '00:00:01',
      text: 'Hello world, this is a test.',
    })
    expect(entries[1]).toEqual({
      timestamp: '00:00:05',
      text: 'TypeScript is great for building tools.',
    })
    expect(entries[2]).toEqual({
      timestamp: '00:00:09',
      text: "Let's build something amazing today.",
    })
  })

  it('returns empty array for empty input', () => {
    expect(parseSrt('')).toEqual([])
  })

  it('handles blocks with fewer than 3 lines gracefully', () => {
    const badSrt = [
      '1',
      '00:00:01,000 --> 00:00:04,000',
      '',
      '',
      '2',
      '',
      '',
      '3',
      '00:00:05,000 --> 00:00:08,000',
      'Valid block here.',
    ].join('\n')

    const entries = parseSrt(badSrt)

    // Only the last block is valid (3 lines: sequence, timestamp, text)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({
      timestamp: '00:00:05',
      text: 'Valid block here.',
    })
  })
})

// ---------------------------------------------------------------------------
// srtToPlainText
// ---------------------------------------------------------------------------

describe('srtToPlainText', () => {
  it('converts entries to deduplicated plain text', () => {
    const entries: TimestampedEntry[] = [
      { timestamp: '00:00:01', text: 'Hello world' },
      { timestamp: '00:00:03', text: 'Hello world' },
      { timestamp: '00:00:05', text: 'Something new' },
      { timestamp: '00:00:07', text: 'Hello world' },
    ]
    const result = srtToPlainText(entries)
    expect(result).toBe('Hello world\nSomething new')
  })

  it('skips empty text entries', () => {
    const entries: TimestampedEntry[] = [
      { timestamp: '00:00:01', text: 'First line' },
      { timestamp: '00:00:03', text: '' },
      { timestamp: '00:00:05', text: '   ' },
      { timestamp: '00:00:07', text: 'Second line' },
    ]
    const result = srtToPlainText(entries)
    expect(result).toBe('First line\nSecond line')
  })

  it('returns empty string for empty array', () => {
    expect(srtToPlainText([])).toBe('')
  })
})

// ---------------------------------------------------------------------------
// searchInSubtitles
// ---------------------------------------------------------------------------

describe('searchInSubtitles', () => {
  const entries: TimestampedEntry[] = [
    { timestamp: '00:00:01', text: 'Hello world, this is a test.' },
    { timestamp: '00:00:05', text: 'TypeScript is great for building tools.' },
    { timestamp: '00:00:09', text: "Let's build something amazing today." },
  ]

  it('performs case-insensitive matching', () => {
    const results = searchInSubtitles(entries, 'HELLO')
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      timestamp: '00:00:01',
      text: 'Hello world, this is a test.',
    })
  })

  it('returns empty array when no matches found', () => {
    const results = searchInSubtitles(entries, 'nonexistent')
    expect(results).toEqual([])
  })

  it('finds multiple matches', () => {
    const results = searchInSubtitles(entries, 'build')
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      timestamp: '00:00:05',
      text: 'TypeScript is great for building tools.',
    })
    expect(results[1]).toEqual({
      timestamp: '00:00:09',
      text: "Let's build something amazing today.",
    })
  })
})
