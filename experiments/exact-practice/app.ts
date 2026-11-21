import type {Answer, Result, Sources} from './app.contract.d.ts'

export const appId = 'com.tylerobinson.dit.exactspike'
const file = 'app:/data/dit-progress-widget.json'
export const grants = 'fs.read app:/data/dit-progress-widget.json\nfs.write app:/data/dit-progress-widget.json'

type Props = Result<'ditProgress'>[number]['props']
type Snapshot = Omit<Props,'showArtwork'> & {day: string}
const empty: Props = {showArtwork:false, known:false, mastered:0, bestWpm:0, streak:0, today:0, goal:15}

function snapshot(json: string): Snapshot {
  const raw = JSON.parse(json)
  if (!raw || typeof raw.known !== 'boolean' || typeof raw.day !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(raw.day) || !Number.isInteger(raw.mastered) ||
      raw.mastered < 0 || raw.mastered > 36 || !Number.isFinite(raw.bestWpm) ||
      raw.bestWpm < 0 || !Number.isInteger(raw.streak) || raw.streak < 0 ||
      raw.goal !== 15 || !Number.isInteger(raw.today) || raw.today < 0 || raw.today > raw.goal)
    throw new Error('Invalid Dit widget snapshot')
  const {known,mastered,bestWpm,streak,today,goal,day} = raw
  return {known,mastered,bestWpm,streak,today,goal,day}
}

function calendarDay(at: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth()+1)}-${pad(at.getDate())}`
}

const sources: Sources = {
  saveDitWidget: async ([serialized], _store, storage) => {
    const data = serialized === 'null' ? null : snapshot(serialized)
    await storage.fs.atomicWriteFile(file,new TextEncoder().encode(JSON.stringify(data)))
    return {ok:true}
  },
  ditProgress: async ([date], _store, storage) => {
    let data: Snapshot
    try {
      const bytes = await storage.fs.readFile(file)
      const serialized = new TextDecoder().decode(new Uint8Array(bytes))
      if (serialized === 'null') return [{date,props:empty}]
      data = snapshot(serialized)
    } catch (error) {
      if ((error as {code?:string}).code === 'ENOENT') return [{date,props:empty}]
      throw error
    }
    const {day,...aggregate} = data
    const props = {...aggregate,showArtwork:true}
    const now = new Date(date)
    if (day !== calendarDay(now)) props.today = 0
    const timeline = [{date,props}]
    if (props.today > 0) {
      const midnight = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime()
      timeline.push({date:midnight,props:{...props,today:0}})
    }
    return timeline
  },
}

export const answer: Answer = (source,args,store,storage,native) => sources[source](args,store,storage,native)
