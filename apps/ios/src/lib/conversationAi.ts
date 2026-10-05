import {
  buildConversationSystemPrompt,
  CONVERSATION_MODEL_ID,
  ConversationAiError,
  type ConversationChat,
  type StartConversationOptions,
} from '@dit/core'
import { getAI, getGenerativeModel, GoogleAIBackend } from '@react-native-firebase/ai'
import { getApp } from '@react-native-firebase/app'
import { initializeAppCheck, type AppCheckOptions } from '@react-native-firebase/app-check'

let appCheckPromise: ReturnType<typeof initializeAppCheck> | null = null

const ensureAppCheck = () => {
  if (!appCheckPromise) {
    const provider: AppCheckOptions['provider'] = { providerOptions: { apple: {
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      ...(__DEV__ && process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN
        ? { debugToken: process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN } : {}),
    } } }
    appCheckPromise = initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true })
      .catch((error) => { appCheckPromise = null; throw error })
  }
  return appCheckPromise
}

/** Starts a private, unscored QSO using the same station rules as web. */
export async function createConversation(options: StartConversationOptions): Promise<ConversationChat> {
  try {
    const appCheck = await ensureAppCheck()
    const ai = getAI(getApp(), { backend: new GoogleAIBackend(), appCheck })
    const chat = getGenerativeModel(ai, {
      model: CONVERSATION_MODEL_ID,
      systemInstruction: buildConversationSystemPrompt(options),
    }).startChat({ history: [] })
    return { send: async (text) => {
      try {
        const result = await chat.sendMessage(text)
        const reply = result.response.text().trim().replace(/\b599\b/g, '5NN')
        if (!reply) throw new ConversationAiError('Empty response from the other station')
        return reply
      } catch (error) {
        if (error instanceof ConversationAiError) throw error
        throw new ConversationAiError('Could not reach the other station. Try again.', error)
      }
    } }
  } catch (error) {
    throw new ConversationAiError('Could not start the QSO. Try again.', error)
  }
}
