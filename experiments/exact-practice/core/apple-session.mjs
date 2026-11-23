// Entry point for the bundled Apple JavaScriptCore context. The host owns input,
// the monotonic clock, audio and app-private files. No browser globals are used.
export { createProviderStationFactory, createSwiftStationFactory } from './provider-station.mjs'
export { convertLegacy, accountPayload } from './apple-legacy.mjs'
import {createAccountSession} from './apple-account.mjs'
export const createAccount = (host,initial) => createAccountSession(host,create,initial)
import { createSession, decode, playbackUnitMs, replayPlan } from '../modules/web/session.mjs'
import { loadPractice, normalizePractice, savePractice } from '../modules/web/practice-store.mjs'
import { createNux } from '../modules/web/nux.mjs'
import { createGuide, GUIDED_PACKS, guideReached, readGuide } from '../modules/web/guided.mjs'
import { tempoTiming } from '../modules/web/tempo.mjs'
import { createListen } from '../modules/web/listen.mjs'
import { pickWeighted, pickLatencyAware } from '../modules/web/progression.mjs'
import { referencePattern } from '../modules/web/reference.mjs'
import { MORSE_DATA } from '../modules/web/reference-morse.generated.mjs'
import { scopeCommand } from '../modules/web/selection.mjs'

import { createAppleListenPractice } from './apple-listen-practice.mjs'
import { createAppleConversation } from './apple-conversation.mjs'
import { projectReferenceCards } from './apple-reference.mjs'
import { createAppleCustom } from './apple-custom.mjs'
import { createAppleWords } from './apple-words.mjs'
import { createReminder, clockLabel, validTime } from './apple-reminder.mjs'

import {computeHero, dateKey, todayStreakContribution} from '../modules/web/reference-retention.generated.mjs'

const HAPTICS_KEY = 'dit.exact-spike.haptics.v1'
function readHaptics(storage) {
  try {
    const value = storage.getItem(HAPTICS_KEY)
    if (value === null || value === 'true' || value === 'false')
      return {enabled:value !== 'false', writable:true}
  } catch { /* An unreadable preference may represent an opt-out. */ }
  return {enabled:false,writable:false}
}

const METHOD_KEY = 'dit.exact-spike.method.v1'

