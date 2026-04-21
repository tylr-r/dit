import type { User } from '@firebase/auth'
import { Alert } from 'react-native'
import { useCallback } from 'react'
import {
  deleteCurrentUserAccount,
  prepareCurrentUserAccountDeletion,
  signInWithApple,
  signInWithGoogle,
} from '../services/auth'
import {
  getDeleteAccountErrorMessage,
  getSignInErrorMessage,
  isErrorWithCode,
} from '@dit/core'

type UseAccountActionsOptions = {
  user: User | null
  isDeletingAccount: boolean
  setIsDeletingAccount: (value: boolean) => void
  setShowSettings: (value: boolean) => void
  clearLocalProgress: () => Promise<void>
  deleteRemoteProgress: (userId: string) => Promise<void>
  resetProgressState: () => void
}

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
  const handleSignInWithApple = useCallback(async () => {
    try {
      await signInWithApple()
    } catch (error) {
      if (isErrorWithCode(error, 'ERR_APPLE_SIGN_IN_CANCELLED')) {
        return
      }

      console.error('Failed to sign in with Apple', error)
      Alert.alert('Could Not Sign In', getSignInErrorMessage(error))
    }
  }, [])

  const handleSignInWithGoogle = useCallback(async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Failed to sign in with Google', error)
      Alert.alert('Could Not Sign In', getSignInErrorMessage(error))
    }
  }, [])

  const performAccountDeletion = useCallback(
    async (currentUser: User) => {
      if (isDeletingAccount) {
        return
      }

      setIsDeletingAccount(true)
      let accountDeleted = false

      try {
        setShowSettings(false)
        await prepareCurrentUserAccountDeletion(currentUser)
        await deleteRemoteProgress(currentUser.uid)
        await deleteCurrentUserAccount(currentUser)
        accountDeleted = true
        await clearLocalProgress()
        resetProgressState()
      } catch (error) {
        if (isErrorWithCode(error, 'ERR_APPLE_ACCOUNT_DELETION_CANCELLED')) {
          return
        }

        if (accountDeleted) {
          resetProgressState()
          Alert.alert(
            'Account Deleted',
            'Your account was deleted, but local cleanup did not finish cleanly. Relaunch the app if any old progress remains.',
          )
          return
        }

        Alert.alert('Could Not Delete Account', getDeleteAccountErrorMessage(error))
      } finally {
        setIsDeletingAccount(false)
      }
    },
    [
      clearLocalProgress,
      deleteRemoteProgress,
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

    Alert.alert(
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
  }, [isDeletingAccount, performAccountDeletion, user])

  return {
    handleSignInWithApple,
    handleSignInWithGoogle,
    handleDeleteAccount,
  }
}
