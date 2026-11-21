import test from 'node:test'
import assert from 'node:assert/strict'
import { MORSE_DATA } from '../../../packages/core/src/data/morse.ts'
import { decode, replayPlan } from '../modules/web/session.mjs'

test('every shipped Morse letter and digit decodes and replays its exact symbol lengths', () => {
  for (const [letter, {code}] of Object.entries(MORSE_DATA)) {
    assert.equal(decode(code), letter)
    for (const unit of [40,100,120]) {
      const plan = replayPlan(letter,unit)
      assert.equal(plan.length,code.length)
      for (let i=0;i<code.length;i++) {
        assert.equal(plan[i][1]-plan[i][0],(code[i]==='.'?1:3)*unit)
        if(i)assert.equal(plan[i][0]-plan[i-1][1],unit)
      }
    }
  }
})
