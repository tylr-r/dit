import { getAI, getGenerativeModel, GoogleAIBackend, type ChatSession } from 'firebase/ai'
import { firebaseApp } from '../firebase'

import { buildConversationSystemPrompt, CONVERSATION_MODEL_ID, ConversationAiError, type StartConversationOptions } from '@dit/core'

export { ConversationAiError, type StartConversationOptions } from '@dit/core'

let ai: ReturnType<typeof getAI> | null = null

const getAi = () => {
  if (!ai) {
    ai = getAI(firebaseApp, { backend: new GoogleAIBackend() })
  }
  return ai
}

export const startConversation = (options: StartConversationOptions): ChatSession => {
  const model = getGenerativeModel(getAi(), {
    model: CONVERSATION_MODEL_ID,
    systemInstruction: buildConversationSystemPrompt(options),
  })
  return model.startChat({
    history: [],
  })
}

export const sendTurn = async (chat: ChatSession, replyText: string): Promise<string> => {
  try {
    const result = await chat.sendMessage(replyText)
    const text = result.response.text().trim().replace(/\b599\b/g, '5NN')
    if (!text) {
      throw new ConversationAiError('Empty response from the other station')
    }
    return text
  } catch (error) {
    if (error instanceof ConversationAiError) {
      throw error
    }
    throw new ConversationAiError('Could not reach the other station', error)
  }
}
