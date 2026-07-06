'use client'

import { useState } from 'react'
import GoalPlanForm, { type GoalFormValues, type HabitTargetsValues } from './GoalPlanForm'

interface GoalEditModalProps {
    title: string
    initialValues: GoalFormValues
    initialHabitTargets: HabitTargetsValues
    onClose: () => void
    onSave: (values: GoalFormValues, habitTargets: HabitTargetsValues) => Promise<void>
    onDelete?: () => Promise<void>
}

/**
 * K-2: 履歴バーのタップ編集・「新しいプランを作成」で使う編集モーダル。
 * ページ本体の「現在の目標設定」とは独立したローカル状態を持つため、
 * モーダルでの編集途中の値が現在の設定表示に影響することはない。
 */
export default function GoalEditModal({ title, initialValues, initialHabitTargets, onClose, onSave, onDelete }: GoalEditModalProps) {
    const [values, setValues] = useState<GoalFormValues>(initialValues)
    const [habitTargets, setHabitTargets] = useState<HabitTargetsValues>(initialHabitTargets)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            await onSave(values, habitTargets)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!onDelete) return
        if (!confirm('この設定履歴を削除してもよろしいですか？')) return
        setDeleting(true)
        try {
            await onDelete()
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black bg-opacity-50">
            <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideUp">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-normal text-gray-900">{title}</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">×</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <GoalPlanForm
                        values={values}
                        onValuesChange={setValues}
                        habitTargets={habitTargets}
                        onHabitTargetsChange={setHabitTargets}
                        showStartDate
                        onSave={handleSave}
                        saving={saving || deleting}
                        saveLabel="保存する"
                        onDelete={onDelete ? handleDelete : undefined}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    )
}
