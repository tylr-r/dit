import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-native'

const main: StorybookConfig = {
  framework: '@storybook/react-native',
  stories: ['../src/**/*.stories.tsx'],
  addons: [
    getAbsolutePath('@storybook/addon-ondevice-controls'),
    getAbsolutePath('@storybook/addon-ondevice-actions'),
  ],
}

export default main

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}
