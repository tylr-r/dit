declare module 'react-test-renderer' {
  import type { ReactElement } from 'react'

  export type ReactTestRenderer = {
    update(element: ReactElement): void
  }

  export function act(callback: () => void | Promise<void>): Promise<void>
  export function create(element: ReactElement): ReactTestRenderer
}
