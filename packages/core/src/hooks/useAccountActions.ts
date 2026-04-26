import { deleteUser, type User } from '@firebase/auth'
import { useCallback } from 'react'
import {
  getDeleteAccountErrorMessage,
  getEmailSignInErrorMessage,
  getEmailSignUpErrorMessage,
  getSignInErrorMessage,
  isErrorWithCode,
} from '../utils/appState'
import { usePlatform } from '../platform'

export type EmailAuthResult = { ok: true } | { ok: false; error: string }

type UseAccountActionsOptions = {
  user: User | null
  isDeletingAccount: boolean
  setIsDeletingAccount: (value: boolean) => void
  setShowSettings: (value: boolean) => void
  clearLocalProgress: () => Promise<void>
  deleteRemoteProgress: (userId: string) => Promise<void>
  resetProgressState: () => void
}

/** Returns whether this Firebase User is authenticated through Apple. */
export const isAppleUser = (user: User): boolean =>
  user.providerData.some((provider) => provider.providerId === 'apple.com')

/** Builds authentication and account lifecycle handlers for the app shell. */
export const useAccountActions = ({
  user,
  isDeletingAccount,
  setIsDeletingAccount,
  setShowSettings,
  clearLocalProgress,
  deleteRemoteProgress,
  resetProgressState,
}: UseAccountActionsOptions) => {
  const platform = usePlatform()
  const { auth, dialog } = platform

  const handleSignInWithApple = useCallback(async () => {
    if (!auth.signInWithApple) {
      dialog.alert(
        'Apple sign-in unavailable',
        'This platform does not support Apple sign-in.',
      )
      return
    }

    try {
      await auth.signInWithApple()
    } catch (error) {
      if (isErrorWithCode(error, 'ERR_APPLE_SIGN_IN_CANCELLED')) {
        return
      }

      console.error('Failed to sign in with Apple', error)
      dialog.alert('Could Not Sign In', getSignInErrorMessage(error))
    }
  }, [auth, dialog])

  const handleSignInWithGoogle = useCallback(async () => {
    try {
      await auth.signInWithGoogle()
    } catch (error) {
      console.error('Failed to sign in with Google', error)
      dialog.alert('Could Not Sign In', getSignInErrorMessage(error))
    }
  }, [auth, dialog])

  // Email handlers return an EmailAuthResult rather than using dialog.alert so
  // the form can show errors inline under the input (better UX than a popup).
  const handleSignInWithEmail = useCallback(
    async (email: string, password: string): Promise<EmailAuthResult> => {
      if (!auth.signInWithEmail) {
        return {
          ok: false,
          error: 'Email sign-in is not available on this platform.',
        }
      }
      try {
        await auth.signInWithEmail(email, password)
        return { ok: true }
      } catch (error) {
        console.error('Failed to sign in with email', error)
        return { ok: false, error: getEmailSignInErrorMessage(error) }
      }
    },
    [auth],
  )

  const handleCreateAccountWithEmail = useCallback(
    async (email: string, password: string): Promise<EmailAuthResult> => {
      if (!auth.createAccountWithEmail) {
        return {
          ok: false,
          error: 'Account creation is not available on this platform.',
        }
      }
      try {
        await auth.createAccountWithEmail(email, password)
        return { ok: true }
      } catch (error) {
        console.error('Failed to create account with email', error)
        return { ok: false, error: getEmailSignUpErrorMessage(error) }
      }
    },
    [auth],
  )

  const performAccountDeletion = useCallback(
    async (currentUser: User) => {
      if (isDeletingAccount) {
        return
      }

      setIsDeletingAccount(true)
      let accountDeleted = false

      try {
        setShowSettings(false)
        await auth.prepareAccountDeletion(currentUser.uid, isAppleUser(currentUser))
        await deleteRemoteProgress(currentUser.uid)
        await deleteUser(currentUser)
        accountDeleted = true
        await clearLocalProgress()
        resetProgressState()
      } catch (error) {
        if (isErrorWithCode(error, 'ERR_APPLE_ACCOUNT_DELETION_CANCELLED')) {
          return
        }

        if (accountDeleted) {
          resetProgressState()
          dialog.alert(
            'Account Deleted',
            'Your account was deleted, but local cleanup did not finish cleanly. Relaunch the app if any old progress remains.',
          )
          return
        }

        dialog.alert('Could Not Delete Account', getDeleteAccountErrorMessage(error))
      } finally {
        setIsDeletingAccount(false)
      }
    },
    [
      auth,
      clearLocalProgress,
      deleteRemoteProgress,
      dialog,
      isDeletingAccount,
      resetProgressState,
      setIsDeletingAccount,
      setShowSettings,
    ],
  )

  const handleDeleteAccount = useCallback(() => {
    if (!user || isDeletingAccount) {
      return
    }

    dialog.confirm(
      'Delete account?',
      'This permanently deletes your Dit account, synced progress, and local progress on this device.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            void performAccountDeletion(user)
          },
        },
      ],
    )
  }, [dialog, isDeletingAccount, performAccountDeletion, user])

  return {
    handleSignInWithApple,
    handleSignInWithGoogle,
    handleSignInWithEmail,
    handleCreateAccountWithEmail,
    handleDeleteAccount,
  }
}
