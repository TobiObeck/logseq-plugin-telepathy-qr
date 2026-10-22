# TelepathyQR

Turns a Logseq page or a part of it into text that is split into QR codes, so another device can read it. The glossary covers the words used in the export options and the Logseq content they act on.

## Language

**Raw**:
The export flavour that keeps the page exactly as Logseq stores it, including Logseq's own properties.
_Avoid_: Original, unprocessed

**Clean**:
The export flavour that removes Logseq-specific markup and rewrites it into plainer markdown.
_Avoid_: Simplified, stripped

**Internal property**:
A property key that Logseq writes for its own use, such as `id`, `collapsed`, or any key in the `logseq.` namespace. Clean drops these.
_Avoid_: System property, hidden property

**User property**:
Any property key that is not an internal property. Clean keeps these verbatim.
_Avoid_: Custom property

**Numbered list**:
A block whose children Logseq shows with numbers, set through the `logseq.order-list-type` property on each child.
_Avoid_: Ordered list
