'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './icons'
import Button from './Button'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'
type ModalAlign = 'center' | 'bottom'

interface AppModalProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: ModalSize
  align?: ModalAlign
  bodyClassName?: string
  panelClassName?: string
  closeLabel?: string
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

let openModalCount = 0
let lockedScrollY = 0
let previousBodyStyles: Partial<CSSStyleDeclaration> = {}

function lockPageScroll() {
  if (openModalCount === 0) {
    lockedScrollY = window.scrollY
    previousBodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    }
    document.body.style.position = 'fixed'
    document.body.style.top = `-${lockedScrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
  }
  openModalCount += 1
}

function unlockPageScroll() {
  openModalCount = Math.max(0, openModalCount - 1)
  if (openModalCount !== 0) return

  document.body.style.position = previousBodyStyles.position || ''
  document.body.style.top = previousBodyStyles.top || ''
  document.body.style.width = previousBodyStyles.width || ''
  document.body.style.overflow = previousBodyStyles.overflow || ''
  window.scrollTo(0, lockedScrollY)
}

export default function AppModal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
  align = 'center',
  bodyClassName = '',
  panelClassName = '',
  closeLabel = '閉じる',
}: AppModalProps) {
  const [mounted, setMounted] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    setMounted(true)
    lockPageScroll()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      unlockPageScroll()
    }
  }, [])

  if (!mounted) return null

  const bottomAligned = align === 'bottom'

  return createPortal(
    <div
      className={`fixed inset-0 z-[300] flex justify-center overflow-hidden bg-black/60 ${bottomAligned ? 'items-end p-0 sm:items-center sm:p-4' : 'items-center p-3 sm:p-4'}`}
      style={bottomAligned ? undefined : {
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className={`relative flex min-h-0 w-full flex-col overflow-hidden border border-border-subtle bg-surface-raised shadow-2xl ${sizeClasses[size]} ${bottomAligned ? 'rounded-t-2xl sm:rounded-2xl' : 'rounded-2xl'} ${panelClassName}`}
        style={{
          maxHeight: bottomAligned
            ? 'calc(100dvh - env(safe-area-inset-top))'
            : 'calc(100dvh - max(1.5rem, env(safe-area-inset-top)) - max(1.5rem, env(safe-area-inset-bottom)))',
        }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5">
          <h2 className="min-w-0 text-lg font-normal text-text-primary">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 shrink-0 rounded-full bg-surface-base p-0 text-text-secondary transition-colors hover:text-text-primary"
            aria-label={closeLabel}
          >
            <Icon name="close" size={18} />
          </Button>
        </header>

        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] ${bodyClassName}`}>
          {children}
        </div>

        {footer && (
          <footer
            className="flex shrink-0 items-center justify-end gap-3 border-t border-border-subtle bg-surface-raised px-4 pt-3 sm:px-5"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  )
}
