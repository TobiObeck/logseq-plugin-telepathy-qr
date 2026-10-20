import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

/**
 * The Rendered preview pipeline (DESIGN.md §5).
 *
 * Deliberately simpler than a full publishing pipeline: no rehype-raw, so raw
 * HTML in notes never reaches the DOM and sanitizing stays trivial; no
 * slug/highlight/figure plugins, because a preview does not need them.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify)

export const renderMarkdown = (markdown: string): string =>
  String(processor.processSync(markdown))
