/**
 * M1 structural / API shape verification (no live backend required).
 * Run: npm run test:unit
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function mustExist(rel: string) {
  const p = join(root, rel)
  assert.ok(existsSync(p), `missing ${rel}`)
}

const required = [
  'package.json',
  'app.config.ts',
  'app/_layout.tsx',
  'app/index.tsx',
  'app/(auth)/login.tsx',
  'app/(app)/(tabs)/index.tsx',
  'app/(app)/profile.tsx',
  'app/(app)/settings.tsx',
  'src/api/client.ts',
  'src/auth/secureStorage.ts',
  'src/auth/sessionService.ts',
  'src/auth/permissions.ts',
  'src/auth/modules.ts',
  'src/components/PrimaryButton.tsx',
  'src/theme/tokens.ts',
  '.env.example',
]

for (const rel of required) mustExist(rel)

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(pkg.name, 'fos-mobile')
for (const dep of [
  'expo',
  'expo-router',
  'expo-secure-store',
  'axios',
  '@tanstack/react-query',
  'zustand',
  'zod',
  'react-hook-form',
  'expo-image-picker',
  'expo-file-system',
  'react-native-reanimated',
  'react-native-gesture-handler',
]) {
  assert.ok(pkg.dependencies[dep], `missing dependency ${dep}`)
}

// Ensure no AsyncStorage dependency for tokens
assert.ok(!pkg.dependencies['@react-native-async-storage/async-storage'])

const client = readFileSync(join(root, 'src/api/client.ts'), 'utf8')
assert.match(client, /tenantPath/)
assert.match(client, /refresh-token/)
assert.match(client, /Authorization/)

const secure = readFileSync(join(root, 'src/auth/secureStorage.ts'), 'utf8')
assert.match(secure, /expo-secure-store/)
assert.equal(secure.includes('from \'@react-native-async-storage'), false)
assert.equal(/require\(['"]@react-native-async-storage/.test(secure), false)

const login = readFileSync(join(root, 'app/(auth)/login.tsx'), 'utf8')
assert.match(login, /tenantSlug/)
assert.match(login, /rememberLogin/)

console.log('M1 foundation structural checks: PASS')
