/**
 * Ambient types for react-grid-layout/legacy.
 * Package exports nest `types` under import/require; some TS bundler
 * resolutions fail to pick them up, which breaks `tsc -b`.
 */
declare module 'react-grid-layout/legacy' {
  import type { ComponentType, CSSProperties, ReactElement, ReactNode, Ref } from 'react'

  export type LayoutItem = {
    i: string
    x: number
    y: number
    w: number
    h: number
    minW?: number
    minH?: number
    maxW?: number
    maxH?: number
    static?: boolean
  }

  export type Layout = LayoutItem[]

  export type CompactType = 'vertical' | 'horizontal' | null

  type ResizeHandleAxis = 's' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'

  export interface LegacyReactGridLayoutProps {
    children: ReactNode
    width: number
    cols?: number
    rowHeight?: number
    maxRows?: number
    margin?: readonly [number, number]
    containerPadding?: readonly [number, number] | null
    layout?: Layout
    compactType?: CompactType
    preventCollision?: boolean
    allowOverlap?: boolean
    isDraggable?: boolean
    isBounded?: boolean
    draggableHandle?: string
    draggableCancel?: string
    isResizable?: boolean
    resizeHandles?: ResizeHandleAxis[]
    useCSSTransforms?: boolean
    transformScale?: number
    autoSize?: boolean
    className?: string
    style?: CSSProperties
    onLayoutChange?: (layout: Layout) => void
  }

  declare function ReactGridLayout(props: LegacyReactGridLayoutProps): ReactElement
  export default ReactGridLayout

  export function WidthProvider<P>(
    ComposedComponent: ComponentType<P & { width: number }>,
  ): ComponentType<Omit<P, 'width'> & { measureBeforeMount?: boolean }>
}
