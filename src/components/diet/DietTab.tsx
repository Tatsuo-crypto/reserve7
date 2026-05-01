'use client'

import { useState } from 'react'
import InputTab from './InputTab'
import AnalyzeTab from './AnalyzeTab'

interface DietTabProps {
    userId: string
    token: string
    isAdmin?: boolean
    sharedState: any
    onStateChange: (state: any) => void
}

export default function DietTab({ userId, token, isAdmin, sharedState, onStateChange }: DietTabProps) {
    const [mode, setMode] = useState<'input' | 'analyze'>('input')

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Mode Switcher */}
            <div className="bg-gray-100 p-1 rounded-2xl flex items-center mb-4">
                <button 
                    onClick={() => setMode('input')}
                    className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${mode === 'input' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    入力
                </button>
                <button 
                    onClick={() => setMode('analyze')}
                    className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${mode === 'analyze' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    分析
                </button>
            </div>

            {/* Content Area */}
            <div className="min-h-[600px] overflow-x-hidden relative">
                {mode === 'input' ? (
                    <div key="input" className="animate-slideInRight">
                        <InputTab 
                            userId={userId} 
                            token={token} 
                            isAdmin={isAdmin} 
                            sharedState={sharedState} 
                            onStateChange={onStateChange} 
                        />
                    </div>
                ) : (
                    <div key="analyze" className="animate-slideInLeft">
                        <AnalyzeTab 
                            userId={userId} 
                            token={token} 
                            isAdmin={isAdmin} 
                            todayDraft={sharedState} 
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
