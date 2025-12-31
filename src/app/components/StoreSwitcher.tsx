'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

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

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 border border-green-200 rounded-lg hover:bg-green-50 transition-colors bg-white"
                title="店舗を切り替え"
            >
                <div className="flex flex-col items-start">
                    <span className="text-xs font-semibold text-gray-800 flex items-center">
                        {currentStoreName}
                        <svg className={`w-3 h-3 ml-1 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500 text-white whitespace-nowrap">
                    管理者
                </span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100 ring-1 ring-black ring-opacity-5">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
                        店舗選択
                    </div>
                    {stores.map(store => (
                        <button
                            key={store.id}
                            onClick={() => handleSelect(store)}
                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-900 ${store.name === currentStoreName ? 'bg-green-50 font-medium text-green-900' : ''
                                }`}
                        >
                            {store.name}
                        </button>
                    ))}
                    {stores.length === 0 && (
                        <div className="px-4 py-2 text-sm text-gray-400">
                            店舗が見つかりません
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
