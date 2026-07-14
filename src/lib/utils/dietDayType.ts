export type DietDayType = 'training' | 'rest'

export type DietGoalLike = {
    calories?: number | string | null
    protein?: number | string | null
    fat?: number | string | null
    carbs?: number | string | null
    sugar?: number | string | null
    fiber?: number | string | null
    salt?: number | string | null
    day_type_enabled?: boolean | null
    training_calories?: number | string | null
    training_protein?: number | string | null
    training_fat?: number | string | null
    training_carbs?: number | string | null
    training_sugar?: number | string | null
    training_fiber?: number | string | null
    training_salt?: number | string | null
    rest_calories?: number | string | null
    rest_protein?: number | string | null
    rest_fat?: number | string | null
    rest_carbs?: number | string | null
    rest_sugar?: number | string | null
    rest_fiber?: number | string | null
    rest_salt?: number | string | null
}

export type EffectiveDietGoal = {
    calories: number
    protein: number
    fat: number
    carbs: number
    sugar: number
    fiber: number
    salt: number
}

const toNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

export function isDayTypeTargetEnabled(goal: DietGoalLike | null | undefined) {
    return Boolean(goal?.day_type_enabled)
}

export function normalizeDietDayType(value: unknown): DietDayType | null {
    return value === 'training' || value === 'rest' ? value : null
}

export function getDietDayTypeLabel(dayType: DietDayType) {
    return dayType === 'training' ? '筋トレ日' : '休養日'
}

export function getEffectiveDietGoal(goal: DietGoalLike | null | undefined, dayType?: DietDayType | null): EffectiveDietGoal {
    const base = {
        calories: toNumber(goal?.calories),
        protein: toNumber(goal?.protein),
        fat: toNumber(goal?.fat),
        carbs: toNumber(goal?.carbs),
        sugar: toNumber(goal?.sugar),
        fiber: toNumber(goal?.fiber),
        salt: toNumber(goal?.salt, 6),
    }

    if (!goal?.day_type_enabled) return base

    const prefix = dayType === 'training' ? 'training' : 'rest'

    return {
        calories: toNumber(goal[`${prefix}_calories` as keyof DietGoalLike], base.calories),
        protein: toNumber(goal[`${prefix}_protein` as keyof DietGoalLike], base.protein),
        fat: toNumber(goal[`${prefix}_fat` as keyof DietGoalLike], base.fat),
        carbs: toNumber(goal[`${prefix}_carbs` as keyof DietGoalLike], base.carbs),
        sugar: toNumber(goal[`${prefix}_sugar` as keyof DietGoalLike], base.sugar),
        fiber: toNumber(goal[`${prefix}_fiber` as keyof DietGoalLike], base.fiber),
        salt: toNumber(goal[`${prefix}_salt` as keyof DietGoalLike], base.salt),
    }
}

export function getGoalForDate(goals: any[], dateStr: string) {
    return [...goals]
        .filter(goal => goal?.start_date && goal.start_date <= dateStr)
        .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
        || goals[goals.length - 1]
        || null
}

