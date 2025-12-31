'use client'

import { useState, useEffect } from 'react'

/**
 * Custom hook to listen for store changes dispatched by StoreSwitcher.
 * Returns a counter that increments whenever the store changes,
 * AND the current store ID from the cookie.
 */
export function useStoreChange() {
    const [count, setCount] = useState(0)
    const [currentStoreId, setCurrentStoreId] = useState<string | null>(null)

    const checkCookie = () => {
        if (typeof document === 'undefined') return null
        const match = document.cookie.match(/(^|;)\s*admin_store_preference=([^;]+)/)
        return match ? match[2] : null
    }

    useEffect(() => {
        // Initial check
        setCurrentStoreId(checkCookie())

        const handler = () => {
            setCount(prev => prev + 1)
            setCurrentStoreId(checkCookie())
        }

        // Listen for custom event
        window.addEventListener('storeChange', handler)

        return () => {
            window.removeEventListener('storeChange', handler)
        }
    }, [])

    return { count, currentStoreId }
}
