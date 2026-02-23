import { parseChannelInput, ChannelInput } from './channel'

describe('parseChannelInput', () => {
  it('detects raw channel ID starting with UC', () => {
    expect(parseChannelInput('UCxxxxxxxxxxxxxxxxxxxxxx')).toEqual({
      type: 'id',
      value: 'UCxxxxxxxxxxxxxxxxxxxxxx',
    } as ChannelInput)
  })

  it('detects @handle', () => {
    expect(parseChannelInput('@mkbhd')).toEqual({ type: 'handle', value: 'mkbhd' })
  })

  it('extracts channel ID from youtube.com/channel/ URL', () => {
    expect(parseChannelInput('https://www.youtube.com/channel/UCxxxxxx')).toEqual({
      type: 'id',
      value: 'UCxxxxxx',
    })
  })

  it('extracts handle from youtube.com/@handle URL', () => {
    expect(parseChannelInput('https://youtube.com/@mkbhd')).toEqual({
      type: 'handle',
      value: 'mkbhd',
    })
  })

  it('extracts username from legacy youtube.com/user/ URL', () => {
    expect(parseChannelInput('https://youtube.com/user/mkbhd')).toEqual({
      type: 'username',
      value: 'mkbhd',
    })
  })

  it('throws on unrecognised input', () => {
    expect(() => parseChannelInput('not-a-channel')).toThrow()
  })
})
