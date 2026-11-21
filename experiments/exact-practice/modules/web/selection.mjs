// Selection follows shipped morseUtils.getLettersForLevel and web LearningSheet order.
import {MORSE_DATA} from './reference-morse.generated.mjs'
import {PRACTICE_POOL} from './progression.mjs'
const own=(value,key)=>Object.hasOwn(value,key)
export const SELECTABLE='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const tierSelection=level=>({kind:'tier',level})
export const tierPool=level=>Object.keys(MORSE_DATA).filter(char=>MORSE_DATA[char].level<=level).join('')
export const selectionPool=(selection,completed=false)=>selection?.kind==='custom'
  ? selection.letters.join('')
  : selection?.kind==='tier' ? tierPool(selection.level) : completed? tierPool(4):PRACTICE_POOL
export function normalizeSelection(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return null
  if(value.kind==='tier'&&Number.isInteger(value.level)&&value.level>=1&&value.level<=4)
    return tierSelection(value.level)
  if(value.kind==='custom'&&Array.isArray(value.letters)&&value.letters.length&&value.letters.length<=36
      &&new Set(value.letters).size===value.letters.length
      &&value.letters.every(ch=>typeof ch==='string'&&own(MORSE_DATA,ch)))
    return {kind:'custom',letters:[...value.letters]}
  return null
}
export function protectedSelection(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const keys=value.kind==='tier'?['kind','level']:value.kind==='custom'?['kind','letters']:null
  return keys ? Object.keys(value).some(key=>!keys.includes(key)) : typeof value.kind==='string'
}
export function scopeCommand(command){
  if(typeof command!=='string')return null
  if(/^scope-tier:[1-4]$/.test(command)) return tierSelection(Number(command.at(-1)))
  if(command.startsWith('scope-custom:')) return normalizeSelection({kind:'custom',letters:[...command.slice(13)]})
  return null
}
