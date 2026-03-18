import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StageDisplay } from '../../../src/components/StageDisplay'

describe('StageDisplay', () => {
  it('renders practice word progress with active letter', () => {
    render(
      <StageDisplay
        freestyleDisplay=""
        hasFreestyleDisplay={false}
        hintVisible
        isFreestyle={false}
        isListen={false}
        letter="A"
        listenDisplay=""
        listenDisplayClass="letter"
        listenStatusText=""
        pips={<span data-testid="pips" />}
        practiceWord="CAT"
        practiceWordIndex={1}
        practiceWordMode
        practiceWpmText={null}
        statusText="Ready"
        target=".-"
      />,
    )

    const word = screen.getByLabelText('Word CAT')
    expect(within(word).getByText('C')).toHaveClass('word-letter', 'done')
    expect(within(word).getByText('A')).toHaveClass('word-letter', 'active')
    expect(screen.getByTestId('pips')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('renders freestyle placeholder when no display is available', () => {
    render(
      <StageDisplay
        freestyleDisplay="--"
        hasFreestyleDisplay={false}
        hintVisible={false}
        isFreestyle
        isListen={false}
        letter="B"
        listenDisplay=""
        listenDisplayClass="letter"
        listenStatusText=""
        pips={null}
        practiceWord=""
        practiceWordIndex={0}
        practiceWordMode={false}
        practiceWpmText={null}
        statusText=""
        target=""
      />,
    )

    const display = screen.getByText('--')
    expect(display).toHaveClass('letter', 'letter-placeholder')
  })
})
