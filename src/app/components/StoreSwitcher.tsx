'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/icons'

interface Store {
    id: string
    name: string
}

interface StoreSwitcherProps {
    defaultStoreName: string
}

export default function StoreSwitcher({ defaultStoreName }: StoreSwitcherProps) {
    const router = useRouter()
    const [stores, setStores] = useState<Store[]>([])
    const [currentStoreName, setCurrentStoreName] = useState(defaultStoreName)
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Click outside handler
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const res = await fetch('/api/admin/stores')
                if (res.ok) {
                    const data = await res.json()
                    const storesList = data.data?.stores || data.stores || []
                    setStores(storesList)

                    // Check cookie for current selection
                    const match = document.cookie.match(/(^|;)\s*admin_store_preference=([^;]+)/)
                    const cookieVal = match ? match[2] : null

                    if (cookieVal) {
                        const found = storesList.find((s: any) => s.id === cookieVal)
                        if (found) {
                            setCurrentStoreName(found.name)
                        }
                    } else {
                        // Default to 'all' if no cookie? Or keep defaultStoreName?
                        // User might want specific default. Keeping defaultStoreName for now unless it's empty.
                    }
                }
            } catch (e) {
                console.error('Failed to fetch stores', e)
            }
        }
        fetchStores()
    }, [])

    const handleSelect = (store: Store) => {
        // Set cookie
        document.cookie = `admin_store_preference=${store.id}; path=/; max-age=31536000` // 1 year
        setCurrentStoreName(store.name)
        setIsOpen(false)
        router.refresh()
        window.dispatchEvent(new Event('storeChange'))
    }

    const simplifyName = (name: string) => {
        const match = name.match(/【(.*?)】/)
        return match ? match[1] : name
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-1.5 px-3 py-1.5 border border-border-subtle rounded-full hover:bg-surface-overlay transition-colors bg-surface-raised/50 shadow-sm active:scale-95"
            >
                <span className="text-[13px] font-normal text-text-secondary flex items-center whitespace-nowrap">
                    {simplifyName(currentStoreName)}
                    <Icon name="chevronDown" size={12} className={`ml-1 text-text-muted transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-surface-raised rounded-2xl shadow-xl py-1 z-50 border border-border-subtle animate-fadeIn overflow-hidden">
                    <div className="px-4 py-2 text-[10px] font-normal text-text-muted uppercase tracking-widest border-b border-border-subtle">
                        店舗選択
                    </div>
                    {stores.map(store => (
                        <button
                            key={store.id}
                            onClick={() => handleSelect(store)}
                            className={`block w-full text-left px-4 py-3 text-[13px] text-text-secondary hover:bg-surface-overlay transition-colors ${store.name === currentStoreName ? 'bg-surface-overlay text-green-400' : ''
                                }`}
                        >
                            {simplifyName(store.name)}
                        </button>
                    ))}
                    {stores.length === 0 && (
                        <div className="px-4 py-3 text-sm text-text-muted">
                            店舗が見つかりません
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
