import { useConversationSession as useSharedConversationSession, type UseConversationSessionOptions as SharedOptions } from '@dit/core'
import { startConversation, sendTurn } from '../lib/conversationAi'

export type { ConversationPhase, ConversationTurn, ConversationStartDirection, UseConversationSessionResult } from '@dit/core'
export type UseConversationSessionOptions = Omit<SharedOptions, 'createConversation'>

/** Uses the shared QSO learning session with the browser Firebase adapter. */
export const useConversationSession = (options: UseConversationSessionOptions) =>
  useSharedConversationSession({ ...options, createConversation: (config) => {
    const chat = startConversation(config)
    return { send: (text) => sendTurn(chat, text) }
  } })
