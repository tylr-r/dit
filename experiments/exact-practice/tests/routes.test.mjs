import assert from 'node:assert/strict'
import test from 'node:test'
import { setProps } from '../modules/web/index.js'

function fixture() {
  const seen=[]
  const h={
    mode:'conversation',routeBoundary:'7',externalBlocked:false,locked:false,guideLocked:false,
    qsoCopy:'',qsoToken:'0',wordsOn:false,customOn:false,
    clearInput:()=>seen.push('clear keys'),
    attempt:{cancel:()=>seen.push('cancel draft input'),configure:()=>{}},
    audio:{stop:()=>seen.push('silence'),warm:()=>seen.push('warm')},
    session:{dispatch:()=>{},current:()=>({settings:{speed:12,pitch:600}})},
    guide:{isListening:()=>false},
    qso:{
      canKey:()=>false,
      enter:()=>seen.push('enter fresh contact'),
      leave:()=>seen.push('discard contact'),
      copy:()=>seen.push('copy'),
      interrupt:()=>seen.push('interrupt'),
      confirm:()=>{seen.push('approve'); return true},
    },
  }
  const apply=(route,mode='conversation',override={})=>setProps(h,JSON.stringify({mode,'route-boundary':route,'qso-token':'0','qso-copy-value':'',...override}))
  return { seen, apply }
}
test('same active route does not reset the owned contact',()=>{
  const {seen,apply}=fixture()
  apply('7')
  assert.deepEqual(seen,[])
})
test('a same-mode replacement route resets one contact and cancels the prior input owner',()=>{
  const {seen,apply}=fixture()
  apply('8')
  assert.deepEqual(seen,['discard contact','clear keys','cancel draft input','silence','enter fresh contact'])
  seen.length=0
  apply('8')
  assert.deepEqual(seen,[])
})
test('leaving the QSO route cancels before transferring ownership and no new QSO starts',()=>{
  const {seen,apply}=fixture()
  apply('9','practice')
  assert.deepEqual(seen,['discard contact','clear keys','cancel draft input','silence'])
})


test('a pending prior-route Allow token is consumed without approving or warming the replacement route',()=>{
  const {seen,apply}=fixture()
  const late={'qso-token':'1','qso-command':'consent-allow'}
  apply('8','conversation',late)
  apply('8','conversation',late)
  assert.ok(!seen.includes('approve'))
  assert.ok(!seen.includes('warm'))
  assert.equal(seen.filter(event=>event==='enter fresh contact').length,1)
})
