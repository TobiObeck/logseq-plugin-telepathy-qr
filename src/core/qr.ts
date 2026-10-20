import QRCode from 'qrcode'

/**
 * Error correction level L is deliberate: it is the level that buys the most
 * character capacity, and `paginate` already budgets conservatively against
 * it. Higher levels would shrink the number of parts but force a much denser
 * symbol, which phones struggle with when the modal is shown on screen.
 */
export const toQrDataUrl = (text: string): Promise<string> =>
  QRCode.toDataURL(text, {
    errorCorrectionLevel: 'L',
    margin: 2,
    width: 512,
  })
