import { useState } from 'react'
import { useScreenTracker } from '../lib/analytics'
import type { SignInSheetProps } from './componentProps'

type View = 'picker' | 'email'
type Mode = 'sign-in' | 'create'

const AppleIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M17.05 12.04c.03-2.6 2.13-3.85 2.22-3.91-1.21-1.78-3.1-2.02-3.77-2.05-1.6-.16-3.13.95-3.94.95-.83 0-2.07-.93-3.41-.91-1.75.03-3.37 1.02-4.27 2.59-1.83 3.18-.46 7.86 1.31 10.43.86 1.26 1.89 2.67 3.24 2.62 1.31-.05 1.8-.85 3.38-.85 1.57 0 2.02.85 3.4.82 1.4-.02 2.29-1.28 3.15-2.55.99-1.46 1.4-2.88 1.43-2.96-.03-.01-2.74-1.05-2.77-4.18zM14.46 4.34c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.27.68-3 1.54-.65.76-1.23 1.99-1.08 3.16 1.14.09 2.31-.59 3.02-1.45z" />
  </svg>
)

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"
      fill="#4285f4"
    />
    <path
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      fill="#34a853"
    />
    <path
      d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"
      fill="#fbbc05"
    />
    <path
      d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.97 7.3C4.68 5.16 6.66 3.58 9 3.58z"
      fill="#ea4335"
    />
  </svg>
)

const EmailIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
)

/** Bottom-sheet sign-in: Apple/Google/Email providers + email form swap-in. */
export function SignInSheet({
  onClose,
  onSignInWithApple,
  onSignInWithGoogle,
  onSignInWithEmail,
  onCreateAccountWithEmail,
}: SignInSheetProps) {
  useScreenTracker('sign_in')

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
    try {
      const result = await fn(email, password)
      if (result.ok) {
        handleClose()
        return
      }
      setError(result.error)
    } finally {
      setSubmitting(false)
    }
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
                  <AppleIcon />
                  <span>Continue with Apple</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="sign-in-provider"
                  disabled={submitting}
                  onClick={() => void handleProvider('Google', onSignInWithGoogle)}
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="sign-in-provider"
                  disabled={submitting}
                  onClick={() => {
                    setError(null)
                    setView('email')
                  }}
                >
                  <EmailIcon />
                  <span>Continue with Email</span>
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
