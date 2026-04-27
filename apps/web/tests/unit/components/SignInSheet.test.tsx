import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SignInSheet } from '../../../src/components/SignInSheet'
import type { SignInSheetProps } from '../../../src/components/componentProps'

const baseProps: SignInSheetProps = {
  onClose: vi.fn(),
  onSignInWithApple: vi.fn().mockResolvedValue(undefined),
  onSignInWithGoogle: vi.fn().mockResolvedValue(undefined),
  onSignInWithEmail: vi.fn().mockResolvedValue({ ok: true }),
  onCreateAccountWithEmail: vi.fn().mockResolvedValue({ ok: true }),
}

describe('SignInSheet', () => {
  it('renders the three provider buttons in picker view', () => {
    render(<SignInSheet {...baseProps} />)
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeInTheDocument()
  })

  it('calls Google sign-in and dismisses on success', async () => {
    const onSignInWithGoogle = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <SignInSheet
        {...baseProps}
        onSignInWithGoogle={onSignInWithGoogle}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    await waitFor(() => expect(onSignInWithGoogle).toHaveBeenCalled())
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows generic error when provider sign-in fails', async () => {
    const onSignInWithApple = vi.fn().mockRejectedValue(new Error('boom'))
    render(<SignInSheet {...baseProps} onSignInWithApple={onSignInWithApple} />)
    fireEvent.click(screen.getByRole('button', { name: /continue with apple/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/apple sign-in failed/i),
    )
  })

  it('swaps to email form when "Continue with Email" is clicked', () => {
    render(<SignInSheet {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }))
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
  })

  it('signs in with email on form submit', async () => {
    const onSignInWithEmail = vi.fn().mockResolvedValue({ ok: true })
    const onClose = vi.fn()
    render(
      <SignInSheet
        {...baseProps}
        onSignInWithEmail={onSignInWithEmail}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }))
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() =>
      expect(onSignInWithEmail).toHaveBeenCalledWith('a@b.com', 'hunter2'),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shows the collapsed error message on bad credentials', async () => {
    const onSignInWithEmail = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'Email or password is incorrect.' })
    render(<SignInSheet {...baseProps} onSignInWithEmail={onSignInWithEmail} />)
    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }))
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong1' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/email or password is incorrect/i),
    )
  })

  it('creates an account when "Create account" is clicked', async () => {
    const onCreateAccountWithEmail = vi.fn().mockResolvedValue({ ok: true })
    render(
      <SignInSheet
        {...baseProps}
        onCreateAccountWithEmail={onCreateAccountWithEmail}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }))
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'new@b.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() =>
      expect(onCreateAccountWithEmail).toHaveBeenCalledWith('new@b.com', 'hunter2'),
    )
  })

  it('back button returns to provider picker and clears error', async () => {
    const onSignInWithEmail = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'Email or password is incorrect.' })
    render(<SignInSheet {...baseProps} onSignInWithEmail={onSignInWithEmail} />)
    fireEvent.click(screen.getByRole('button', { name: /continue with email/i }))
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong1' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /back to providers/i }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: /continue with apple/i })).toBeInTheDocument()
  })

  it('Close fires onClose', () => {
    const onClose = vi.fn()
    render(<SignInSheet {...baseProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
