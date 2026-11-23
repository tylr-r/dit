import {execFileSync} from 'node:child_process'
import {mkdtempSync, readFileSync, realpathSync, existsSync, writeFileSync, rmSync, copyFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {build, transform} from 'esbuild'
import {JSDOM} from 'jsdom'

export function listenKeyboardFixture() {
  return mountListenFixture(characterControls)
}

function characterControls(source) {
  const lines = source.split('\n')
  const replay = lines.findIndex(line => line.includes('aria-label="Play morse letter sound"'))
  const indent = lines[replay]?.search(/\S/)
  if (replay < 0) throw Error('Missing Apple Listen replay control')
  const end = lines.findIndex((line,index) => index > replay && line.startsWith(' '.repeat(indent) + 'if '))
  if (end < 0) throw Error('Missing end of character controls')
  const controls = lines.slice(replay,end).map(line => '      ' + line.slice(indent)).join('\n')
  const derives = source.split('\n').filter(line => /^  derive nativeListen(Pool|Locked) =/.test(line))
  return `component App
  state mode = "guided"
  state guidePool = "E,T"
  state ordinaryListenPool = "Q"
  state nativePhaseDialog = false
  state listenPhase = "answering"
${derives.join('\n')}
  action play
    listenPhase = "answering"
  action answer(letter: string)
    listenPhase = "reveal"
  action restart
    mode = "listen"
    listenPhase = "answering"
  action cover
    nativePhaseDialog = true
  view
    column
      button "Restart" press=restart
      button "Cover" press=cover
${controls}`
}

export function listenWordsFixture() {
  return mountListenFixture(source => {
    const start = source.indexOf('          if nativeWords\n            text (wordPhase')
    const end = source.indexOf('          else if mode == "listen" and listenContent == "words"',start)
    if (start < 0 || end < 0) throw Error('Missing native Words exercise')
    const exercise = source.slice(start,end).trimEnd().split('\n').slice(1)
      .map(line => line.slice(6)).join('\n')
    return `component App
  state wordPhase = "ready"
  state wordVocabulary = "common"
  state wordEligible = true
  state wordCount = "0/0"
  state wordOptions = "ON,AT,AS,IN"
  state wordCorrect = "1"
  state wordPicked = "2"
  state wordTarget = "ON"
  state wordFeedback = ""
  state wordMeaning = ""
  action words(value: string)
    if value == "start" or value == "replay"
      wordPhase = "playing"
    else
      wordPhase = "answered"
  action finishSound
    wordPhase = "choosing"
  view
    column
      button "Finish sound" press=finishSound
${exercise}`
  })
}

async function mountListenFixture(makeFixture) {
  const app = fileURLToPath(new URL('../',import.meta.url))
  const checkout = realpathSync(join(app,'.exact/checkout'))
  const temp = mkdtempSync(join(tmpdir(),'dit-listen-controls-'))
  let dom
  try {
    const fixture = makeFixture(readFileSync(join(app,'app.contract'),'utf8'))
    writeFileSync(join(temp,'app.contract'),fixture)
    copyFileSync(join(app,'app.forma'),join(temp,'app.forma'))
    const dir = join(temp,'js')
    execFileSync(join(checkout,'target/debug/exact-web-js'),['js',join(temp,'app.contract'),'-o',dir],{stdio:'pipe'})
    const hosts = [join(checkout,'host/web-js'),join(checkout,'host/web'),dir]
    const compiled = await build({entryPoints:[join(dir,'app.js')],bundle:true,write:false,format:'iife',globalName:'Keyboard',
      plugins:[{name:'exact-fixture-runtime',setup(builder) {
        builder.onResolve({filter:/^\.\//},args => {
          if (args.kind === 'dynamic-import') return {path:args.path,external:true}
          if (existsSync(resolve(args.resolveDir,args.path))) return
          const path = hosts.map(base => resolve(base,args.path)).find(existsSync)
          if (path) return {path}
        })
      }}]})
    dom = new JSDOM('<main id="exact-root"></main>',{url:'https://fixture.invalid/',runScripts:'outside-only',pretendToBeVisual:true})
    Object.assign(dom.window,{TextEncoder,TextDecoder,structuredClone,matchMedia:() => ({
      matches:false,addEventListener() {},removeEventListener() {}
    })})
    const sheet = dom.window.document.createElement('style')
    // jsdom needs the emitted nested stylesheet flattened for computed style.
    sheet.textContent = (await transform(readFileSync(join(dir,'app.css'),'utf8'),{
      loader:'css',supported:{nesting:false}
    })).code
    dom.window.document.head.append(sheet)
    dom.window.eval(compiled.outputFiles[0].text + '\nKeyboard.default()')
    return {document:dom.window.document, close:async () => {
      await new Promise(done => setImmediate(done))
      dom.window.close()
    }}
  } catch (error) {
    dom?.window.close()
    throw error
  } finally {
    rmSync(temp,{recursive:true,force:true})
  }
}
