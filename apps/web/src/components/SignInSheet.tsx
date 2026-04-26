import { useState } from 'react'
import type { SignInSheetProps } from './componentProps'

type View = 'picker' | 'email'
type Mode = 'sign-in' | 'create'

/** Bottom-sheet sign-in: Apple/Google/Email providers + email form swap-in. */
export function SignInSheet({
  onClose,
  onSignInWithApple,
  onSignInWithGoogle,
  onSignInWithEmail,
  onCreateAccountWithEmail,
}: SignInSheetProps) {
  const [view, setView] = useState<View>('picker')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setEmail('')
    setPassword('')
    setError(null)
    setSubmitting(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleProvider = async (
    label: string,
    fn: () => Promise<void>,
  ) => {
    setError(null)
    setSubmitting(true)
    try {
      await fn()
      handleClose()
    } catch {
      setError(`${label} sign-in failed. Try again.`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEmailSubmit = async (mode: Mode) => {
    setError(null)
    setSubmitting(true)
    const fn = mode === 'sign-in' ? onSignInWithEmail : onCreateAccountWithEmail
    const result = await fn(email, password)
    setSubmitting(false)
    if (result.ok) {
      handleClose()
      return
    }
    setError(result.error)
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal sign-in-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">
            {view === 'email' ? (
              <button
                type="button"
                className="sign-in-back"
                onClick={() => {
                  setError(null)
                  setView('picker')
                }}
                aria-label="Back to providers"
              >
                ‹
              </button>
            ) : null}
            Sign in
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="modal-close"
              onClick={handleClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="sign-in-body">
          {view === 'picker' ? (
            <ul className="sign-in-providers" role="list">
              <li>
                <button
                  type="button"
                  className="sign-in-provider"
                  disabled={submitting}
                  onClick={() => void handleProvider('Apple', onSignInWithApple)}
                >
                  Continue with Apple
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="sign-in-provider"
                  disabled={submitting}
                  onClick={() => void handleProvider('Google', onSignInWithGoogle)}
                >
                  Continue with Google
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="sign-in-provider"
                  onClick={() => {
                    setError(null)
                    setView('email')
                  }}
                >
                  Continue with Email
                </button>
              </li>
            </ul>
          ) : (
            <form
              className="sign-in-form"
              onSubmit={(event) => {
                event.preventDefault()
                void handleEmailSubmit('sign-in')
              }}
            >
              <label className="sign-in-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="sign-in-field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </label>
              {error ? (
                <div className="sign-in-error" role="alert">
                  {error}
                </div>
              ) : null}
              <button
                type="submit"
                className="panel-button sign-in-submit"
                disabled={submitting || !email || !password}
              >
                Sign in
              </button>
              <button
                type="button"
                className="sign-in-secondary"
                disabled={submitting || !email || !password}
                onClick={() => void handleEmailSubmit('create')}
              >
                Create account
              </button>
            </form>
          )}
          {view === 'picker' && error ? (
            <div className="sign-in-error" role="alert">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
