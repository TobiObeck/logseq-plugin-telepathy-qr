import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './preview'

describe('renderMarkdown', () => {
  it('never emits raw HTML from the source', () => {
    const html = renderMarkdown('<script>alert(1)</script> hello <img src=x onerror=alert(2)>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
  })

  it('renders lists and single-newline breaks', () => {
    expect(renderMarkdown('- a\n- b')).toContain('<li>')
    expect(renderMarkdown('a\nb')).toContain('<br')
  })
})
