import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    __audioOutput: { peak: number; levels: number[] }
  }
}

for (const route of ['/app', '/app/qso']) {
  test(`sound check emits audio on the first click and replay from ${route}`, async ({ page }) => {
    await page.addInitScript(() => {
      const output = { peak: 0, levels: [] as number[] }
      window.__audioOutput = output
      const connect = AudioNode.prototype.connect
      AudioNode.prototype.connect = new Proxy(connect, {
        apply(target, node: AudioNode, args: unknown[]) {
          const [destination] = args
          if (destination instanceof AudioDestinationNode) {
            const analyser = node.context.createAnalyser()
            analyser.fftSize = 256
            Reflect.apply(target, analyser, [destination])
            const index = output.levels.push(0) - 1
            const samples = new Float32Array(analyser.fftSize)
            const sample = () => {
              analyser.getFloatTimeDomainData(samples)
              const level = Math.max(...samples.map(Math.abs))
              output.levels[index] = level
              output.peak = Math.max(output.peak, level)
              requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
            return Reflect.apply(target, node, [analyser])
          }
          return Reflect.apply(target, node, args)
        },
      })
    })
    await page.goto(route)
    await page.getByRole('button', { name: 'Get started', exact: true }).click()
    await page.getByRole('button', { name: 'Learn Morse Start from the basics and build up.' }).click()
    for (const heading of ['Real Morse fluency.', 'No chart. Just listen.', 'Real speed from day one.']) {
      await page.getByText(heading, { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
    }
    await page.getByText('Check your sound', { exact: true }).waitFor()
    for (const label of ['Play sound', 'Play again']) {
      await expect.poll(() => page.evaluate(() => Math.max(0, ...window.__audioOutput.levels))).toBeLessThan(0.0001)
      await page.evaluate(() => { window.__audioOutput.peak = 0 })
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect.poll(() => page.evaluate(() => window.__audioOutput.peak), { timeout: 2000 }).toBeGreaterThan(0.01)
    }
  })
}
