import { createElement } from 'react'
import type { Preview } from '@storybook/react-vite'
import 'bulma/css/bulma.min.css'
import '../src/ui/styles.css'
import './preview.css'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) =>
      createElement(
        'div',
        { className: 'tq-story-canvas' },
        createElement('div', { className: 'tq-card' }, createElement(Story)),
      ),
  ],
}

export default preview
