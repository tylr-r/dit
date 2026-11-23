// The pinned prompt and model ID are pure code. No provider library is imported.
import {buildConversationSystemPrompt, CONVERSATION_MODEL_ID} from '../../../packages/core/src/utils/conversation.ts'
import {StationError} from '../modules/web/qso.mjs'

const opener = 'Begin the QSO now. Call CQ or send your opening call as you see fit.'

/**
 * Adapt an injected model factory to the conversation controller's per-contact station.
 * The host supplies openModel({model, systemInstruction}); only the controller can accept a reply.
 */
export function createProviderStationFactory(openModel) {
  return async function openStation({callsign, localHour}, onCancelOpen) {
    let model, idleChat
    try {
      model = await openModel({
        model: CONVERSATION_MODEL_ID,
        systemInstruction: buildConversationSystemPrompt({callsign,localHour}),
      }, onCancelOpen)
      idleChat = model.startChat({history:[]})
    } catch {
      throw new StationError('open')
    }
    let acceptedHistory = []
    let closed = false
    let generation = 0

    return {
      async send({outgoing}) {
        if (closed) throw new StationError('send')
        const attempt = ++generation
        try {
          // Overlapping or retried requests get an independent SDK queue.
          const chat = idleChat ?? model.startChat({history:[...acceptedHistory]})
          idleChat = undefined
          const result = await chat.sendMessage(outgoing ?? opener)
          const text = result.response.text().trim().replace(/\b599\b/g,'5NN')
          if (!text) throw new StationError('empty')
          const history = [...await chat.getHistory()]
          return {
            text,
            accept() {
              if (closed || attempt !== generation) return
              acceptedHistory = history
              idleChat = chat
            },
          }
        } catch (error) {
          if (error instanceof StationError) throw error
          throw new StationError('send')
        }
      },
      close() {
        closed = true
        model.close?.()
        acceptedHistory = []
        idleChat = undefined
      },
    }
  }
}

/** Connect the packaged SDK contract to an optional, callback-based Swift transport. */
export function createSwiftStationFactory(begin, cancel, open) {
  return createProviderStationFactory(async ({model,systemInstruction}, onCancelOpen) => {
    await new Promise((resolve,reject) => {
      const id = open(model,systemInstruction,ready => ready === true ? resolve() : reject(new StationError('open')))
      onCancelOpen?.(() => { cancel(id); reject(new StationError('open')) })
    })
    let abandon
    return {
      startChat({history}) {
        return {
          sendMessage(text) {
            abandon?.()
            return new Promise((resolve,reject) => {
              const id = begin(model, systemInstruction, JSON.stringify(history), text, (reply,encoded) => {
                abandon = undefined
                try {
                  const next = JSON.parse(encoded)
                  if (typeof reply !== 'string' || !Array.isArray(next)) throw new StationError('send')
                  history = next
                  resolve({response:{text:() => reply}})
                } catch { reject(new StationError('send')) }
              })
              abandon = () => {
                cancel(id)
                reject(new StationError('send'))
              }
            })
          },
          getHistory() { return history },
        }
      },
      close() { abandon?.(); abandon = undefined },
    }
  })
}
