import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface Member {
    user_id: string
    full_name: string
    plan: string
    date: string // start_date or end_date
}

interface MemberMovementModalProps {
    isOpen: boolean
    onClose: () => void
    data: {
        month: string
        newMembers: Member[]
        withdrawnMembers: Member[]
    } | null
}

export default function MemberMovementModal({ isOpen, onClose, data }: MemberMovementModalProps) {
    if (!isOpen || !data) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                    {data.month} の入退会詳細
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* New Members */}
                                    <div className="border rounded-lg p-4 bg-red-50">
                                        <h4 className="font-bold text-red-700 mb-3 flex items-center">
                                            <span>新規入会</span>
                                            <span className="ml-2 bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded-full">
                                                {data.newMembers.length}名
                                            </span>
                                        </h4>
                                        <div className="max-h-[400px] overflow-y-auto">
                                            {data.newMembers.length > 0 ? (
                                                <ul className="divide-y divide-red-200">
                                                    {data.newMembers.map((member) => (
                                                        <li key={member.user_id} className="py-2 text-sm">
                                                            <div className="font-medium text-gray-900">{member.full_name}</div>
                                                            <div className="text-gray-500 text-xs">
                                                                {member.plan}
                                                            </div>
                                                            <div className="text-gray-400 text-xs mt-0.5">
                                                                入会日: {format(new Date(member.date), 'yyyy/MM/dd', { locale: ja })}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-gray-500 text-center py-4">該当者なし</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Withdrawn Members */}
                                    <div className="border rounded-lg p-4 bg-blue-50">
                                        <h4 className="font-bold text-blue-700 mb-3 flex items-center">
                                            <span>退会</span>
                                            <span className="ml-2 bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                                                {data.withdrawnMembers.length}名
                                            </span>
                                        </h4>
                                        <div className="max-h-[400px] overflow-y-auto">
                                            {data.withdrawnMembers.length > 0 ? (
                                                <ul className="divide-y divide-blue-200">
                                                    {data.withdrawnMembers.map((member) => (
                                                        <li key={member.user_id} className="py-2 text-sm">
                                                            <div className="font-medium text-gray-900">{member.full_name}</div>
                                                            <div className="text-gray-500 text-xs">
                                                                {member.plan}
                                                            </div>
                                                            <div className="text-gray-400 text-xs mt-0.5">
                                                                退会日: {format(new Date(member.date), 'yyyy/MM/dd', { locale: ja })}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-gray-500 text-center py-4">該当者なし</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
