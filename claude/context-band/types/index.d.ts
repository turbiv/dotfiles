export type Limit = { kind: string; percentUsed: number }

export type Meter = {
  tokens: number | null
  window: number
  percent: number | null
  usd: number | null
  limits: Limit[]
}

export type Track = { title: string; artist: string; isPlaying: boolean }

declare module 'claude-code' {
  interface PluginState {
    'context-band': { meter: Meter | null; track: Track | null }
  }
}
