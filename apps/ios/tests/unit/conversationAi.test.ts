import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ initialize: vi.fn(), getToken: vi.fn(), getAI: vi.fn(), model: vi.fn(), send: vi.fn(), app: {}, appCheck: {} }))
vi.mock('@react-native-firebase/app', () => ({ getApp: () => mocks.app }))
vi.mock('@react-native-firebase/app-check', () => ({ initializeAppCheck: mocks.initialize, getToken: mocks.getToken }))
vi.mock('@react-native-firebase/ai', () => ({
  GoogleAIBackend: class {}, getAI: mocks.getAI, getGenerativeModel: mocks.model,
}))
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('__DEV__', true)
  mocks.getAI.mockReturnValue({})
  mocks.initialize.mockResolvedValue(mocks.appCheck)
  mocks.getToken.mockResolvedValue({ token: 'test-app-check-token' })
  mocks.model.mockReturnValue({ startChat: () => ({ sendMessage: mocks.send, getHistory: async () => [] }) })
  mocks.send.mockResolvedValue({ response: { text: () => 'UR RST 599 K' } })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('iOS station adapter', () => {
  it('initializes App Check once before constructing either station, without requesting a reply', async () => {
    const { createConversation } = await import('../../src/lib/conversationAi')
    const [first] = await Promise.all([createConversation({ callsign: 'K1ABC' }), createConversation({ callsign: 'N2XYZ' })])
    expect(mocks.initialize).toHaveBeenCalledOnce()
    expect(mocks.initialize).toHaveBeenCalledWith(mocks.app, expect.objectContaining({
      provider: { providerOptions: { apple: expect.objectContaining({ provider: 'debug' }) } }, isTokenAutoRefreshEnabled: true,
    }))
    expect(mocks.getAI).toHaveBeenCalledWith(mocks.app, expect.objectContaining({ appCheck: expect.objectContaining({ getToken: expect.any(Function) }) }))
    expect(mocks.initialize.mock.invocationCallOrder[0]).toBeLessThan(mocks.getAI.mock.invocationCallOrder[0])
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.model).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      model: 'gemini-3.5-flash-lite', systemInstruction: expect.stringContaining('Your callsign for this QSO is K1ABC'),
    }))
    await expect(first.send('R')).resolves.toBe('UR RST 5NN K')
  })

  it('routes the AI SDK token getter through the modular API, including forced refresh and failures', async () => {
    const { createConversation } = await import('../../src/lib/conversationAi')
    await createConversation({ callsign: 'K1ABC' })
    const { appCheck } = mocks.getAI.mock.calls[0][1]
    await expect(appCheck.getToken()).resolves.toEqual({ token: 'test-app-check-token' })
    expect(mocks.getToken).toHaveBeenLastCalledWith(mocks.appCheck, undefined)
    await appCheck.getToken(true)
    expect(mocks.getToken).toHaveBeenLastCalledWith(mocks.appCheck, true)
    const error = new Error('App attestation failed')
    mocks.getToken.mockRejectedValueOnce(error)
    await expect(appCheck.getToken()).rejects.toBe(error)
  })

  it('uses a configured debug token in development', async () => {
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN', 'test-debug-token')
    const { createConversation } = await import('../../src/lib/conversationAi')
    await createConversation({ callsign: 'K1ABC' })
    expect(mocks.initialize).toHaveBeenCalledWith(mocks.app, expect.objectContaining({
      provider: { providerOptions: { apple: { provider: 'debug', debugToken: 'test-debug-token' } } },
    }))
  })

  it('uses device attestation in a release build', async () => {
    vi.stubGlobal('__DEV__', false)
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN', 'test-debug-token')
    const { createConversation } = await import('../../src/lib/conversationAi')
    await createConversation({ callsign: 'K1ABC' })
    expect(mocks.initialize).toHaveBeenCalledWith(mocks.app, expect.objectContaining({
      provider: { providerOptions: { apple: { provider: 'appAttestWithDeviceCheckFallback' } } },
    }))
  })

  it('lets initialization retry after failure and surfaces empty station replies', async () => {
    mocks.initialize.mockRejectedValueOnce(new Error('Unavailable'))
    const { createConversation } = await import('../../src/lib/conversationAi')
    await expect(createConversation({ callsign: 'K1ABC' })).rejects.toThrow('Could not start the QSO')
    const chat = await createConversation({ callsign: 'K1ABC' })
    mocks.send.mockResolvedValueOnce({ response: { text: () => ' ' } })
    await expect(chat.send('CQ')).rejects.toThrow('Empty response')
  })
  it('retries a failed SDK request with only the previously accepted conversation history', async () => {
    const sdk = await vi.importActual<typeof import('@firebase/ai')>('@firebase/ai')
    const firebase = await vi.importActual<typeof import('@firebase/app')>('@firebase/app')
    const app = firebase.initializeApp({ apiKey: 'test-key', projectId: 'test-project', appId: 'test-ios-app' }, 'qso-retry-test')
    const ai = sdk.getAI(app, { backend: new sdk.GoogleAIBackend() })
    mocks.model.mockImplementation((_, options) => sdk.getGenerativeModel(ai, options))
    const response = (text: string) => new Response(JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [{ text }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    const fetch = vi.fn()
      .mockResolvedValueOnce(response('DE K1ABC K'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Temporary outage' } }), { status: 503 }))
      .mockResolvedValueOnce(response('R NAME PAT K'))
    vi.stubGlobal('fetch', fetch)
    try {
      const { createConversation } = await import('../../src/lib/conversationAi')
      const chat = await createConversation({ callsign: 'K1ABC' })
      await expect(chat.send('CQ')).resolves.toBe('DE K1ABC K')
      await expect(chat.send('NAME TYLER')).rejects.toThrow('Could not reach the other station')
      await expect(chat.send('NAME TYLER')).resolves.toBe('R NAME PAT K')
      expect(fetch).toHaveBeenCalledTimes(3)
      const request = JSON.parse(fetch.mock.calls[2][1].body)
      expect(request.contents).toEqual([
        { role: 'user', parts: [{ text: 'CQ' }] },
        { role: 'model', parts: [{ text: 'DE K1ABC K' }] },
        { role: 'user', parts: [{ text: 'NAME TYLER' }] },
      ])
    } finally {
      await firebase.deleteApp(app)
    }
  })

})
