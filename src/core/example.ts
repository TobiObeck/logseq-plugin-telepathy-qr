/**
 * The static showcase snippet shown in the Config stage preview columns when
 * the source toggle is on `Example` (DESIGN.md §2.2, Q36).
 *
 * It exercises every transform feature exactly once, so flipping any option
 * visibly changes the output column. It doubles as living documentation of
 * what Clean mode does.
 */
export const EXAMPLE_MD = `- TelepathyQR showcase page
id:: 6ad77db3-76d9-4132-bc22-27e2a1ac8fd9
author:: Krext
	- TODO draft the agenda [#A]
	- DONE book the room
	- CANCELED old meeting format
	- See [[Meeting Notes]] or [the alias]([[Some Other Page]])
	- Logo ![team logo](../assets/logo.png) and ![](../assets/unnamed.png)
	- Earlier thought ((6ad77db3-76d9-4132-bc22-27e2a1acfd99)) lives on
	- {{embed [[Daily Template]]}} and {{embed ((6ad77db3-76d9-4132-bc22-27e2a1acfd99))}}
	- Docs: [the docs](https://example.com/docs) plus bare https://example.com and file:///C:/notes/local.md
	- collapsed child below
	collapsed:: true
	- hl-color:: yellow
	- \`\`\`js
	  const link = '[[not-a-link]]'
	  const fake = 'id:: not-a-property'
	  \`\`\`
`
