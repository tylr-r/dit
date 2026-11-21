import { createKeyController, createSidetone } from './key-controller.mjs'
import { createSession, decode, playbackUnitMs, replayPlan, millisecondsUntilLocalMidnight } from './session.mjs'
import { loadPractice, savePractice } from './practice-store.mjs'
import { createListen } from './listen.mjs'
import { pickWeighted, pickLatencyAware } from './progression.mjs'
import { scopeCommand } from './selection.mjs'
import { createGuide, guideReached, GUIDED_PACKS, GUIDED_KEY, readGuide } from './guided.mjs'
import { createWords, wordPlan } from './words.mjs'
import { createCustom, customPlan, CUSTOM_KEY } from './custom.mjs'
import { createNux } from './nux.mjs'
import { bindReferencePeek } from './reference-peek.mjs'
import { referencePattern } from './reference.mjs'
import { tempoTiming } from './tempo.mjs'
import { createQso, fixtureReply, qsoPlan } from './qso.mjs'

export const abi = 1
export const roster = { 'dit-key': { snapshot: false }, 'dit-reminder-wheel': { snapshot: false }, 'dit-mode-selector': { snapshot: false }, 'dit-intro-artwork': { snapshot: false }, 'dit-listen-wave': { snapshot:false } }

export function getPaddleKey({ code, key }) {
  if (code === 'ControlLeft' || code === 'BracketLeft') return { id: code, symbol: '.' }
  if (code === 'ControlRight' || code === 'BracketRight') return { id: code, symbol: '-' }
  if (key === '[' || key === ']') return { id: key, symbol: key === '[' ? '.' : '-' }
  return null
}
const finite = (value, fallback, min, max) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

