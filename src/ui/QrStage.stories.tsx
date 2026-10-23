import type { Meta, StoryObj } from '@storybook/react-vite'
import { initializeQrStage } from '../../.storybook/fixtures'
import { QrStage } from './QrStage'
import type { QrTab } from '../core/store'

const meta = {
  title: 'UI/QrStage',
  component: QrStage,
  render: () => <QrStage />,
} satisfies Meta<typeof QrStage>

export default meta
type Story = StoryObj<typeof meta>

const storyForTab = (tab: QrTab): Story => ({
  loaders: [
    async () => {
      await initializeQrStage(tab)
      return {}
    },
  ],
})

export const QRCode = storyForTab('qr')
export const Text = storyForTab('text')
export const Rendered = storyForTab('rendered')
