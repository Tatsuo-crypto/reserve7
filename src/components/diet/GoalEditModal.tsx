'use client'

import { useState } from 'react'
import GoalPlanForm, { type GoalFormValues, type HabitTargetsValues } from './GoalPlanForm'
import AppModal from '@/components/ui/AppModal'

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
        <AppModal title={title} onClose={onClose} align="bottom" bodyClassName="p-5 sm:p-6">
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
        </AppModal>
    )
}
