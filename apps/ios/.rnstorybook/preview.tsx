import type { Preview } from '@storybook/react-native'
import { View } from 'react-native'

const preview: Preview = {
  decorators: [
    (Story) => (
      <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
        <Story />
      </View>
    ),
  ],
}

export default preview
