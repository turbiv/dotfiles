import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  Register,
  SessionContextUsage,
  SessionCost,
  SessionRateLimit,
  Timer,
} from 'claude-code'

import type { Meter, Track } from '../types'

const meter = atom({ plugin: 'context-band', key: 'meter' } as const, null)
const track = atom({ plugin: 'context-band', key: 'track' } as const, null)

const BAR_CELLS = 12
// One glyph for both halves of the bar, so filled and empty cells are the
// same width in any font; only the colour tells them apart. A square sits
// on the text's baseline and rises to about capital height, so the bar
// lines up with the words beside it; the block elements (▁ to █) hang from
// the bottom of the line instead and read as too low.
const BAR_GLYPH = '■'
const SEPARATOR = '  ·  '

const AMBER_FROM = 40
const RED_FROM = 85

const SPOTIFY_GREEN = '#1DB954'
const SPOTIFY_POLL_MS = 5_000
const SPOTIFY_TIMEOUT_MS = 4_000
const TRACK_MAX_CHARS = 40

// Asks Spotify only when it is already running, so the poll never launches it.
const SPOTIFY_SCRIPT = [
  'if application "Spotify" is running then',
  'tell application "Spotify"',
  'try',
  'return (player state as string) & tab & (name of current track) & tab & (artist of current track)',
  'end try',
  'end tell',
  'end if',
  'return ""',
]

const LIMIT_LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  spend_limit: 'spend',
}

const toMeter = (
  context: SessionContextUsage,
  rateLimits: SessionRateLimit[],
  cost: SessionCost | undefined,
): Meter => ({
  tokens: context.tokens ?? null,
  window: context.window,
  percent: context.percent ?? null,
  usd: cost?.usd ?? null,
  limits: rateLimits.map(({ kind, percentUsed }) => ({ kind, percentUsed })),
})

const compact = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`
  }

  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}k`
  }

  return String(tokens)
}

const level = (percent: number): 'success' | 'warning' | 'error' => {
  if (percent >= RED_FROM) {
    return 'error'
  }

  return percent >= AMBER_FROM ? 'warning' : 'success'
}

const filledCells = (percent: number): number => {
  const cells = Math.round((percent / 100) * BAR_CELLS)

  // Any use at all shows at least one cell.
  return Math.max(percent > 0 ? 1 : 0, Math.min(BAR_CELLS, cells))
}

const clip = (text: string): string =>
  text.length > TRACK_MAX_CHARS ? `${text.slice(0, TRACK_MAX_CHARS - 1)}…` : text

const parseTrack = (stdout: string): Track | null => {
  const [state, title, artist] = stdout.trim().split('\t')

  if (!title || (state !== 'playing' && state !== 'paused')) {
    return null
  }

  return { title, artist: artist ?? '', isPlaying: state === 'playing' }
}

// The poll's own bookkeeping: a reload starts it over, and the next poll
// writes the track again.
let isPolling = false
let lastSeen = ''

const pollSpotify = async ($: EngineInterface): Promise<void> => {
  if (isPolling) {
    return
  }

  isPolling = true

  try {
    const argv = ['osascript', ...SPOTIFY_SCRIPT.flatMap(line => ['-e', line])]
    const { exitCode, stdout } = await $.process.run(argv, { timeoutMs: SPOTIFY_TIMEOUT_MS })
    const seen = exitCode === 0 ? stdout.trim() : ''

    if (seen !== lastSeen) {
      lastSeen = seen
      await update($, track, () => parseTrack(seen))
    }
  } catch {
    // No osascript (not macOS), a timeout or a refusal: show no track.
    if (lastSeen !== '') {
      lastSeen = ''
      await update($, track, () => null)
    }
  } finally {
    isPolling = false
  }
}

// The band is for the apps, not the terminal: a terminal session keeps its
// own status line, so there the mod draws nothing and never polls Spotify.
let spotifyTimer: Timer | undefined

const startSpotify = ($: EngineInterface): void => {
  if (spotifyTimer !== undefined) {
    return
  }

  spotifyTimer = $.clock.every(SPOTIFY_POLL_MS, () => void pollSpotify($))
  void pollSpotify($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, meter, () => toMeter(usage.context, usage.rateLimits, usage.cost))

    if ((await $.session.surfaces()).some(surface => surface !== 'terminal')) {
      startSpotify($)
    }

    return result
  })

  // A session that began in a terminal and is later opened in an app.
  on('session.attach', ($, e, next) => {
    if (e.surface !== 'terminal') {
      startSpotify($)
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, meter, () => toMeter(e.context, e.rateLimits, e.cost))

    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, meter, () => toMeter(usage.context, usage.rateLimits, usage.cost))

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface === 'terminal') {
      return next(e)
    }

    const m = await read($, meter)
    const song = await read($, track)

    if (e.props.hasSurvey || m === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const percent = m.percent ?? 0
    const filled = filledCells(percent)
    const color = level(percent)

    return (
      <Box width="100%" justifyContent="space-between" columnGap={2}>
        <Text>
          <Text dimColor>context </Text>
          <Text mono color={color}>
            {BAR_GLYPH.repeat(filled)}
          </Text>
          <Text mono color="subtle">
            {BAR_GLYPH.repeat(BAR_CELLS - filled)}
          </Text>
          {m.percent === null ? (
            <Text dimColor> –</Text>
          ) : (
            <Text tabular weight="semibold" color={color}>
              {` ${m.percent}%`}
            </Text>
          )}
          <Text dimColor>{SEPARATOR}</Text>
          {m.tokens === null ? null : (
            <Text tabular color="text">
              {compact(m.tokens)}
            </Text>
          )}
          <Text dimColor>
            {m.tokens === null ? '' : ' / '}
            {compact(m.window)}
          </Text>
          {m.limits.map(limit => (
            <Text key={limit.kind}>
              <Text dimColor>
                {SEPARATOR}
                {LIMIT_LABELS[limit.kind] ?? limit.kind}{' '}
              </Text>
              <Text tabular color={level(limit.percentUsed)}>
                {`${Math.round(limit.percentUsed)}%`}
              </Text>
            </Text>
          ))}
          {m.usd === null ? null : (
            <Text>
              <Text dimColor>{SEPARATOR}</Text>
              <Text tabular color="suggestion">
                {`$${m.usd.toFixed(2)}`}
              </Text>
            </Text>
          )}
        </Text>
        {song === null ? null : (
          <Text wrap="truncate-end">
            <Text color={song.isPlaying ? SPOTIFY_GREEN : 'subtle'}>
              {song.isPlaying ? '♫ ' : '⏸ '}
            </Text>
            <Text color={song.isPlaying ? 'text' : 'subtle'}>{clip(song.title)}</Text>
            {song.artist === '' ? null : <Text dimColor>{` — ${clip(song.artist)}`}</Text>}
          </Text>
        )}
      </Box>
    )
  })
}
