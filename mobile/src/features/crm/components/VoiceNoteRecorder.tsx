import { useEffect, useRef, useState } from 'react'

import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { Audio } from 'expo-av'

import * as FileSystem from 'expo-file-system'

import { colors, spacing, typography } from '@/theme'

import { StatusChip } from '@/components'



export type VoiceUploadStatus = 'idle' | 'recording' | 'preview' | 'pending' | 'uploading' | 'uploaded' | 'failed'



type Props = {

  onAttach: (file: {

    localUri: string

    originalFilename: string

    mimeType: string

    contentBase64?: string

  }) => Promise<void>

  disabled?: boolean

}



/**

 * Expo-compatible voice note: Record → Stop → Preview → Attach.

 * Upload ownership lives with parent (entity attach API / offline draft).

 */

export function VoiceNoteRecorder({ onAttach, disabled }: Props) {

  const recordingRef = useRef<Audio.Recording | null>(null)

  const soundRef = useRef<Audio.Sound | null>(null)

  const [status, setStatus] = useState<VoiceUploadStatus>('idle')

  const [uri, setUri] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)



  useEffect(() => {

    return () => {

      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined)

      void soundRef.current?.unloadAsync().catch(() => undefined)

    }

  }, [])



  const start = async () => {

    setError(null)

    try {

      const perm = await Audio.requestPermissionsAsync()

      if (!perm.granted) {

        Alert.alert('Microphone permission required')

        return

      }

      await Audio.setAudioModeAsync({

        allowsRecordingIOS: true,

        playsInSilentModeIOS: true,

      })

      const { recording } = await Audio.Recording.createAsync(

        Audio.RecordingOptionsPresets.HIGH_QUALITY,

      )

      recordingRef.current = recording

      setStatus('recording')

      setUri(null)

    } catch {

      setError('Could not start recording')

      setStatus('failed')

    }

  }



  const stop = async () => {

    try {

      const rec = recordingRef.current

      if (!rec) return

      await rec.stopAndUnloadAsync()

      const u = rec.getURI()

      recordingRef.current = null

      setUri(u)

      setStatus('preview')

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false })

    } catch {

      setError('Stop failed')

      setStatus('failed')

    }

  }



  const preview = async () => {

    if (!uri) return

    try {

      if (soundRef.current) {

        await soundRef.current.unloadAsync()

      }

      const { sound } = await Audio.Sound.createAsync({ uri })

      soundRef.current = sound

      await sound.playAsync()

    } catch {

      setError('Preview failed')

    }

  }



  const attach = async () => {

    if (!uri) return

    setStatus('uploading')

    setError(null)

    try {

      // Parent handles offline / upload; we only pass local file (no base64 log).

      await onAttach({

        localUri: uri,

        originalFilename: `voice_${Date.now()}.m4a`,

        mimeType: 'audio/m4a',

      })

      setStatus('uploaded')

      // best-effort temp cleanup after successful attach handoff

      try {

        await FileSystem.deleteAsync(uri, { idempotent: true })

      } catch {

        // parent may still hold uri for offline — ignore

      }

      setUri(null)

    } catch (e) {

      setStatus('failed')

      setError(e instanceof Error ? e.message : 'Attach failed')

    }

  }



  return (

    <View style={styles.wrap}>

      <View style={styles.row}>

        <Text style={styles.title}>Voice note</Text>

        <StatusChip

          label={status}

          tone={

            status === 'uploaded'

              ? 'success'

              : status === 'failed'

                ? 'danger'

                : status === 'recording' || status === 'uploading'

                  ? 'warning'

                  : 'default'

          }

        />

      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <View style={styles.actions}>

        {status !== 'recording' ? (

          <Pressable style={styles.btn} disabled={disabled} onPress={() => void start()}>

            <Text style={styles.btnText}>Record</Text>

          </Pressable>

        ) : (

          <Pressable style={[styles.btn, styles.stop]} onPress={() => void stop()}>

            <Text style={styles.btnText}>Stop</Text>

          </Pressable>

        )}

        {status === 'preview' || status === 'failed' ? (

          <>

            <Pressable style={styles.btn} onPress={() => void preview()}>

              <Text style={styles.btnText}>Preview</Text>

            </Pressable>

            <Pressable style={styles.btn} disabled={disabled} onPress={() => void attach()}>

              <Text style={styles.btnText}>Attach</Text>

            </Pressable>

          </>

        ) : null}

      </View>

    </View>

  )

}



const styles = StyleSheet.create({

  wrap: {

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 10,

    padding: spacing.md,

    gap: spacing.sm,

    marginVertical: spacing.sm,

  },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  title: { ...typography.bodyStrong },

  err: { ...typography.caption, color: colors.danger },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  btn: {

    backgroundColor: colors.primary,

    borderRadius: 8,

    paddingHorizontal: spacing.md,

    paddingVertical: spacing.sm,

  },

  stop: { backgroundColor: colors.danger },

  btnText: { color: colors.textInverse, fontWeight: '700', fontSize: 13 },

})

