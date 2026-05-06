export type DiffTokenKind = 'ok' | 'miss' | 'extra' | 'gap'

export type DiffToken = {
  kind: DiffTokenKind
  /**
   * For 'ok' / 'miss' / 'extra' this is the matched/source/typed substring.
   * For 'gap' this is a run of `·` glyphs sized to the missing run length.
   */
  text: string
}

export type DiffResult = {
  tokens: DiffToken[]
  matched: number
  missed: number
  extra: number
  /** Length of the source (for `matched / total` summaries). */
  total: number
}

type Op =
  | { kind: 'eq'; ch: string }
  | { kind: 'src'; ch: string }
  | { kind: 'tgt'; ch: string }

/**
 * LCS-aligned character diff between a Morse-source passage and the user's
 * typed copy. Adjacent source-only and user-only ops form a substitution; a
 * trailing source-only run with no user chars after it renders as a gap.
 *
 * Uses a suffix-LCS DP table with a forward greedy traversal so matches are
 * anchored to the earliest (leftmost) position in the source.
 */
export const customListenDiff = (source: string, typed: string): DiffResult => {
  const m = source.length
  const n = typed.length

  if (m === 0 && n === 0) {
    return { tokens: [], matched: 0, missed: 0, extra: 0, total: 0 }
  }
  if (m === 0) {
    return {
      tokens: [{ kind: 'extra', text: typed }],
      matched: 0,
      missed: 0,
      extra: n,
      total: 0,
    }
  }
  if (n === 0) {
    return {
      tokens: [{ kind: 'gap', text: '·'.repeat(m) }],
      matched: 0,
      missed: m,
      extra: 0,
      total: m,
    }
  }

  // Build SUFFIX dp: dp[i][j] = LCS of source[i..m) and typed[j..n)
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  )
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (source[i] === typed[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  // Forward traverse, taking eq greedily — matches anchor to earliest position.
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (source[i] === typed[j]) {
      ops.push({ kind: 'eq', ch: source[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: 'src', ch: source[i] })
      i += 1
    } else {
      ops.push({ kind: 'tgt', ch: typed[j] })
      j += 1
    }
  }
  while (i < m) {
    ops.push({ kind: 'src', ch: source[i] })
    i += 1
  }
  while (j < n) {
    ops.push({ kind: 'tgt', ch: typed[j] })
    j += 1
  }

  const tokens: DiffToken[] = []
  let matched = 0
  let missed = 0
  let extra = 0

  let k = 0
  while (k < ops.length) {
    const op = ops[k]
    if (op.kind === 'eq') {
      let run = ''
      while (k < ops.length && ops[k].kind === 'eq') {
        run += (ops[k] as { ch: string }).ch
        matched += 1
        k += 1
      }
      tokens.push({ kind: 'ok', text: run })
      continue
    }
    if (op.kind === 'src') {
      const start = k
      let run = ''
      while (k < ops.length && ops[k].kind === 'src') {
        run += (ops[k] as { ch: string }).ch
        missed += 1
        k += 1
      }
      // A src run is a gap when the user stopped typing: no more typed ops
      // (tgt or eq) remain, and this run isn't part of a substitution (i.e.
      // it was not immediately preceded by a tgt run).
      const remaining = ops.slice(k)
      const hasTgtAfter = remaining.some((o) => o.kind === 'tgt')
      const hasEqAfter = remaining.some((o) => o.kind === 'eq')
      const prevIsTgt = start > 0 && ops[start - 1].kind === 'tgt'
      const isGap = !hasTgtAfter && !hasEqAfter && !prevIsTgt
      tokens.push(
        isGap
          ? { kind: 'gap', text: '·'.repeat(run.length) }
          : { kind: 'miss', text: run },
      )
      continue
    }
    // tgt run
    let run = ''
    while (k < ops.length && ops[k].kind === 'tgt') {
      run += (ops[k] as { ch: string }).ch
      extra += 1
      k += 1
    }
    tokens.push({ kind: 'extra', text: run })
  }

  return {
    tokens,
    matched,
    missed,
    extra,
    total: m,
  }
}
