import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { transformFileSync } = require('@babel/core')
const appRoot = resolve(import.meta.dirname, '../..')
type Registration = {
  name: string
  layout: string
  initialProps?: Record<string, unknown>
}

// Exercise Expo's actual Babel serialization, then evaluate the isolated layout.
// Native views are leaves here; no React Native app runtime is available.
const loadWidget = () => {
  let registration: Registration | undefined
  const { code } = transformFileSync(resolve(appRoot, 'src/widgets/DitProgress.tsx'), {
    cwd: appRoot,
    envName: 'production',
    caller: { name: 'metro', platform: 'ios' },
  })
  runInNewContext(code, {
    exports: {},
    require: (name: string) => {
      if (name === 'react/jsx-runtime') return require(name)
      if (name !== 'expo-widgets') throw new Error(`Unexpected app import: ${name}`)
      return {
        createWidget: (name: string, layout: string, initialProps?: Record<string, unknown>) => {
          registration = { name, layout, initialProps }
          return registration
        },
      }
    },
  })
  if (!registration) throw new Error('Widget was not registered')

  const element = (type: string, props: object) => ({ type, props })
  const globals: Record<string, unknown> = {
    _jsx: element,
    _jsxs: element,
    containerBackground: (style: string, container: string) => ({
      modifier: 'containerBackground', style, container,
    }),
  }
  for (const name of ['VStack', 'HStack', 'ZStack', 'Text', 'Spacer', 'Image', 'ProgressView']) {
    globals[name] = name
  }
  for (const name of ['background', 'font', 'resizable', 'foregroundStyle', 'frame', 'padding', 'clipShape']) {
    globals[name] = (value: unknown) => ({ modifier: name, value })
  }
  const render: (props: unknown, environment: object) => {
    props: { modifiers?: object[] }
  } = runInNewContext(
    `(${registration.layout})`, globals,
  )
  return { ...registration, render }
}

describe('DitProgress widget startup', () => {
  it('bundles its layout for a fresh install before the app opens', () => {
    const config = JSON.parse(readFileSync(resolve(appRoot, 'app.json'), 'utf8'))
    const plugin = config.expo.plugins.find((entry: unknown[]) => entry[0] === 'expo-widgets')
    const widget = plugin[1].widgets.find((entry: { name: string }) => entry.name === 'DitProgress')
    expect(widget.ios?.initialLayout).toBe('./src/widgets/DitProgress.tsx')
  })

  for (const widgetFamily of ['systemSmall', 'systemMedium', 'accessoryRectangular']) {
    it(`${widgetFamily} declares the WidgetKit container background required on iOS 17+`, () => {
      const widget = loadWidget()
      const tree = widget.render(widget.initialProps, { widgetFamily })
      expect(tree.props.modifiers).toContainEqual({
        modifier: 'containerBackground',
        style: widgetFamily === 'accessoryRectangular' ? '#00000000' : '#0A0F14',
        container: 'widget',
      })
    })

    it(`${widgetFamily} renders its registered initial props without a progress update`, () => {
      const widget = loadWidget()
      expect(widget.initialProps).toBeDefined()
      const tree = JSON.stringify(widget.render(widget.initialProps, { widgetFamily }))
      expect(tree).toContain('0/36')
      expect(tree).toContain('Letters learned')
    })

    it(`${widgetFamily} tolerates missing props from an existing installation`, () => {
      const widget = loadWidget()
      const tree = JSON.stringify(widget.render(undefined, { widgetFamily }))
      expect(tree).toContain('0/36')
    })

    it(`${widgetFamily} renders published progress`, () => {
      const widget = loadWidget()
      const tree = JSON.stringify(widget.render({
        ...widget.initialProps,
        streak: 3,
        todayCorrect: 8,
        goal: 15,
        heroKind: 'mastered',
        heroValue: 5,
        heroTotal: 36,
      }, { widgetFamily }))
      expect(tree).toContain('3-day streak')
      expect(tree).toContain('8/15 correct today')
      if (widgetFamily !== 'accessoryRectangular') expect(tree).toContain('5/36')
    })
  }
})