// The Swift host supplies one directory for this isolated application.
export function create(host) {
  const storage = {
    getItem(key) {
      const [status, value] = host.read(key)
      if (status === 'missing') return null
      if (status !== 'ok') throw Error('storage unavailable')
      return value
    },
    setItem(key, value) {
      if (!host.write(key, value)) throw Error('storage unavailable')
    },
  }
  const pristine = snapshot => snapshot.status === 'empty' ||
    (snapshot.status === 'saved' && JSON.stringify(snapshot.data) === JSON.stringify(normalizePractice(null)))
  const initial = loadPractice(storage)
  // Older imports kept this setting in the immutable migration receipt.
  let inheritedAutoPlay = true
  try {
    const raw = storage.getItem('dit.exact-spike.legacy.v1')
    if (raw !== null) {
      const receipt = JSON.parse(raw)
      inheritedAutoPlay = receipt?.version === 1 && receipt.preserved?.practiceAutoPlay !== false
      if (receipt?.version === 1) {
        if (initial.data.settings.selection?.kind === 'custom' && initial.data.settings.maxLevel === undefined
            && [1,2,3,4].includes(receipt.preserved?.maxLevel)) initial.data.settings.maxLevel = receipt.preserved.maxLevel
        if (initial.data.settings.practiceWords === undefined && typeof receipt.preserved?.practiceWordMode === 'boolean')
          initial.data.settings.practiceWords = receipt.preserved.practiceWordMode
        if (initial.data.bestWpm === undefined && Number.isFinite(receipt.preserved?.bestWpm) && receipt.preserved.bestWpm >= 0)
          initial.data.bestWpm = receipt.preserved.bestWpm
        for (const key of ['showHint','showMnemonic']) {
          if (initial.data.settings[key] === undefined && typeof receipt.preserved?.[key] === 'boolean')
            initial.data.settings[key] = receipt.preserved[key]
        }
      }
    }
  } catch { inheritedAutoPlay = false }
  const savedGuide = readGuide(storage)
  const timers = new Map()
  let nextID = 0
  const clock = {
    setTimer(fn, delay) {
      const id = ++nextID
      timers.set(id, fn)
      host.schedule(id, delay)
      return id
    },
    clearTimer(id) {
      if (timers.delete(id)) host.cancelTimer(id)
    },
  }
  let guideTarget = ''
  let lastPrompt = ''
  const project = detail => {
    if (detail.startsWith('guide-target:')) guideTarget = detail.slice(13)
    host.project(detail)
  }
  let {enabled:hapticsEnabled,writable:hapticsSaved} = readHaptics(storage)
  function publishHaptics() {
    project('haptics-enabled:' + Number(hapticsEnabled))
    project('haptics-saved:' + Number(hapticsSaved))
  }
  function chooseHaptics(enabled) {
    hapticsEnabled = enabled
    try {
      if (!readHaptics(storage).writable) throw Error('protected')
      storage.setItem(HAPTICS_KEY, String(enabled))
      hapticsSaved = true
    } catch { hapticsSaved = false }
    publishHaptics()
  }
  let method = null
  try { method = storage.getItem(METHOD_KEY) } catch { /* Memory session still works. */ }
  function remember(value) {
    if (value === method || (method !== null && !['guided','open'].includes(method))) return
    try { storage.setItem(METHOD_KEY, value); method = value } catch { project('storage:unavailable') }
  }
  const hintKey = 'dit.exact-spike.intro-hint.v1'
  let hint = null
  try { hint = storage.getItem(hintKey) } catch { hint = 'unavailable' }
  const knownHint = () => ['morse','settings','done'].includes(hint)
  function advanceHint(next) {
    if (hint !== null && !knownHint()) return
    hint = next
    try { storage.setItem(hintKey,next) } catch { /* Keep the change for this session. */ }
    project('intro-hint:' + next)
  }
  let practiceStatus = initial.status
  let props = {}
  let ready = false
  let locked = false
  let guideLocked = false
  let status = 'checking'
  let replayed = false
  let interrupted = false
  let closed = false
  let lastWidget = ''
  function publishWidget(force = false) {
    if (!ready || closed) return
    const at = new Date(host.wallNow?.() ?? Date.now())
    const state = session.current()
    const hero = computeHero({...state, learnerProfile:nux.profile()})
    const {correct,goal} = todayStreakContribution(state,at)
    const value = JSON.stringify({
      known:hero.kind === 'wpm', mastered:hero.kind === 'mastered' ? hero.count : 0,
      bestWpm:state.bestWpm ?? 0, streak:state.streak?.current ?? 0,
      today:Math.min(correct,goal), goal, day:dateKey(at),
    })
    if (force || value !== lastWidget) {
      lastWidget = value
      project('widget-summary:' + value)
    }
  }
  const session = createSession({
    ...clock, project, monotonicNow:()=>host.monotonicMs?.() ?? NaN, data: initial.data, cleanInstall: pristine(initial),
    courseComplete: guideReached(savedGuide.data) === GUIDED_PACKS.length,
    onLock(value) { locked = value },
    onChange(state) {
      practiceStatus = savePractice(storage, state)
      if (ready) { reminder.sync(); publishWidget() }
      project('storage:' + practiceStatus)
    },
  })
  const reminder = createReminder({storage, host, project, progress:() => session.current()})
  const pick = (pool, previous) => pickWeighted(pool, session.current().scores, previous, Math.random())
  let nextPrompt = 0
  const play = (letter, scheduled) => {
    const {speed, effectiveSpeed, pitch} = session.current().settings
    const {unitMs, characterGapMs} = tempoTiming(speed, effectiveSpeed)
    const id = scheduled ? ++nextPrompt : 0
    const started = host.play(replayPlan(letter, unitMs), pitch, id)
    if (started && scheduled) {
      // The native reader is relative to the rendered final tone edge. The
      // shipped expected end includes one more Farnsworth character gap.
      scheduled(characterGapMs, () => host.promptTailMs?.(id))
    }
    return started
  }
  const listenPractice = createAppleListenPractice(session.current)
  const listen = createListen({
    ...clock, project, stop: () => host.stop(),
    play, getPool: () => props.mode === 'guided' ? guide.pool() : session.current().studyPool,
    pick: previous => props.mode === 'guided' ? guide.pickListen(previous) : listenPractice.pick(previous),
    isGuided: () => props.mode === 'guided',
    onRoundEnd: () => props.mode !== 'guided' || guide.finishListenRound(),
    record(letter, correct, sample) {
      if (props.mode === 'guided') guide.recordListen(letter, correct, sample)
      else {
        const before = session.current().listenTtr
        session.dispatch({type:'listenScore',letter,correct,sample})
        const after = session.current().listenTtr
        if (!correct && before !== after) listenPractice.miss(letter,after[letter].averageMs)
      }
    },
  })
  const guide = createGuide({
    ...clock, storage, project, decode, play, pick, cancelInput,
    pickListenWeighted(pool, previous) {
      const {scores, listenTtr} = session.current()
      return pickLatencyAware(pool, scores, listenTtr, previous, Math.random())
    },
    startListen: () => listen.enter(), stopListen: () => listen.exit(),
    score: (letter, correct, mode, sample) => session.dispatch({type:'guidedScore', letter, correct, mode, sample}),
    lock(value) { guideLocked = value },
    completed(status) {
      remember('open')
      session.dispatch({type:'coursePool'})
      session.dispatch({type:'courseComplete'})
      project('guide-storage:' + status)
      project('guide-completed:celebrate')
    },
  })
  const nux = createNux({
    reminder:{enable:reminder.enable,cancel:reminder.cancel,validTime,reducedMotion:() => props['reduce-motion'] === 'true'},
    ...clock, storage, ownsFresh: true, persistInferred: true, play: () => play('E'), stop: () => host.stop(), warm: () => host.warm(),
    checkSound() {
      const audible = play('E')
      if (host.outputVolume() < 0.05) return 'low'
      return audible ? 'heard' : 'failed'
    },
    // Shipped useOnboardingState treats defaults-only saves as a first launch.
    // Experiment profile/status live together in the onboarding record.
    hasPriorProgress: () => method === 'guided'
      || Object.values(initial.data.scores).some(score => score > 0)
      || (method === null && savedGuide.status === 'saved'),
    project(detail) {
      if (detail.startsWith('nux-reminder-time:')) project('nux-reminder-label:' + clockLabel(detail.slice(18)))
      if (detail.startsWith('nux-status:')) {
        const previous = status
        status = detail.slice(11)
        if (status === 'completed' && previous === 'pending') advanceHint('done')
        if (hint === null) hint = status === 'completed' ? 'done' : 'morse'
        project('intro-hint:' + (knownHint() ? hint : 'done'))
      }
      if (detail === 'nux-enter:guided') {
        if (!replayed && pristine(loadPractice(storage)) && readGuide(storage).status === 'empty')
          session.dispatch({type:'freshBeginnerDefaults'})
        remember('guided')
      } else if (detail === 'nux-enter:practice') remember('open')
      project(detail)
    },
  })
  const contact = createAppleConversation({clock, host, project, current:session.current})
  const custom = createAppleCustom({storage, clock, host, project, current:session.current})
  const words = createAppleWords({storage, clock, host, project, current:session.current, nextPrompt:() => ++nextPrompt})
  const listenMode = p => p.mode === 'listen' ? words.content() : null
  const courseActive = () => !guide.completed() && (method === 'guided' || (method === null && savedGuide.status === 'saved'))
  const modal = p => p.blocked === 'true' || p.blocked === '1' || p.blocked === true
  function canKey() {
    if (!ready || closed || interrupted || modal(props) || locked || guideLocked) return false
    if (status === 'pending' && props.mode !== 'nux') return false
    return ['practice', 'freestyle'].includes(props.mode) || (props.mode === 'guided' && guide.canKey())
      || (props.mode === 'nux' && nux.canKey()) || (props.mode === 'conversation' && contact.canKey())
  }
  let inputSymbols = ''
  let previousHelpers = null
  function publishHelpers() {
    const {settings,target} = session.current()
    const letter = props.mode === 'guided' ? guideTarget : props.mode === 'practice' ? target : ''
    const pattern = MORSE_DATA[letter]
    const code = settings.showHint ? pattern?.code ?? '' : ''
    const mnemonic = settings.showMnemonic ? pattern?.mnemonic ?? '' : ''
    const hits = code && code.startsWith(inputSymbols) ? inputSymbols.length : 0
    const fields = [code,mnemonic,code.slice(0,hits)]
    for (const [i,key] of ['helper-code','helper-mnemonic','helper-hits'].entries())
      if (previousHelpers?.[i] !== fields[i]) project(key + ':' + fields[i])
    previousHelpers = fields
  }
  function cancelInput(reason = 'cancel') {
    inputSymbols = ''
    host.cancelInput()
    host.stop()
    session.dispatch({type:reason})
  }
  // Shipped practice plays the current character on entry and when the prompt or tempo changes.
  function playPrompt() {
    if (!canKey() || !['practice','guided'].includes(props.mode)) return
    if (!(session.current().settings.autoPlay ?? inheritedAutoPlay)) return
    const letter = props.mode === 'guided' ? guideTarget : session.current().target
    const {speed,effectiveSpeed,pitch} = session.current().settings
    const prompt = [props.mode,letter,speed,effectiveSpeed,pitch].join(':')
    if (!letter || lastPrompt === prompt) return
    lastPrompt = prompt
    play(letter)
  }
  return {
    bootstrap() {
      if (ready) return
      ready = true
      project('apple-session:ready')
      project('calendar-year:' + new Date().getFullYear())
      session.projectState()
      project('autoPlay:' + (session.current().settings.autoPlay ?? inheritedAutoPlay))
      project('storage:' + practiceStatus)
      guide.projectCatalog()
      if (guide.completed()) project('guide-completed:restored')
      else if (method === 'guided' || (method === null && savedGuide.status === 'saved'))
        project(savedGuide.data.phase === 'listen' ? 'nux-enter:practice' : 'nux-enter:guided')
      words.refresh(courseActive())
      publishHaptics()
      reminder.publish()
      reminder.sync()
      publishWidget()
      nux.project() // Status comes last, releasing the Contract launch gate.
    },
    setProps(next) {
      const prev = props
      const first = prev.mode === undefined
      const changed = key => !first && prev[key] !== next[key]
      const scope = first || changed('mode') || changed('route-boundary')
      const wasBlocked = modal(prev)
      const blocked = modal(next)
      const referenceOpen = next['reference-open'] === 'true'
      const wasReferenceOpen = prev['reference-open'] === 'true'
      props = next
      if (wasReferenceOpen && !referenceOpen) host.stop()
      if (prev['settings-open'] === 'true' && next['settings-open'] !== 'true') reminder.cancel()
      if (hint === 'settings' && changed('settings-open') && next['settings-open'] === 'true') advanceHint('done')
      if (scope) lastPrompt = ''
      if (scope || changed('cancel-token') || changed('clear-token') || (!wasBlocked && blocked)) cancelInput()
      if (scope && prev.mode === 'guided') guide.leave()
      if (scope && prev.mode === 'nux') nux.close()
      if (scope && prev.mode === 'conversation') contact.leave()
      const previousListen = listenMode(prev)
      session.dispatch({type:'mode', mode:next.mode})
      if (!ready) return
      if (referenceOpen && !wasReferenceOpen && blocked) projectReferenceCards(session.current(),project)
      if (referenceOpen && wasReferenceOpen && blocked && !scope && !interrupted
          && !changed('cancel-token') && changed('reference-token') && /^[A-Z0-9]$/.test(next['reference-char'])) {
        const letter = next['reference-char']
        play(letter)
        project('ref-pattern:' + referencePattern(letter))
      }
      if (scope && next.mode === 'guided') remember('guided')
      if (scope && courseActive() && (next.mode === 'practice' || next.mode === 'listen'))
        session.dispatch({type:'coursePool',letters:guide.pool()})
      let selectionChanged = false
      if (changed('pref-token')) {
        const command = next['pref-command']
        const selection = scopeCommand(command)
        if (command === 'reset-local-app') {
          if (!interrupted && blocked && prev['settings-open'] === 'true' && next['settings-open'] === 'true') {
            if (host.requestLocalReset) host.requestLocalReset()
            else project('local-reset:error')
          }
        } else if (command === 'reset-scores') {
          if (referenceOpen && wasReferenceOpen && blocked && !interrupted) {
            session.dispatch({type:'resetScores'})
            projectReferenceCards(session.current(),project)
          }
        } else if (command === 'haptics-on' || command === 'haptics-off') {
          const onTutorial = next.mode === 'nux' && !blocked && nux.canKey()
          if (!interrupted && (next['settings-open'] === 'true' || onTutorial)) chooseHaptics(command === 'haptics-on')
        } else if (command === 'recommended') {
          if (!interrupted && next['settings-open'] === 'true' && !courseActive()) {
            const previous = session.current()
            session.dispatch({type:'recommended',profile:nux.profile(),inheritedAutoPlay})
            if (previous !== session.current()) {
              selectionChanged = true
              inputSymbols = ''
              host.cancelInput()
              host.stop()
              lastPrompt = ''
            }
          }
        } else if (/^(sequential|ifr|review)-(on|off)$/.test(command)) {
          if (!interrupted && next['settings-open'] === 'true' && !courseActive()) {
            const [control,value] = command.split('-')
            session.dispatch({type:'practiceControl',control,enabled:value === 'on'})
          }
        } else if (command === 'practice-words-on' || command === 'practice-words-off') {
          if (!interrupted && next['settings-open'] === 'true' && !courseActive()) {
            cancelInput()
            session.dispatch({type:'preference',command})
          }
        } else if (['hint-on','hint-off','mnemonic-on','mnemonic-off'].includes(command)) {
          if (!interrupted && next['settings-open'] === 'true') session.dispatch({type:'preference',command})
        } else if (command === 'test-sound') {
          if (!interrupted && next['settings-open'] === 'true') play('A')
        } else if (command === 'autoplay-on' || command === 'autoplay-off') {
          if (!interrupted && next['settings-open'] === 'true') {
            lastPrompt = ''
            session.dispatch({type:'preference',command})
          }
        } else if (command?.startsWith('reminder-')) {
          if (next['settings-open'] === 'true' && !interrupted) reminder.settings(command)
        } else if (selection) {
          selectionChanged = true
          remember('open')
          cancelInput()
          const nextSelection = selection.kind === 'custom'
            ? {kind:'custom',letters:Object.keys(MORSE_DATA).filter(letter => selection.letters.includes(letter))}
            : selection
          session.dispatch({type:'selection',selection:nextSelection,rememberLevel:true})
        } else if (command === 'course-open') {
          remember('open')
          session.dispatch({type:'coursePool'})
          session.dispatch({type:'openPractice'})
        } else if (next.mode === 'guided' && /^course-pack:(?:[1-9]|1[0-4])$/.test(command)) {
          cancelInput()
          guide.selectPack(Number(command.slice(12)) - 1)
        } else if (!['toggle-strategy','toggle-ifr','toggle-review'].includes(command)) session.dispatch({type:'preference', command})
      }
      if (changed('clear-token')) session.dispatch({type:'clear'})
      const replay = !blocked && !interrupted && changed('warm-token')
      const choice = changed('listen-choice-token') && next.mode === 'listen' && !blocked && !interrupted
      if (scope || changed('pref-token') || choice)
        words.refresh(courseActive(), choice ? next['listen-content'] : undefined)
      const content = listenMode(next)
      const entering = scope || previousListen !== content
      if (entering || selectionChanged || changed('cancel-token') || (!wasBlocked && blocked)) listenPractice.reset()
      if (entering && previousListen === 'characters') listen.exit()
      if (entering && previousListen === 'words') words.leave()
      if (entering && previousListen === 'custom') custom.leave()
      if (next.mode === 'guided') {
        if (scope) guide.enter(!blocked && !interrupted)
        else guide.blocked(blocked || interrupted)
        if (!blocked && changed('guide-token')) guide.continue()
        if (replay && !guide.isListening()) guide.replay()
      }
      if (!blocked && changed('nux-token')) {
        const command = next['nux-command']
        if (command === 'replay') { replayed = true; nux.act(command) }
        else if (next.mode === 'nux') nux.act(command)
        publishWidget()
      }
      if (next.mode === 'conversation' && status !== 'pending') {
        if (scope) contact.enter()
        else if (!wasBlocked && blocked) contact.end()
        else if (changed('cancel-token')) contact.interrupt()
        else if (!blocked && !interrupted) contact.update(next,changed)
      }
      if (content === 'custom') {
        if (entering) custom.enter()
        else if ((!wasBlocked && blocked) || changed('cancel-token') || changed('clear-token')) custom.suspend()
        if (!blocked && !interrupted) custom.update(next,changed)
      }
      if (content === 'words') {
        if (entering) words.enter()
        else if (selectionChanged || changed('cancel-token') || changed('clear-token') || (!wasBlocked && blocked)) words.suspend()
        if (!blocked && !interrupted && changed('word-token')) words.command(next['word-command'])
      }
      if (content === 'characters' && (blocked || interrupted) && !wasBlocked) listen.suspend()
      if (content === 'characters' && !blocked && !interrupted && (entering || wasBlocked || selectionChanged))
        listen.enter({autoplay:!guide.completed() || prev.mode !== 'guided'})
      if (!blocked && !interrupted && (content === 'characters' || guide.isListening())) {
        if (replay) listen.replay()
        if (changed('answer-token')) listen.answer(next['answer-value'], next['answer-prompt'] ?? '')
      }
      if (replay && next.mode === 'practice') {
        cancelInput('replay')
        play(session.current().target)
      } else playPrompt()
      publishHelpers()
    },
    input(kind, value) {
      if (!canKey()) return
      if (props.mode === 'conversation') {
        if (kind === 'down') contact.activity()
        if (kind === 'sequence') contact.key(value)
      } else if (props.mode === 'nux') {
        if (kind === 'symbol') nux.symbol(value)
      } else if (kind === 'sequence') {
        inputSymbols = ''
        if (props.mode === 'guided') guide.accept(value)
        else {
          session.dispatch({type:'sequence', code:value})
          if (props.mode === 'practice' && session.current().settings.practiceWords) playPrompt()
        }
      } else if (kind === 'symbol') {
        if (props.mode === 'guided') guide.symbol()
        if ((props.mode === 'practice' || props.mode === 'guided') && session.current().settings.showHint)
          inputSymbols = (inputSymbols + value).slice(0,6)
        session.dispatch({type:'symbol',symbol:value})
      } else if (kind === 'down' && hint === 'morse') {
        advanceHint('settings')
      }
      publishHelpers()
    },
    timer(id) {
      const fn = timers.get(id)
      timers.delete(id)
      fn?.()
      playPrompt()
      publishHelpers()
    },
    permissionResult(id,result) { reminder.permission(id,result) },
    scheduleResult(id,result) { reminder.scheduled(id,result) },
    foreground() { if (ready && !closed) { reminder.sync(); publishWidget(true) } },
    interrupt(value, applicationInactive=false) {
      if (applicationInactive && props.mode === 'conversation') {
        contact.confirm(false)
        contact.end()
      }
      if (value === interrupted) return
      interrupted = value
      if (value) {
        listenPractice.reset()
        cancelInput()
        listen.suspend()
        if (props.mode === 'conversation') contact.interrupt()
        if (listenMode(props) === 'words') words.suspend()
        if (listenMode(props) === 'custom') custom.suspend()
      }
      if (props.mode === 'guided') guide.blocked(value || modal(props))
    },
    configuration() {
      const {speed, pitch} = session.current().settings
      const enabled = canKey()
      return {enabled, hardwareEnabled:enabled && props.mode !== 'nux', unit:playbackUnitMs(speed), pitch, hapticsEnabled}
    },
    dispose() {
      closed = true
      if (props.mode === 'conversation') contact.leave()
      custom.leave()
      words.leave()
      nux.close()
      guide.leave()
      listen.exit()
      session.dispose()
      for (const id of timers.keys()) clock.clearTimer(id)
    },
  }
}
