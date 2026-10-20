/**
 * The static showcase snippet shown in the Config stage preview columns when
 * the source toggle is on `Example` (DESIGN.md §2.2, Q36).
 *
 * Organised as a tour: page properties first, then standard markdown, then
 * Logseq specifics, then page refs and embeds. Every transform feature appears
 * exactly once, so flipping any option visibly changes the output column.
 */
export const EXAMPLE_MD = `- TelepathyQR showcase page
author:: Tobi Obeck
repository:: https://github.com/TobiObeck/logseq-plugin-telepathy-qr
website:: https://tobiobeck.com/
	- Standard markdown
		- **bold**, *italic*, ~~struck~~ and \`inline code\`
		- [an external link](https://example.com/docs) plus bare https://example.com
		- > a quoted line
		- \`\`\`js
		  const link = '[[not-a-link]]'
		  const fake = 'id:: not-a-property'
		  \`\`\`
	- Logseq specifics
		- TODO draft the agenda [#A]
		- DONE book the room
		- CANCELED old meeting format
		- Logo ![team logo](../assets/logo.png) and ![](../assets/unnamed.png)
		- hl-color:: yellow
		- collapsed child below
		collapsed:: true
	- Page refs & embeds
		- See [[Meeting Notes]] or [the alias]([[Some Other Page]])
		- Earlier thought ((6ad77db3-76d9-4132-bc22-27e2a1acfd99)) lives on
		- {{embed [[Daily Template]]}} and {{embed ((6ad77db3-76d9-4132-bc22-27e2a1acfd99))}}
	- block that was "copied" for block ref / block embed and thus has an id
  	  id:: 6ad7c79e-c33c-4280-83a2-edcb05a25bb3
`
