import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAIMock, getGenerativeModelMock, startChatMock } = vi.hoisted(() => ({
  getAIMock: vi.fn(),
  getGenerativeModelMock: vi.fn(),
  startChatMock: vi.fn(),
}))

vi.mock('firebase/ai', () => ({
  getAI: getAIMock,
  getGenerativeModel: getGenerativeModelMock,
  GoogleAIBackend: class GoogleAIBackend {},
}))

vi.mock('../../../src/firebase', () => ({
  firebaseApp: {},
}))

import { sendTurn, startConversation } from '../../../src/lib/conversationAi'

beforeEach(() => {
  getAIMock.mockReset().mockReturnValue({})
  getGenerativeModelMock.mockReset().mockReturnValue({ startChat: startChatMock })
  startChatMock.mockReset().mockReturnValue({})
})

describe('startConversation', () => {
  it('learns the other operator identity only from keyed replies', () => {
    startConversation({ callsign: 'K1ABC' })

    expect(getGenerativeModelMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        model: 'gemini-3.5-flash-lite',
        systemInstruction: expect.stringMatching(
          /Your callsign for this QSO is K1ABC.*Learn the other operator’s name and callsign only from what they send/,
        ),
      }),
    )
    expect(startChatMock).toHaveBeenCalledWith({ history: [] })
  })

  it('instructs the station to answer a CQ with only the callsign exchange', () => {
    startConversation({ callsign: 'K7JWA' })

    expect(getGenerativeModelMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        systemInstruction: expect.stringMatching(
          /When the other operator calls CQ.*answer only with their callsign, DE, your callsign, and K.*Do not include RST, name, QTH, or conversation in that reply/s,
        ),
      }),
    )
  })

  it.each([
    [8, 'GM'],
    [13, 'GA'],
    [19, 'GE'],
    [23, 'GN'],
  ])('supplies the local greeting for hour %i', (localHour, greeting) => {
    startConversation({ callsign: 'K7JWA', localHour })

    expect(getGenerativeModelMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        systemInstruction: expect.stringContaining(
          `The learner's current local greeting is ${greeting}.`,
        ),
      }),
    )
  })

  it('normalizes a 599 report to CW cut numbers', async () => {
    const chat = {
      sendMessage: vi.fn().mockResolvedValue({
        response: { text: () => 'UR RST 599 599' },
      }),
    }

    await expect(sendTurn(chat as never, 'R')).resolves.toBe('UR RST 5NN 5NN')
  })
})
