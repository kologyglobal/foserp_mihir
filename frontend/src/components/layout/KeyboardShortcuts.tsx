import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'

const CHORD_ROUTES: Record<string, string> = {
  i: '/inventory',
  p: '/purchase',
  w: '/manufacturing/work-orders',
  s: '/sales',
  m: '/manufacturing/today',
}

/** Global productivity shortcuts — UI navigation only */
export function KeyboardShortcuts() {
  const navigate = useNavigate()
  const setSearchOpen = useUIStore((s) => s.setSearchOpen)
  const awaitingG = useRef<boolean>(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    function resetG() {
      awaitingG.current = false
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setSearchOpen(true)
        return
      }

      if (typing || e.metaKey || e.ctrlKey) return

      const key = e.key.toLowerCase()

      if (awaitingG.current) {
        e.preventDefault()
        resetG()
        const route = CHORD_ROUTES[key]
        if (route) navigate(route)
        return
      }

      if (key === 'g') {
        awaitingG.current = true
        timerRef.current = window.setTimeout(resetG, 1200)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      resetG()
    }
  }, [navigate, setSearchOpen])

  return null
}
