import {
  buildConversationSystemPrompt,
  createRetryableConversationChat,
  CONVERSATION_MODEL_ID,
  ConversationAiError,
  type ConversationChat,
  type StartConversationOptions,
} from '@dit/core'
import { getAI, getGenerativeModel, GoogleAIBackend } from '@react-native-firebase/ai'
import { getApp } from '@react-native-firebase/app'
import { getToken, initializeAppCheck, type AppCheckOptions } from '@react-native-firebase/app-check'

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
    const ai = getAI(getApp(), {
      backend: new GoogleAIBackend(),
      // RNFB AI 24 calls the namespaced getter. Delegate to the modular API.
      appCheck: {
        ...appCheck,
        getToken: (forceRefresh) => getToken(appCheck, forceRefresh),
      },
    })
    const model = getGenerativeModel(ai, {
      model: CONVERSATION_MODEL_ID,
      systemInstruction: buildConversationSystemPrompt(options),
    })
    return createRetryableConversationChat(
      model.startChat({ history: [] }),
      (history) => model.startChat({ history }),
      'Could not reach the other station. Try again.',
    )
  } catch (error) {
    throw new ConversationAiError('Could not start the QSO. Try again.', error)
  }
}
