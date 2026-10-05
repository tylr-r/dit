import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { firebaseApp } from '../firebase'

import { buildConversationSystemPrompt, createRetryableConversationChat, CONVERSATION_MODEL_ID, type ConversationChat, type StartConversationOptions } from '@dit/core'

export { ConversationAiError, type StartConversationOptions } from '@dit/core'

let ai: ReturnType<typeof getAI> | null = null

const getAi = () => {
  if (!ai) {
    ai = getAI(firebaseApp, { backend: new GoogleAIBackend() })
  }
  return ai
}

export const startConversation = (options: StartConversationOptions): ConversationChat => {
  const model = getGenerativeModel(getAi(), {
    model: CONVERSATION_MODEL_ID,
    systemInstruction: buildConversationSystemPrompt(options),
  })
  return createRetryableConversationChat(
    model.startChat({ history: [] }),
    (history) => model.startChat({ history }),
    'Could not reach the other station',
  )
}

export const sendTurn = (chat: ConversationChat, replyText: string): Promise<string> =>
  chat.send(replyText)
