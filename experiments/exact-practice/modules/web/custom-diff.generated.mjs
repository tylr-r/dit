// ../../../dit/packages/core/src/utils/customListenDiff.ts
var customListenDiff = (source, typed) => {
  const m = source.length;
  const n = typed.length;
  if (m === 0 && n === 0) {
    return { tokens: [], matched: 0, missed: 0, extra: 0, total: 0 };
  }
  if (m === 0) {
    return {
      tokens: [{ kind: "extra", text: typed }],
      matched: 0,
      missed: 0,
      extra: n,
      total: 0
    };
  }
  if (n === 0) {
    return {
      tokens: [{ kind: "miss", text: source }],
      matched: 0,
      missed: m,
      extra: 0,
      total: m
    };
  }
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1;i >= 0; i -= 1) {
    for (let j = n - 1;j >= 0; j -= 1) {
      if (source[i] === typed[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (source[i] === typed[j]) {
      ops.push({ kind: "eq", ch: source[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "src", ch: source[i] });
      i += 1;
    } else {
      ops.push({ kind: "tgt", ch: typed[j] });
      j += 1;
    }
  }
  while (i < m) {
    ops.push({ kind: "src", ch: source[i] });
    i += 1;
  }
  while (j < n) {
    ops.push({ kind: "tgt", ch: typed[j] });
    j += 1;
  }
  const tokens = [];
  let matched = 0;
  let missed = 0;
  let extra = 0;
  let k = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (op.kind === "eq") {
      let run = "";
      while (k < ops.length && ops[k].kind === "eq") {
        run += ops[k].ch;
        matched += 1;
        k += 1;
      }
      tokens.push({ kind: "ok", text: run });
      continue;
    }
    if (op.kind === "src") {
      let run = "";
      while (k < ops.length && ops[k].kind === "src") {
        run += ops[k].ch;
        missed += 1;
        k += 1;
      }
      tokens.push({ kind: "miss", text: run });
      continue;
    }
    let run = "";
    while (k < ops.length && ops[k].kind === "tgt") {
      run += ops[k].ch;
      extra += 1;
      k += 1;
    }
    tokens.push({ kind: "extra", text: run });
  }
  return {
    tokens,
    matched,
    missed,
    extra,
    total: m
  };
};
export {
  customListenDiff
};