export function create(tag, element, json, event) {
  if (tag === 'dit-intro-artwork' || tag === 'dit-listen-wave') return {artwork:true} // Only mounted by the Apple presentation.
  if (tag === 'dit-mode-selector') {
    const select = element.ownerDocument.createElement('select')
    for (const name of ['Practice', 'Freestyle', 'Listen', 'Conversation']) {
      const option = element.ownerDocument.createElement('option')
      option.value = name.toLowerCase()
      option.textContent = name
      select.append(option)
    }
    select.setAttribute('aria-label', 'Choose a practice mode')
    select.onchange = () => event(8, select.value)
    element.append(select)
    const handle = {select}
    setProps(handle, json)
    return handle
  }
  if (tag === 'dit-reminder-wheel') {
    const picker = element.ownerDocument.createElement('input')
    picker.type = 'time'
    picker.setAttribute('aria-label','Reminder time')
    picker.onchange = () => event(8,picker.value)
    element.append(picker)
    const handle = {picker}
    setProps(handle,json)
    return handle
  }
  if (tag !== 'dit-key') throw new Error('Unsupported Dit module: ' + tag)
  const win = element.ownerDocument.defaultView
  const audio = createSidetone(win)
  const listeners = new AbortController()
  const options = { signal: listeners.signal }
  const trace = detail => {
    if (new URLSearchParams(win.location.search).get('dit-key-trace') === '1') {
      element.dispatchEvent(new win.CustomEvent('dit-key-event', { detail, bubbles: true }))
    }
  }
  const h = { listeners, audio, externalBlocked: false, locked: false, guideLocked: false }
  const project = detail => { event(8, detail); trace(detail) }
  h.sessionReference=(letter,pattern,duration)=>{
    event(8,'ref-pattern:'+pattern)
    trace('reference-audio:'+letter+':'+duration)
  }
  let storage
  try { storage = win.localStorage } catch { /* unavailable in this browsing context */ }
  const local = loadPractice(storage)
  const oldGuide=readGuide(storage).data
  let storageStatus = local.status
  const sendStorage = () => project('storage:' + storageStatus)
  const timer = {
    setTimer: (fn, delay) => win.setTimeout(fn, delay),
    clearTimer: id => win.clearTimeout(id),
  }
  const wallNow=()=>win.Date?.now()??Date.now()
  const session = createSession({ ...timer, project, wallNow, data: local.data, cleanInstall:local.status==='empty', courseComplete:guideReached(oldGuide)===GUIDED_PACKS.length,
    onChange(state) {
      const next = savePractice(storage, state)
      if (next !== storageStatus) {
        storageStatus = next
        sendStorage()
      }
    },
    onLock(locked) {
      h.locked = locked
      if (locked) h.clearInput?.()
      h.attempt.configure({ blocked: h.externalBlocked || locked || h.guideLocked })
    },
  })
  const attempt = createKeyController({
    ...timer,
    now: () => win.performance.now(),
    audio,
    message: detail => {
      if (h.mode === 'nux') {
        if (detail.startsWith('symbol:')) h.nux.symbol(detail.slice(7))
        if (detail.startsWith('active:')) event(8,detail)
        return
      }
      if (detail === 'active:on') {
        if (h.mode === 'conversation') h.qso.activity()
        else session.dispatch({ type: 'toneStart' })
      }
      if (h.mode !== 'conversation' && detail.startsWith('symbol:')) session.dispatch({ type: 'symbol', symbol:detail.slice(7) })
      if (detail.startsWith('sequence:')) {
        const code = detail.slice(9)
        if (h.mode === 'conversation') h.qso.key(code)
        else if (h.mode === 'guided') h.guide.accept(code)
        else session.dispatch({ type: 'sequence', code })
      }
      if (detail.startsWith('active:')) event(8, detail)
      if (h.mode !== 'conversation') trace(detail)
    },
  })
  const playLetter = (letter, scheduled) => {
    const { speed, effectiveSpeed, pitch } = session.current().settings
    const {unitMs,characterGapMs} = tempoTiming(speed,effectiveSpeed)
    const onScheduled = scheduled ? (duration, readElapsed) => scheduled(duration + characterGapMs, () =>
      element.ownerDocument.hidden ? null : readElapsed()) : undefined
    audio.replay(replayPlan(letter,unitMs), pitch, h.volume ?? 0.75, onScheduled)
  }
  const pick = (pool, previous) => pickWeighted(pool, session.current().scores, previous, Math.random())
  const listen = createListen({
    ...timer, project, stop: () => audio.stop(),
    record(letter, correct, sample) {
      if (h.mode === 'guided') h.guide.recordListen(letter,correct,sample)
      else session.dispatch({ type:'listenScore', letter, correct, sample })
    },
    pick: previous => h.mode === 'guided' ? h.guide.pickListen(previous) : pick(session.current().studyPool,previous),
    getPool: () => h.mode === 'guided' ? h.guide.pool() : session.current().studyPool,
    isGuided: () => h.mode === 'guided',
    onRoundEnd: () => h.mode !== 'guided' || h.guide.finishListenRound(),
    play: (letter, scheduled) => {
      playLetter(letter,scheduled)
      trace('listen-audio:' + letter)
    },
  })
  const guide = createGuide({
    ...timer, storage, project, decode, play: playLetter, pick,
    pickListenWeighted: (pool,previous) => {
      const {scores,listenTtr}=session.current()
      return pickLatencyAware(pool,scores,listenTtr,previous,Math.random())
    },
    score: (letter, correct, mode, sample) => session.dispatch({type:'guidedScore', letter, correct, mode, sample}),
    startListen: () => listen.enter(), stopListen: () => listen.exit(),
    completed(status) {
      session.dispatch({type:'courseComplete'})
      h.silentCourseHandoff=true
      project('guide-completed:celebrate')
      project('guide-storage:'+status)
    },
    lock(locked) {
      h.guideLocked = locked
      if (locked) h.clearInput?.()
      attempt.configure({ blocked: h.externalBlocked || h.locked || locked })
    },
  })
  const words = createWords({
    getPool:()=>session.current().studyPool,
    project, stop: () => audio.stop(),
    play: (phrase, complete, fail) => {
      const {speed,effectiveSpeed,pitch} = session.current().settings
      trace('word-audio:' + phrase.text)
      audio.playFinite(wordPlan(phrase.text,speed,effectiveSpeed), pitch, h.volume ?? 0.75, complete, fail)
    },
  })
  const custom = createCustom({
    storage,
    project: detail => {
      // Never publish passage, typed copy, or diff to the optional debug trace.
      event(8,detail)
      if (detail.startsWith('custom-phase:')) trace(detail)
    },
    play: (text,complete,fail) => {
      const {speed,effectiveSpeed,pitch}=session.current().settings
      audio.playFinite(customPlan(text,speed,effectiveSpeed),pitch,h.volume??0.75,complete,fail)
    },
    stop: () => audio.stop(),
    pause: () => audio.pause(),
    resume: () => audio.resume(),
  })
  let qsoFrame
  const stopQsoFrames = () => { win.cancelAnimationFrame(qsoFrame); qsoFrame=undefined }
  const qso = createQso({
    ...timer, reply: fixtureReply,
    project: detail => {
      event(8,detail)
      if (detail.startsWith('qso-phase:')) {
        trace(detail)
        if (h.mode === 'conversation') {
          const keyable = detail === 'qso-phase:tx'
          if (!keyable) h.clearInput?.()
          attempt.configure({blocked:h.externalBlocked || !keyable})
        }
      }
    },
    play: (text,complete,fail,progress) => {
      const {speed,pitch}=session.current().settings
      stopQsoFrames()
      const finished = () => { stopQsoFrames(); complete() }
      const failed = () => { stopQsoFrames(); fail() }
      audio.playFinite(qsoPlan(text,speed),pitch,h.volume??0.75,finished,failed,clock => {
        function frame(){
          const elapsed=clock()
          if(elapsed===null)return
          progress(elapsed,speed)
          qsoFrame=win.requestAnimationFrame(frame)
        }
        qsoFrame=win.requestAnimationFrame(frame)
      })
    },
    stop:()=>{stopQsoFrames();audio.stop()},pause:()=>audio.pause(),resume:()=>audio.resume(),
  })
  const nux = createNux({
    ...timer, storage,
    stop:()=>audio.stop(),
    warm:()=>audio.warm(),
    play:()=>{
      const {speed,pitch}=session.current().settings
      audio.replay(replayPlan('E',playbackUnitMs(speed)),pitch,h.volume??0.75)
    },
    project:detail=>{
      if(detail.startsWith('nux-step:')&&h.mode==='nux'){
        if(!h.nux.canKey()) h.clearInput?.()
        attempt.configure({blocked:h.externalBlocked||!h.nux.canKey()})
      }
      if(detail==='nux-enter:guided'&&!h.nuxReplayed){
        try{
          if(loadPractice(storage).status==='empty'&&storage.getItem(GUIDED_KEY)===null&&storage.getItem(CUSTOM_KEY)===null)
            session.dispatch({type:'freshBeginnerDefaults'})
        }catch{/* unavailable storage must not overwrite choices */}
      }
      event(8,detail)
      if(detail.startsWith('nux-step:')||detail.startsWith('nux-status:'))trace(detail)
    },
  })
  Object.assign(h, { attempt, session, listen, guide, words, custom, qso, nux })
  setProps(h, json)
  // ABI create may run before the host has installed its live handle.
  win.queueMicrotask(() => {
    if (listeners.signal.aborted) return
    session.projectState()
    sendStorage()
    nux.project()
    guide.projectCatalog()
    if(guide.completed())project('guide-completed:restored')
  })
  h.clearReferencePeek = bindReferencePeek(element.ownerDocument, {
    open: () => h.referenceOpen,
    reveal: value => event(8, 'ref-peek:' + value),
    signal: listeners.signal,
  })
  let dailyTimer
  h.setDailyClock=enabled=>{
    timer.clearTimer(dailyTimer)
    dailyTimer=undefined
    if(!enabled)return
    session.projectDaily()
    dailyTimer=timer.setTimer(()=>h.setDailyClock(h.referenceOpen),millisecondsUntilLocalMidnight(wallNow()))
  }
  const heldKeys = new Map()
  let pointerId
  const cancellable = e => { if (e.cancelable) e.preventDefault() }
  const cancel = () => {
    heldKeys.clear()
    pointerId = undefined
    attempt.cancel()
    audio.stop()
    session.dispatch({ type: 'cancel' })
    if (h.mode === 'conversation') qso.interrupt()
    else if (h.mode === 'guided') guide.blocked(true)
    else if (h.customOn) custom.suspend()
    else if (h.wordsOn) words.suspend()
    else listen.suspend()
  }
  const editable = target => target?.isContentEditable || target?.matches?.('input, textarea, select')
  element.addEventListener('pointerdown', e => {
    if (e.button !== 0 || pointerId !== undefined || h.mode === 'listen' || h.mode === 'boot' || (h.mode === 'nux' && !nux.canKey()) || (h.mode === 'conversation' && !qso.canKey()) || (h.mode === 'guided' && !guide.canKey()) || (h.externalBlocked || h.locked || h.guideLocked)) return
    if (!attempt.straightDown('pointer:' + e.pointerId)) return
    pointerId = e.pointerId
    try { element.setPointerCapture(e.pointerId) } catch { /* Synthetic gesture can lack capture. */ }
    cancellable(e)
  }, options)
  const releasePointer = e => {
    if (pointerId !== e.pointerId) return
    pointerId = undefined
    attempt.straightUp('pointer:' + e.pointerId)
  }
  win.addEventListener('pointerup', releasePointer, options)
  for (const type of ['pointercancel', 'lostpointercapture']) {
    element.addEventListener(type, e => { if (pointerId === e.pointerId) cancel() }, options)
  }
  win.addEventListener('keydown', e => {
    if (e.code === 'Escape') { cancel(); return }
    if (editable(e.target) || (h.externalBlocked || h.locked || h.guideLocked) || e.metaKey || e.altKey) return
    const isSpace = e.code === 'Space' || e.key === ' '
    if (h.customOn || h.mode==='boot' || (h.mode==='nux'&&!nux.canKey())) return
    if (h.mode === 'conversation') {
      if (!qso.canKey()) return
      if (!e.ctrlKey && e.key === 'Backspace') { qso.backspace(); cancellable(e); return }
      if (!e.ctrlKey && e.key === 'Enter') {
        if (!e.repeat && !e.target?.closest?.('button, [role="button"], a[href]') && qso.send()) cancellable(e)
        return
      }
    }
    if (h.mode === 'listen' || guide.isListening()) {
      if (e.repeat || e.ctrlKey) return
      if (isSpace && e.target?.closest?.('button, [role="button"], a[href]')) return
      const handled = h.wordsOn
        ? (isSpace ? words.replay() || words.start() : e.key === 'Enter' ? words.next() : /^[1-4]$/.test(e.key) && words.answer(Number(e.key)))
        : (isSpace ? listen.replay() : listen.answer(e.key))
      if (handled) cancellable(e)
      return
    }
    if (h.mode === 'guided' && !guide.canKey()) return
    const paddle = isSpace ? null : getPaddleKey(e)
    if (!isSpace && !paddle) return
    const key = isSpace ? 'Space' : paddle.id
    const symbol = paddle?.symbol
    if (isSpace && e.target !== element && e.target?.closest?.('button, [role="button"], a[href]')) return
    if (e.repeat || heldKeys.has(key)) {
      if (heldKeys.has(key)) cancellable(e)
      return
    }
    if (symbol ? attempt.paddleDown(symbol) : attempt.straightDown('space')) {
      heldKeys.set(key, symbol)
      cancellable(e)
    }
  }, { ...options, capture: true })
  win.addEventListener('keyup', e => {
    const key = e.code === 'Space' || e.key === ' ' ? 'Space' : getPaddleKey(e)?.id
    const symbol = heldKeys.get(key)
    if (!heldKeys.delete(key)) return
    if (symbol) {
      if (![...heldKeys.values()].includes(symbol)) attempt.paddleUp(symbol)
    } else attempt.straightUp('space')
    cancellable(e)
  }, { ...options, capture: true })
  win.addEventListener('blur', cancel, options)
  element.ownerDocument.addEventListener('visibilitychange', () => {
    if (element.ownerDocument.hidden) cancel()
  }, options)
  h.clearInput = () => {
    heldKeys.clear()
    pointerId = undefined
  }
  return h
}

