export type Limit = { kind: string; percentUsed: number; resetsAt: string | null }

// `plan`: a Pro/Max subscription, shown as its 5h/7d windows. `api`: API-key
// billing, shown in US dollars.
export type Billing = 'plan' | 'api'

export type Meter = {
  tokens: number | null
  window: number
  percent: number | null
  usd: number | null
  billing: Billing
  limits: Limit[]
}

export type Track = { title: string; artist: string; isPlaying: boolean }

declare module 'claude-code' {
  interface PluginState {
    'context-band': { meter: Meter | null; track: Track | null }
  }
}
