import React, { act, createElement } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { expect, it, vi } from 'vitest'
import { SignInSheet } from '../../../apps/ios/src/components/SignInSheet'
import { getEmailSignInErrorMessage, getEmailSignUpErrorMessage } from '../../../packages/core/src/utils/appState'

// Run the shipped component's state, callbacks and field configuration. Only
// native primitives and provider calls are replaced. This does not render UIKit.
vi.mock('react-native', () => ({
  ActivityIndicator:'Spinner', KeyboardAvoidingView:'KeyboardWrap', Modal:'Modal',
  Pressable:'Button', Text:'Text', TextInput:'Field', View:'View',
  StyleSheet:{create:(s:object)=>s, absoluteFill:{}, hairlineWidth:1},
}))
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons:'Icon', MaterialIcons:'Icon' }))
vi.mock('expo-blur', () => ({BlurView:'Blur'}))
vi.mock('expo-symbols', () => ({SymbolView:'Symbol'}))
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets:()=>({bottom:0})}))
vi.mock('../../../apps/ios/src/design/color', () => ({normalizeColorForNative:(s:string)=>s}))

it('routes the picker Cancel, backdrop and system dismissal to the owner without starting a provider', async () => {
  vi.stubGlobal('React', React)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const dismiss = vi.fn()
  const apple = vi.fn()
  const google = vi.fn()
  const email = vi.fn()
  const createAccount = vi.fn()
  let sheet: ReactTestRenderer | undefined
  try {
    await act(async () => {
      sheet = create(createElement(SignInSheet, { visible:true, onDismiss:dismiss,
        onSignInWithApple:apple, onSignInWithGoogle:google, onSignInWithEmail:email, onCreateAccountWithEmail:createAccount }))
    })
    const root = sheet!.root
    const buttons = root.findAll(node => String(node.type) === 'Button')
    expect(buttons.map(node => node.props.accessibilityLabel)).toEqual([
      'Dismiss sign-in', 'Continue with Apple', 'Continue with Google', 'Continue with Email', 'Cancel sign-in'
    ])
    const modal = root.find(node => String(node.type) === 'Modal')
    for (const close of [buttons[4].props.onPress, buttons[0].props.onPress, modal.props.onRequestClose]) {
      dismiss.mockClear()
      act(close)
      expect(dismiss).toHaveBeenCalledTimes(1)
    }
    for (const provider of [apple, google, email, createAccount]) expect(provider).not.toHaveBeenCalled()
  } finally {
    act(() => sheet?.unmount())
    vi.unstubAllGlobals()
  }
})

it('executes the original picker, email drafts, keyboard submission, error, retry, creation and dismissal', async () => {
  vi.stubGlobal('React',React)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  let finish:(v:{ok:false;error:string})=>void=()=>{}
  const sign=vi.fn(()=>new Promise<{ok:false;error:string}>(resolve=>{finish=resolve}))
  const signup=vi.fn(async()=>({ok:true as const}))
  const props={visible:true,onDismiss:vi.fn(),onSignInWithApple:vi.fn(),onSignInWithGoogle:vi.fn(),
    onSignInWithEmail:sign,onCreateAccountWithEmail:signup}
  let r!:ReactTestRenderer
  try {
    await act(async()=>{r=create(createElement(SignInSheet,props))})
    const find=(key:string,value:string)=>r.root.findAll(node=>typeof node.type==='string' && node.props[key]===value)[0]
    const press=(name:string)=>act(()=>find('accessibilityLabel',name).props.onPress())
    press('Continue with Email')
    const field=(name:string)=>find('placeholder',name)
    expect(field('Email').props).toMatchObject({keyboardType:'email-address',autoCapitalize:'none',autoCorrect:false,returnKeyType:'next'})
    expect(field('Password').props).toMatchObject({secureTextEntry:true,returnKeyType:'go',textContentType:'password'})
    const signButton=()=>find('accessibilityLabel','Sign in with email')
    expect(signButton().props.disabled).toBe(true)
    act(()=>{field('Email').props.onChangeText('  fixture@example.invalid '); field('Password').props.onChangeText('  fixture pass ')})
    press('Back to sign-in options')
    press('Continue with Email')
    expect(field('Email').props.value).toBe('  fixture@example.invalid ')
    expect(field('Password').props.value).toBe('  fixture pass ')
    act(()=>field('Password').props.onSubmitEditing())
    expect(sign).toHaveBeenCalledWith('fixture@example.invalid','  fixture pass ')
    expect(signButton().props.disabled).toBe(true)
    expect(field('Password').props.editable).toBe(false)
    expect(r.root.findAll(node=>node.type==='Spinner')).toHaveLength(1)
    const error=getEmailSignInErrorMessage({code:'auth/wrong-password'})
    await act(async()=>finish({ok:false,error}))
    expect(find('children',error)).toBeTruthy()
    expect(signButton().props.disabled).toBe(false)
    await act(async()=>find('accessibilityLabel','Create account with email').props.onPress())
    expect(signup).toHaveBeenCalledWith('fixture@example.invalid','  fixture pass ')
    expect(props.onDismiss).toHaveBeenCalledOnce()
    await act(async()=>r.update(createElement(SignInSheet,{...props,visible:false})))
    await act(async()=>r.update(createElement(SignInSheet,props)))
    press('Continue with Email')
    expect(field('Password').props.value).toBe('')
    expect(field('Email').props.value).toBe('')
  } finally {
    if(r) act(()=>r.unmount())
    vi.unstubAllGlobals()
  }
})

it('pins the separate sign-in and sign-up service messages',()=>{
  for(const code of ['invalid-credential','user-not-found','wrong-password'])
    expect(getEmailSignInErrorMessage({code:'auth/'+code})).toBe('Email or password is incorrect.')
  for(const map of [getEmailSignInErrorMessage,getEmailSignUpErrorMessage])
    expect(map({code:'auth/invalid-email'})).toBe('That email address is not valid.')
  expect(getEmailSignInErrorMessage({code:'auth/network-request-failed'})).toContain('interrupted sign-in')
  expect(getEmailSignUpErrorMessage({code:'auth/network-request-failed'})).toContain('interrupted sign-up')
  expect(getEmailSignUpErrorMessage({code:'auth/email-already-in-use'})).toBe('An account already exists for that email. Sign in instead.')
  expect(getEmailSignUpErrorMessage({code:'auth/weak-password'})).toBe('Password is too weak. Use at least 6 characters.')
})
