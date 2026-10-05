import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ initialize: vi.fn(), getAI: vi.fn(), model: vi.fn(), send: vi.fn(), app: {}, appCheck: {} }))
vi.mock('@react-native-firebase/app', () => ({ getApp: () => mocks.app }))
vi.mock('@react-native-firebase/app-check', () => ({ initializeAppCheck: mocks.initialize }))
vi.mock('@react-native-firebase/ai', () => ({
  GoogleAIBackend: class {}, getAI: mocks.getAI, getGenerativeModel: mocks.model,
}))
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('__DEV__', true)
  mocks.getAI.mockReturnValue({})
  mocks.initialize.mockResolvedValue(mocks.appCheck)
  mocks.model.mockReturnValue({ startChat: () => ({ sendMessage: mocks.send }) })
  mocks.send.mockResolvedValue({ response: { text: () => 'UR RST 599 K' } })
})
afterEach(() => vi.unstubAllGlobals())

describe('iOS station adapter', () => {
  it('initializes App Check once before constructing either station, without requesting a reply', async () => {
    const { createConversation } = await import('../../src/lib/conversationAi')
    const [first] = await Promise.all([createConversation({ callsign: 'K1ABC' }), createConversation({ callsign: 'N2XYZ' })])
    expect(mocks.initialize).toHaveBeenCalledOnce()
    expect(mocks.initialize).toHaveBeenCalledWith(mocks.app, expect.objectContaining({
      provider: { providerOptions: { apple: expect.objectContaining({ provider: 'debug' }) } }, isTokenAutoRefreshEnabled: true,
    }))
    expect(mocks.getAI).toHaveBeenCalledWith(mocks.app, expect.objectContaining({ appCheck: mocks.appCheck }))
    expect(mocks.initialize.mock.invocationCallOrder[0]).toBeLessThan(mocks.getAI.mock.invocationCallOrder[0])
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.model).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      model: 'gemini-3.5-flash-lite', systemInstruction: expect.stringContaining('Your callsign for this QSO is K1ABC'),
    }))
    await expect(first.send('R')).resolves.toBe('UR RST 5NN K')
  })

  it('uses device attestation in a release build', async () => {
    vi.stubGlobal('__DEV__', false)
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
})