export function setProps(h, json) {
  if (h.artwork) return
  const props = JSON.parse(json)
  if (h.select) {
    h.select.value = ['listen', 'freestyle', 'conversation'].includes(props['current-mode']) ? props['current-mode'] : 'practice'
    h.select.disabled = String(props['mode-disabled']) === 'true'
    return
  }
  if (h.picker) {
    h.picker.value = props['clock-time'] ?? '19:00'
    h.picker.disabled = props['wheel-disabled'] === true || props['wheel-disabled'] === 'true'
    return
  }
  const blocked = props.blocked === 'true' || props.blocked === true
  const cancelToken = props['cancel-token'] ?? ''
  const clearToken = props['clear-token'] ?? ''
  const warmToken = props['warm-token'] ?? ''
  const mode = ['listen','freestyle','guided','conversation','nux','boot'].includes(props.mode) ? props.mode : 'practice'
  const volume = finite(props['tone-volume'], 0.75, 0, 0.9)
  h.volume = volume
  const replay = h.warmToken !== undefined && h.warmToken !== warmToken
  const clear = h.clearToken !== undefined && h.clearToken !== clearToken
  const changedMode = h.mode !== mode
  const routeBoundary = props['route-boundary'] ?? ''
  const changedRoute = h.routeBoundary !== undefined && h.routeBoundary !== routeBoundary
  const changedScope = changedMode || changedRoute
  const prefToken = props['pref-token'] ?? ''
  const preferenceChanged=h.prefToken!==undefined&&h.prefToken!==prefToken
  const selection=preferenceChanged?scopeCommand(props['pref-command']):null
  const command=preferenceChanged?props['pref-command']:''
  const pack=typeof command==='string'&&/^course-pack:(?:[1-9]|1[0-4])$/.test(command)?Number(command.slice(12))-1:null
  const openPractice=command==='course-open'
  h.routeBoundary = routeBoundary
  const cancel = (h.cancelToken !== undefined && h.cancelToken !== cancelToken)
    || changedScope || selection!==null || pack!==null || openPractice || clear || (replay && mode === 'practice')
  const wordsOn = mode === 'listen' && props['listen-content'] === 'words'
  const customOn = mode === 'listen' && props['listen-content'] === 'custom'
  const changedContent = mode === 'listen' && (Boolean(h.wordsOn) !== wordsOn || Boolean(h.customOn) !== customOn)
  const previouslyBlocked = h.externalBlocked
  const referenceOpen = props['reference-open'] === true || props['reference-open'] === 'true'
  const referenceClosing = h.referenceOpen && !referenceOpen
  const referenceToken = props['reference-token'] ?? ''
  const referenceReplay = referenceOpen && h.referenceOpen && !changedScope && !cancel
    && h.referenceToken !== undefined && h.referenceToken !== referenceToken
  h.externalBlocked = blocked
  if ((changedScope || changedContent) && h.mode === 'listen') {
    if (h.customOn) h.custom.leave()
    else if (h.wordsOn) h.words.leave()
    else h.listen.exit()
  }
  if (changedScope && h.mode === 'guided') h.guide.leave()
  if (changedMode && h.mode === 'nux') h.nux.close()
  if (changedScope && h.mode === 'conversation') h.qso.leave()
  h.mode = mode
  h.wordsOn = wordsOn
  h.customOn = customOn
  if (mode === 'listen' && blocked && !previouslyBlocked) {
    if (customOn) h.custom.suspend()
    else if (wordsOn) h.words.suspend()
    else h.listen.suspend()
  }
  if ((blocked && (!referenceOpen || !previouslyBlocked)) || cancel || referenceClosing) {
    h.clearInput?.()
    h.attempt.cancel()
    h.audio.stop()
    h.session.dispatch({ type: changedRoute ? 'routeBoundary' : 'cancel' })
  }
  h.session.dispatch({ type: 'mode', mode })
  if(selection){
    h.session.dispatch({type:'selection',selection})
    if(wordsOn)h.words.suspend()
  }else if(openPractice){
    h.session.dispatch({type:'openPractice'})
  }else if(pack!==null && mode==='guided'){
    h.guide.selectPack(pack)
  }else if(preferenceChanged){
    h.session.dispatch({ type: 'preference', command: props['pref-command'] })
  }
  const { speed, pitch: frequency } = h.session.current().settings
  const unitMs = playbackUnitMs(speed)
  if(referenceReplay){
    const letter=props['reference-char']
    const pattern=referencePattern(letter)
    if(pattern){
      const plan=replayPlan(letter,unitMs)
      h.sessionReference(letter,pattern,plan.at(-1)[1])
      h.audio.replay(plan,frequency,volume)
    }
  }
  if(h.referenceOpen!==referenceOpen)h.setDailyClock?.(referenceOpen)
  if (referenceClosing || changedScope) h.clearReferencePeek?.()
  h.referenceOpen=referenceOpen
  h.referenceToken=referenceToken
  if (clear) h.session.dispatch({ type: 'clear' })
  h.attempt.configure({ blocked: blocked || h.locked || h.guideLocked || (mode === 'conversation' && !h.qso.canKey()) || mode==='boot' || (mode==='nux'&&!h.nux?.canKey()), cancelToken, unitMs, frequency, volume })
  if (mode === 'guided') {
    if (changedScope) h.guide.enter(!blocked)
    else h.guide.blocked(blocked)
    const guideToken = props['guide-token'] ?? ''
    if (!blocked && h.guideToken !== undefined && h.guideToken !== guideToken) h.guide.continue()
    if (!blocked && replay && !h.guide.isListening()) h.guide.replay()
  }
  h.guideToken = props['guide-token'] ?? ''
  const nuxToken=props['nux-token']??''
  if(!blocked&&h.nuxToken!==undefined&&h.nuxToken!==nuxToken){
    const command=props['nux-command']??''
    if(command==='replay'){h.nuxReplayed=true;h.nux.act(command)}
    else if(mode==='nux')h.nux.act(command)
  }
  h.nuxToken=nuxToken
  if (wordsOn) {
    if (changedScope || changedContent) h.words.enter()
    const wordToken = props['word-token'] ?? ''
    if (!blocked && h.wordToken !== undefined && h.wordToken !== wordToken) {
      const command = props['word-command'] ?? ''
      if (command === 'start') h.words.start()
      if (command === 'replay') h.words.replay()
      if (command === 'next') h.words.next()
      if (command === 'common' || command === 'q-codes') h.words.vocabulary(command)
      if (command === 'all' || command === 'current') h.words.pool(command === 'all')
      if (command.startsWith('option-')) h.words.answer(Number(command.slice(7)))
    }
  }
  h.wordToken = props['word-token'] ?? ''
  if (mode === 'conversation') {
    if (changedScope) h.qso.enter()
    else if (blocked && !previouslyBlocked) h.qso.interrupt()
    const qsoCopy = props['qso-copy-value'] ?? ''
    if (!blocked && !changedScope && h.qsoCopy !== qsoCopy) h.qso.copy(qsoCopy)
    h.qsoCopy = qsoCopy
    const token = props['qso-token'] ?? ''
    if (!blocked && !changedScope && h.qsoToken !== undefined && h.qsoToken !== token) {
      const command = props['qso-command'] ?? ''
      if (command === 'send-first' || command === 'receive-first') {
        h.qso.start(command === 'send-first' ? 'send' : 'receive')
      }
      if (command === 'consent-allow' && h.qso.confirm(true)) h.audio.warm()
      if (command === 'consent-cancel') h.qso.confirm(false)
      if (command === 'live-on' || command === 'live-off') h.qso.setLive(command === 'live-on')
      if (command === 'clear') { h.clearInput?.(); h.attempt.cancel(); h.qso.clear() }
      if (command === 'backspace') h.qso.backspace()
      if (command === 'send') h.qso.send()
      if (command === 'reveal') h.qso.reveal()
      if (command === 'check') h.qso.check()
      if (command === 'start-turn') h.qso.startTurn()
      if (command === 'pause') void h.qso.pause()
      if (command === 'resume') void h.qso.resume()
      if (command === 'replay') h.qso.replay()
      if (command === 'retry') h.qso.retry()
      if (command === 'end') { h.clearInput?.(); h.attempt.cancel(); h.qso.end() }
      if (command === 'new') h.qso.new()
    }
  }
  h.qsoToken = props['qso-token'] ?? ''
  if (customOn) {
    if (changedScope || changedContent) h.custom.enter()
    const raw = props['custom-source-value'] ?? ''
    const copy = props['custom-copy-value'] ?? ''
    if (!blocked) {
      if (h.customSource !== raw) h.custom.edit(raw)
      if (h.customCopy !== copy) h.custom.copy(copy)
    }
    h.customSource = raw
    h.customCopy = copy
    const token = props['custom-token'] ?? ''
    if (!blocked && h.customToken !== undefined && h.customToken !== token) {
      const command = props['custom-command'] ?? ''
      if (command === 'save') h.custom.save(raw,props['custom-type-value'] === true || props['custom-type-value'] === 'true')
      if (command === 'edit') h.custom.edit()
      if (command === 'discard') h.custom.discard()
      if (command === 'clear') h.custom.clear()
      if (command === 'play') h.custom.play()
      if (command === 'pause') void h.custom.pause()
      if (command === 'resume') void h.custom.resume()
      if (command === 'reveal') h.custom.reveal()
    }
  }
  h.customToken = props['custom-token'] ?? ''
  if (((mode === 'listen' && !wordsOn && !customOn) || h.guide.isListening()) && !blocked) {
    if (mode === 'listen' && (changedScope || changedContent || selection!==null || (previouslyBlocked && h.listenNeverEntered))) {
      h.listenNeverEntered = false
      const silent=h.silentCourseHandoff===true
      h.silentCourseHandoff=false
      h.listen.enter({autoplay:!silent,keepTarget:silent})
    } else if (replay) {
      h.listen.replay()
    }
    const answerToken = props['answer-token'] ?? ''
    if (h.answerToken !== undefined && h.answerToken !== answerToken) h.listen.answer(props['answer-value'], props['answer-prompt'] ?? '')
  }
  if (mode === 'listen' && (changedScope || selection!==null) && blocked) h.listenNeverEntered = true
  h.answerToken = props['answer-token'] ?? ''
  if (replay && mode === 'practice' && !blocked) {
    h.session.dispatch({ type: 'replay' })
    h.audio.replay(replayPlan(h.session.current().target, unitMs), frequency, volume)
  }
  Object.assign(h, { warmToken, clearToken, cancelToken, prefToken })
}

export function destroy(h) {
  if (h.artwork) return
  if (h.select) { h.select.remove(); return }
  if (h.picker) { h.picker.remove(); return }
  h.setDailyClock?.(false)
  h.listeners.abort()
  h.nux.close()
  h.qso.leave()
  h.custom.leave()
  h.words.leave()
  h.guide.leave()
  h.listen.exit()
  h.session.dispose()
  h.attempt.cancel()
  h.audio.close()
}
