import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'context-band',
  component: 'AbovePrompt',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 140,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const CONTEXT = { tokens: 50_000, window: 200_000, percent: 25 }
const IN_TWO_HOURS = new Date(Date.now() + 2 * 3_600_000)
const IN_THREE_DAYS = new Date(Date.now() + 3 * 86_400_000)
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const start = async ($: any, on: any, kind: 'bearer' | 'api-key') => {
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.authorize', () => ({ value: { handle: 'h', kind } }))
  // A terminal surface alone, so the Spotify poll never starts.
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: CONTEXT, rateLimits: [], cost: { usd: 1.5 } },
  }))
  on('session.measure', (_: unknown, e: { changed: string[] }) => ({ changed: e.changed }))
  on('clock.now', () => ({ value: Date.now() }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

const textOf = async ($: any) => {
  const ui = await $.ui.mount(BAND)
  const texts = (await ui.findAll({ type: 'Text' })).map((t: { text: string }) => t.text)
  await ui.unmount()
  return texts.join('|')
}

test('a Max login shows the plan windows and no dollars, before any reading', async ($, on) => {
  await start($, on, 'bearer')
  const text = await textOf($)

  expect(text).toMatch(/5h/)
  expect(text).toMatch(/7d/)
  expect(text).not.toMatch(/\$1\.50/)
})

test('a Max session shows each window with its reset', async ($, on) => {
  await start($, on, 'bearer')
  await $.session.measure({
    context: CONTEXT,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 42, resetsAt: IN_TWO_HOURS.toISOString() },
      { kind: 'seven_day', percentUsed: 9, resetsAt: IN_THREE_DAYS.toISOString() },
    ],
    cost: { usd: 3.25 },
    changed: ['rateLimits'],
  })
  const text = await textOf($)

  expect(text).toMatch(/42%/)
  // The 5h reset as a clock time alone, the 7d one with its weekday.
  expect(text).toContain(`42%| ↻ ${hhmm(IN_TWO_HOURS)}|`)
  expect(text).toContain(`↻ ${DAYS[IN_THREE_DAYS.getDay()]} ${hhmm(IN_THREE_DAYS)}`)
  expect(text).toMatch(/9%/)
  expect(text).not.toMatch(/\$3\.25/)
})

test('an API key shows dollars and no plan windows', async ($, on) => {
  await start($, on, 'api-key')
  const text = await textOf($)

  expect(text).toMatch(/\$1\.50/)
  expect(text).not.toMatch(/5h/)
})
