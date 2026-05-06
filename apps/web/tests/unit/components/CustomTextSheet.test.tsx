import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CustomTextSheet } from '../../../src/components/CustomTextSheet'

describe('CustomTextSheet', () => {
  it('renders the saved text in the textarea on open', () => {
    render(
      <CustomTextSheet
        initialText="HI"
        initialTypeAlong={true}
        characterWpm={20}
        effectiveWpm={20}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )
    expect(screen.getByRole('textbox')).toHaveValue('HI')
  })

  it('reports ignored chars and length in the meta line', async () => {
    const user = userEvent.setup()
    render(
      <CustomTextSheet
        initialText=""
        initialTypeAlong={true}
        characterWpm={20}
        effectiveWpm={20}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )
    await user.type(screen.getByRole('textbox'), 'hi!')
    expect(screen.getByText(/Ignored: 1/)).toBeInTheDocument()
  })

  it('calls onSave with the typed text and toggle state', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CustomTextSheet
        initialText=""
        initialTypeAlong={true}
        characterWpm={20}
        effectiveWpm={20}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )
    await user.type(screen.getByRole('textbox'), 'hello')
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith({ text: 'hello', typeAlong: true })
  })

  it('toggles the Type along switch on click', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CustomTextSheet
        initialText=""
        initialTypeAlong={true}
        characterWpm={20}
        effectiveWpm={20}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )
    await user.click(screen.getByRole('switch'))
    await user.type(screen.getByRole('textbox'), 'a')
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith({ text: 'a', typeAlong: false })
  })

  it('closes via Discard without invoking onSave', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSave = vi.fn()
    render(
      <CustomTextSheet
        initialText="HI"
        initialTypeAlong={true}
        characterWpm={20}
        effectiveWpm={20}
        onClose={onClose}
        onSave={onSave}
      />,
    )
    await user.click(screen.getByRole('button', { name: /discard/i }))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
