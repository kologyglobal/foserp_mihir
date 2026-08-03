import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native'
import { ToastHost } from '@/components/Toast'
import { initApiSessionBridge, restoreSession } from '@/auth/sessionService'
import { useSessionStore } from '@/store/sessionStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

let bridgeReady = false

function ensureBridge() {
  if (!bridgeReady) {
    initApiSessionBridge()
    bridgeReady = true
  }
}

function SessionBootstrap({ children }: { children: React.ReactNode }) {
  const setOnline = useSessionStore((s) => s.setOnline)
  const status = useSessionStore((s) => s.status)

  useEffect(() => {
    ensureBridge()
    void restoreSession()
  }, [])

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false))
    })
    return unsub
  }, [setOnline])

  // status used to force re-render of gated trees when session restores
  void status

  return <>{children}</>
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  ensureBridge()
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionBootstrap>
            {children}
            <ToastHost />
          </SessionBootstrap>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

export { queryClient }

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
