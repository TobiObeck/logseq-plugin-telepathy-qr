import type { Meta, StoryObj } from '@storybook/react-vite'
import { initializeConfigStage, storyHost } from '../../.storybook/fixtures'
import { ConfigStage } from './ConfigStage'

const meta = {
  title: 'UI/ConfigStage',
  component: ConfigStage,
  loaders: [
    () => {
      initializeConfigStage()
      return {}
    },
  ],
  args: { host: storyHost },
  render: ({ host }) => <ConfigStage host={host} />,
} satisfies Meta<typeof ConfigStage>

export default meta
type Story = StoryObj<typeof meta>

export const Clean: Story = {}

export const Raw: Story = {
  loaders: [
    () => {
      initializeConfigStage('raw')
      return {}
    },
  ],
}
