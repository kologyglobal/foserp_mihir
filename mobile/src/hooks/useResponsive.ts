import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'

export function useResponsive() {
  const { width, height } = useWindowDimensions()
  return useMemo(() => {
    const isTablet = width >= 768
    const isLandscape = width > height
    const contentMaxWidth = isTablet ? 720 : width
    const columns = isTablet ? 2 : 1
    return { width, height, isTablet, isLandscape, contentMaxWidth, columns }
  }, [width, height])
}
