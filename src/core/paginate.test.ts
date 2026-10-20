import { describe, expect, it } from 'vitest'
import { paginate } from './paginate'

describe('paginate', () => {
  it('returns one empty part for empty input', () => {
    expect(paginate('')).toEqual([''])
  })

  it('packs whole lines and never cuts one in half', () => {
    expect(paginate('aaa\nbbb\n', 7)).toEqual(['aaa\n', 'bbb\n'])
  })

  it('hard splits a single line longer than the budget', () => {
    expect(paginate('x'.repeat(10), 4)).toEqual(['xxxx', 'xxxx', 'xx'])
  })

  it('respects the byte budget for multibyte text', () => {
    // 'é' is two UTF-8 bytes: 3 chars = 6 bytes, budget 5 fits 2 chars.
    expect(paginate('ééé', 5)).toEqual(['éé', 'é'])
  })

  it('concatenating all parts reproduces the input byte for byte', () => {
    const text = 'line one\nline two\n\nline four\n'
    expect(paginate(text, 12).join('')).toBe(text)
  })
})
