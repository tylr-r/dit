import {computeReferenceScoreMedian,computeReferenceScoreMaxDeviation,getReferenceRelativeScoreTint} from '../../../packages/core/src/utils/referenceTint.ts'
import {buildReference,buildRecognition,referencePattern} from '../modules/web/reference.mjs'

/** Compact, local presentation data for the three native Reference sections. */
export function projectReferenceCards(state, project) {
  const groups=buildReference(state)
  const recognition=new Map(buildRecognition(state).bars.map(entry=>[entry.letter,entry]))
  const scores=groups.mastered.map(letter=>state.scores[letter])
  const median=computeReferenceScoreMedian(scores)
  const deviation=computeReferenceScoreMaxDeviation(scores,median)
  for (const [kind,letters] of [['mastered',groups.mastered],['learning',groups.learning],['not-yet',groups.noEvidence]]) {
    const records=letters.map(letter=>{
      const mastered=kind==='mastered'
      const score=state.scores[letter] ?? 0
      const code=mastered ? referencePattern(letter) : ''
      const sample=recognition.get(letter)
      const label=[letter,kind]
      if (mastered) label.push([...code].map(symbol=>symbol==='.'?'dit':'dah').join(' '),'score plus '+score)
      if (sample) label.push('recognition '+Math.round(sample.averageMs)+' milliseconds')
      const tint=mastered ? getReferenceRelativeScoreTint(score,median,deviation) : null
      const border=tint ? 'rgba('+[tint.red,tint.green,tint.blue,tint.alpha].join(',')+')' : 'rgba(255,255,255,0.12)'
      return [letter,mastered?'+'+score:'',code.replaceAll('.','•').replaceAll('-','—'),
        sample && kind!=='not-yet' ? sample.fill+'%' : '',label.join(', '),border].join('|')
    })
    project('ref-cards-'+kind+':'+records.join(';'))
  }
}
