import React, {act, createElement} from 'react'
import {create, type ReactTestRenderer} from 'react-test-renderer'
import {listenKeyboardFixture, listenWordsFixture} from './listen-keyboard-fixture.mjs'
import {expect, it, vi} from 'vitest'
import {DitButton} from '../../../apps/ios/src/components/DitButton'
import {ListenControls} from '../../../apps/ios/src/components/ListenControls'

vi.mock('react-native', () => ({
  View:'View', Pressable:'Pressable', Text:'Text',
  StyleSheet:{create:(styles:object) => styles, flatten:(style:object) => style}
}))
vi.mock('expo-symbols', () => ({SymbolView:'Symbol'}))
vi.mock('@expo/vector-icons', () => ({MaterialIcons:'Icon'}))
vi.mock('../../../apps/ios/src/components/GlassSurface', () => ({GlassView:'Glass',GlassContainer:'GlassRow'}))
vi.mock('../../../apps/ios/src/design/color', () => ({normalizeColorForNative:(color:string) => color}))

it('matches the shipped Listen keyboard grouping, disabled appearance and authored accessibility hints', async () => {
  vi.stubGlobal('React',React)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  let fixture:Awaited<ReturnType<typeof listenKeyboardFixture>> | undefined
  let tree:ReactTestRenderer | undefined
  const render = (listenStatus:'idle'|'success') => createElement(ListenControls,{
    availableLetters:['E','T'],listenStatus,onReplay:vi.fn(),onSubmitAnswer:vi.fn()
  })
  try {
    await act(() => { tree = create(render('idle')) })
    const rows = tree!.root.findAllByType('GlassRow' as never)
    const keys = () => tree!.root.findAllByType('Pressable' as never)
    const find = (label:string) => keys().find(node => node.props.accessibilityLabel === label)!
    const glass = (label:string) => tree!.root.findAllByType('Glass' as never).find(node =>
      node.findAllByType('Pressable' as never)[0]?.props.accessibilityLabel === label)!
    expect(rows.map(row => row.findAllByType('Pressable' as never).length)).toEqual([10,10,9,7])
    expect(rows.every(row => row.props.spacing === 6)).toBe(true)
    expect(find('Type A').props.accessibilityHint).toBe('A is not available in this pack')
    expect(find('Type A').props.disabled).toBe(true)
    expect(find('Type E').props.accessibilityHint).toBe('Submits the letter E')
    expect(find('Type E').props.disabled).toBe(false)
    const unavailable = Object.assign({},...glass('Type A').props.style.filter(Boolean))
    expect(unavailable.opacity).toBe(0.55)
    expect(unavailable.borderRadius).toBe(10)
    expect(find('Play morse letter sound').props.accessibilityHint).toBe('Replays the current Morse letter')
    await act(() => { tree!.update(render('success')) })
    expect(find('Type E').props.accessibilityHint).toBe('Wait for the next letter')
    expect(find('Type E').props.disabled).toBe(true)
    expect(find('Type A').props.accessibilityHint).toBe('A is not available in this pack')

    fixture = await listenKeyboardFixture()
    const doc = fixture.document
    const button = (letter:string) => doc.querySelector(`button[aria-label="Type ${letter}"]`) as HTMLButtonElement
    const keyState = (letter:string) => {
      const key = button(letter)
      return [key.disabled,key.getAttribute('aria-description'),key.style.opacity]
    }
    const replay = doc.querySelector('button[aria-label="Play morse letter sound"]')!
    expect(replay.getAttribute('aria-description')).toBe(find('Play morse letter sound').props.accessibilityHint)
    expect(doc.defaultView!.getComputedStyle(button('A')).borderTopLeftRadius).toBe(unavailable.borderRadius + 'px')
    expect(doc.querySelectorAll('[glassGroup="6"]')).toHaveLength(rows.length)
    expect(doc.querySelectorAll('button[aria-label^="Type "]')).toHaveLength(36)
    expect(keyState('E')).toEqual([false,'Submits the letter E','1'])
    expect(keyState('A')).toEqual([true,'A is not available in this pack',String(unavailable.opacity)])
    button('A').click()
    expect(button('E').disabled).toBe(false)
    button('E').click()
    expect(keyState('E')).toEqual([true,find('Type E').props.accessibilityHint,'0.55'])
    expect(keyState('A')).toEqual([true,find('Type A').props.accessibilityHint,'0.55'])
    const press = (text:string) => (Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[])
      .find(el => el.textContent === text)!.click()
    press('Restart')
    expect(keyState('Q')).toEqual([false,'Submits the letter Q','1'])
    expect(button('E').disabled).toBe(true)
    press('Cover')
    expect(keyState('Q')).toEqual([true,'Wait for the next letter','0.55'])
  } finally {
    if (tree) await act(() => tree!.unmount())
    await fixture?.close()
    vi.unstubAllGlobals()
  }
})

it('presents native word answers with the shipped interactive glass and disabled appearance', async () => {
  vi.stubGlobal('React', React)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let tree:ReactTestRenderer | undefined
  let fixture:Awaited<ReturnType<typeof listenWordsFixture>> | undefined
  try {
    await act(() => {
      tree = create(createElement(DitButton,{text:'AT', disabled:true, onPress:vi.fn()}))
    })
    const glass = tree!.root.findByType('Glass' as never)
    const style = Object.assign({},...glass.props.style.filter(Boolean))
    expect(glass.props.glassEffectStyle).toBe('regular')
    expect(glass.props.isInteractive).toBe(true)
    fixture = await listenWordsFixture()
    const doc = fixture.document
    const buttons = () => Array.from(doc.querySelectorAll('button'))
    const button = (name:string) => buttons().find(el => el.textContent === name)!
    const answers = () => buttons().filter(el => el.getAttribute('aria-label')?.startsWith('Answer '))
    const checkGlass = (el:Element) => {
      expect(el.getAttribute('backgroundMaterial')).toBe('glass')
    }
    checkGlass(button('Start listening'))
    button('Start listening').click()
    expect(answers()).toHaveLength(0)
    expect(button('Replay').disabled).toBe(true)
    expect(button('Replay').style.opacity).toBe(String(style.opacity))
    button('Finish sound').click()
    expect(answers()).toHaveLength(4)
    for (const answer of answers()) {
      checkGlass(answer)
      expect(doc.defaultView!.getComputedStyle(answer).borderTopLeftRadius).toBe(style.borderRadius+'px')
      expect(answer.disabled).toBe(false)
      expect(answer.style.opacity).toBe('1')
    }
    button('AT').click()
    expect(answers().map(el => el.getAttribute('aria-label'))).toEqual([
      'Answer ON, correct','Answer AT, incorrect','Answer AS','Answer IN'
    ])
    for (const answer of answers()) {
      expect(answer.disabled).toBe(true)
      expect(answer.style.opacity).toBe(String(style.opacity))
    }
    checkGlass(button('Replay'))
    checkGlass(button('Next'))
    button('Replay').click()
    expect(answers()).toHaveLength(0)
  } finally {
    if (tree) await act(() => tree!.unmount())
    await fixture?.close()
    vi.unstubAllGlobals()
  }
})
