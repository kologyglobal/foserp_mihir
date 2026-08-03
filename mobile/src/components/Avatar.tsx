import { View, Text, StyleSheet, Image } from 'react-native'
import { colors, typography } from '@/theme'

type Props = {
  name: string
  uri?: string | null
  size?: number
  /**
   * Soft pastel background + matching initials from name hash.
   * Default true so list rows get variety; pass false for solid brand blue.
   */
  pastel?: boolean
  /** Green online indicator at bottom-right */
  statusDot?: boolean
}

/** Soft pastel pairs — readable initials on light fills. */
const PASTEL_PAIRS = [
  { bg: '#DBEAFE', fg: '#1D4ED8' }, // blue
  { bg: '#FEE2E2', fg: '#B91C1C' }, // rose
  { bg: '#FEF3C7', fg: '#B45309' }, // amber
  { bg: '#D1FAE5', fg: '#047857' }, // emerald
  { bg: '#E0E7FF', fg: '#3730A3' }, // indigo
  { bg: '#FCE7F3', fg: '#BE185D' }, // pink
  { bg: '#CCFBF1', fg: '#0F766E' }, // teal
  { bg: '#FFEDD5', fg: '#C2410C' }, // orange
] as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '?').toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
}

function hashIndex(name: string, mod: number): number {
  let h = 0
  const s = name.trim().toLowerCase()
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h % mod
}

export function avatarPastelForName(name: string): { bg: string; fg: string } {
  return PASTEL_PAIRS[hashIndex(name || '?', PASTEL_PAIRS.length)] ?? PASTEL_PAIRS[0]
}

export function Avatar({ name, uri, size = 48, pastel = true, statusDot }: Props) {
  const dim = { width: size, height: size, borderRadius: size / 2 }
  const pair = !uri && pastel ? avatarPastelForName(name) : null
  const dotSize = Math.max(10, Math.round(size * 0.28))

  const core = uri ? (
    <Image source={{ uri }} style={[styles.img, dim]} accessibilityLabel={name} />
  ) : (
    <View
      style={[
        styles.fallback,
        dim,
        pair ? { backgroundColor: pair.bg } : styles.brandFallback,
      ]}
    >
      <Text
        style={[
          styles.initials,
          { fontSize: size * 0.34, color: pair ? pair.fg : colors.primary },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  )

  if (!statusDot) return core

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {core}
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
          },
        ]}
        accessibilityLabel="Online"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  img: { backgroundColor: colors.surfaceMuted },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandFallback: {
    backgroundColor: colors.primaryMuted,
  },
  initials: { ...typography.bodyStrong, fontWeight: '700' },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
})
