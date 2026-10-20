/**
 * All plugin styling, injected into Logseq via `provideStyle`. Logseq's own
 * CSS variables are used where they exist so the modal follows the theme;
 * every fallback is a neutral light-mode value.
 */
export const PLUGIN_CSS = `
body {
  margin: 0;
  background: transparent;
}
.tq-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11;
  font-size: 14px;
}
.tq-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--ls-primary-background-color, #fff);
  color: var(--ls-primary-text-color, #333);
  border-radius: 10px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
  padding: 20px;
  min-width: 320px;
  max-width: min(560px, 92vw);
  max-height: min(860px, 92vh);
}
.tq-card.tq-card-wide {
  max-width: min(880px, 94vw);
}
.tq-close {
  position: absolute;
  top: 10px;
  right: 10px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 18px;
  line-height: 1;
  padding: 4px;
  cursor: pointer;
  opacity: 0.6;
}
.tq-close:hover { opacity: 1; }
.tq-back {
  position: absolute;
  top: 12px;
  left: 12px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 12px;
  padding: 4px;
  cursor: pointer;
  opacity: 0.75;
}
.tq-back:hover { opacity: 1; }
.tq-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 4px;
}
.tq-opt-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tq-opt-label {
  flex: 0 0 96px;
  font-size: 12px;
  opacity: 0.7;
}
.tq-nested {
  margin-left: 106px;
  padding-left: 10px;
  border-left: 1px solid var(--ls-border-color, #ddd);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tq-seg {
  display: inline-flex;
  border: 1px solid var(--ls-border-color, #ccc);
  border-radius: 6px;
  overflow: hidden;
}
.tq-seg button {
  border: none;
  border-right: 1px solid var(--ls-border-color, #ccc);
  background: transparent;
  color: inherit;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
}
.tq-seg button:last-child { border-right: none; }
.tq-seg button.active { background: var(--ls-selection-background-color, #e1f0fe); }
.tq-seg button:disabled { opacity: 0.4; cursor: default; }
.tq-preview-toggle { margin: 10px 0 6px; }
.tq-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1;
  min-height: 220px;
  overflow: hidden;
  margin-bottom: 12px;
}
.tq-colwrap {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tq-col-head {
  font-size: 11px;
  opacity: 0.65;
  margin-bottom: 4px;
}
.tq-col {
  flex: 1;
  overflow: auto;
  margin: 0;
  padding: 8px;
  border: 1px solid var(--ls-border-color, #ddd);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.tq-footer {
  display: flex;
  justify-content: flex-end;
}
.tq-primary {
  padding: 7px 16px;
  border-radius: 6px;
  border: 1px solid var(--ls-border-color, #bbb);
  background: var(--ls-button-background, #f5f5f5);
  color: inherit;
  font-size: 13px;
  cursor: pointer;
}
.tq-primary:disabled { opacity: 0.6; cursor: default; }
.tq-tabs { margin: 6px 0 14px; }
.tq-qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.tq-qr-plate {
  background: #fff;
  padding: 12px;
  border-radius: 8px;
}
.tq-qr-plate img {
  display: block;
  width: min(320px, 58vw);
  height: auto;
}
.tq-qr-placeholder {
  width: min(320px, 58vw);
  height: min(320px, 58vw);
}
.tq-bottom {
  display: flex;
  align-items: center;
  width: 100%;
}
.tq-navbtn {
  min-width: 92px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--ls-border-color, #bbb);
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
.tq-navbtn:disabled { opacity: 0.45; cursor: default; }
.tq-counter {
  flex: 1;
  text-align: center;
  font-size: 13px;
}
.tq-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: tq-spin 0.8s linear infinite;
}
@keyframes tq-spin {
  to { transform: rotate(360deg); }
}
.tq-text-view {
  flex: 1;
  overflow: auto;
  margin: 0;
  padding: 10px;
  border: 1px solid var(--ls-border-color, #ddd);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.tq-rendered {
  flex: 1;
  overflow: auto;
  padding: 10px 14px;
  border: 1px solid var(--ls-border-color, #ddd);
  border-radius: 6px;
  line-height: 1.6;
}
.tq-rendered pre {
  overflow: auto;
  background: var(--ls-secondary-background-color, #f7f7f7);
  padding: 8px;
  border-radius: 4px;
}
.tq-hint {
  font-size: 12px;
  opacity: 0.7;
}
`
