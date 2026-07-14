/**
 * 目標設定（PFC/カロリー）まわりの純粋計算ロジック（K-3）。
 *
 * K-3の決定により、カロリーは常にPFC(g)からの導出値（読み取り専用）に一本化する。
 * 「カロリーを先に決めてPFCに割る」という実務のために、カロリーを起点にPFCへ
 * 逆算する `distributeCaloriesToMacros` を提供する。
 *
 * このリポジトリには単体テストランナー（jest/vitest等）が導入されておらず
 * （package.jsonのtestスクリプトはPlaywrightのe2eテストのみ）、新規にテスト基盤を
 * 追加するのはこのタスクのスコープを超えるため、関数を純粋関数として切り出した上で
 * 手動のサニティチェック（node実行）で検証した。将来テスト基盤が入った際はこの
 * ファイルに対して直接ユニットテストを追加できる。
 */

export interface MacroGrams {
    protein: number
    fat: number
    carbs: number
    fiber: number
    sugar: number
}

/** PFC(g)からカロリーを導出する（唯一の真実の経路）。 */
export function caloriesFromMacros(protein: number, fat: number, carbs: number): number {
    return Math.round(protein * 4 + fat * 9 + carbs * 4)
}

/**
 * ±ボタンでのグラム調整（既存のhandleGramChangeと同じロジック）。
 * 糖質/食物繊維を変えたら炭水化物を再計算、炭水化物を変えたら糖質を再計算、
 * 最後にカロリーをPFCから再導出する。
 */
export function adjustMacroGram(
    current: MacroGrams,
    key: 'protein' | 'fat' | 'carbs' | 'sugar' | 'fiber',
    delta: number
): MacroGrams & { targetCalories: number } {
    const next: MacroGrams = { ...current, [key]: Math.max(0, current[key] + delta) }
    if (key === 'sugar' || key === 'fiber') {
        next.carbs = next.sugar + next.fiber
    } else if (key === 'carbs') {
        next.sugar = Math.max(0, next.carbs - next.fiber)
    }
    return { ...next, targetCalories: caloriesFromMacros(next.protein, next.fat, next.carbs) }
}

/**
 * カロリーを起点にPFCを再配分する（K-3の中心ロジック）。
 * - タンパク質(g)は現状維持（体重基準で決める実務慣行のため固定）
 * - 残りのkcalを、現在の脂質:炭水化物の比率（kcalベース）を維持したままF/Cに配分
 *   （現在の比率が0の場合は 脂質30%/炭水化物70% にフォールバック）
 * - 食物繊維(g)は現状維持し、糖質 = 炭水化物 - 食物繊維（0未満は0にクランプ）
 */
export function distributeCaloriesToMacros(targetCalories: number, current: MacroGrams): MacroGrams & { targetCalories: number } {
    const proteinKcal = current.protein * 4
    const remainingKcal = Math.max(0, targetCalories - proteinKcal)

    const currentFatKcal = current.fat * 9
    const currentCarbKcal = current.carbs * 4
    const totalFC = currentFatKcal + currentCarbKcal
    const fatRatio = totalFC > 0 ? currentFatKcal / totalFC : 0.3

    const newFatKcal = remainingKcal * fatRatio
    const newCarbKcal = remainingKcal - newFatKcal

    const newFat = Math.round(newFatKcal / 9)
    const newCarbs = Math.round(newCarbKcal / 4)
    const newFiber = current.fiber
    const newSugar = Math.max(0, Math.round(newCarbs - newFiber))

    return {
        protein: current.protein,
        fat: newFat,
        carbs: newCarbs,
        fiber: newFiber,
        sugar: newSugar,
        targetCalories: caloriesFromMacros(current.protein, newFat, newCarbs),
    }
}

/** 日常の活動量（NEAT）の選択肢。値はそのままアラゴン式の係数として使う。 */
export const NEAT_LEVELS: { value: number; label: string }[] = [
    { value: 1.0, label: 'デスクワーク中心' },
    { value: 1.1, label: '立ち仕事メイン' },
    { value: 1.2, label: '継続的な肉体労働' },
    { value: 1.4, label: '重労働' },
]

export interface AragonPlanInput {
    /** 現在の体重(kg) */
    currentWeightKg: number
    /** 最終目標体重(kg) */
    targetWeightKg: number
    /** 目標期間(週間) */
    periodWeeks: number
    /** 週のトレーニング時間 */
    weeklyTrainingHours: number
    /** NEAT係数（NEAT_LEVELSのいずれか） */
    neat: number
}

export interface AragonPlanResult {
    /** 計算に採用した目標体重(kg)。安全ペース超過時は12週間後の中間目標体重。 */
    tbwKg: number
    /** ユーザー希望ペースが安全上限（週1%）を超えていたため、中間目標に置き換えたか */
    paceExceeded: boolean
    /** ユーザー希望ペース(kg/週)。マイナスは増量方向。 */
    requestedWeeklyLossKg: number
    /** 安全とみなす上限ペース(kg/週、現在体重の1%) */
    maxSafeWeeklyLossKg: number
    targetCalories: number
    protein: number
    fat: number
    carbs: number
}

const ARAGON_INTERMEDIATE_WEEKS = 12

/**
 * アラゴン式（体重ベース）による1日の目標摂取カロリー・PFCグラム数の算出。
 *
 * ステップ1（安全な減量ペースの判定とTBWの設定）:
 *   筋肉を落とさない上限を「現在体重の1%/週」とし、希望ペースがこれを超える場合は
 *   12週間後に安全ペースで到達する「中間目標体重」をTBWとして採用する（最終目標を
 *   通り越さないようクランプする）。超えない場合はそのまま最終目標体重を採用する。
 * ステップ2（カロリー算出）:
 *   TBW(kg)をポンドに変換し、 kcal = TBW_lbs × (10 + 週トレーニング時間) × NEAT係数
 * ステップ3（PFC算出、減量・筋肉維持ベース）:
 *   タンパク質 = TBW_kg × 2.2g、脂質 = TBW_kg × 1.0g、炭水化物 = 残りkcalから逆算
 */
export function calculateAragonPlan(input: AragonPlanInput): AragonPlanResult {
    const { currentWeightKg, targetWeightKg, periodWeeks, weeklyTrainingHours, neat } = input

    const maxSafeWeeklyLossKg = currentWeightKg * 0.01
    const requestedWeeklyLossKg = periodWeeks > 0 ? (currentWeightKg - targetWeightKg) / periodWeeks : 0

    let tbwKg = targetWeightKg
    let paceExceeded = false

    if (requestedWeeklyLossKg > maxSafeWeeklyLossKg) {
        paceExceeded = true
        const intermediateWeight = currentWeightKg - maxSafeWeeklyLossKg * ARAGON_INTERMEDIATE_WEEKS
        // 12週間安全ペースで進めた場合に最終目標を通り越さないようクランプ
        tbwKg = Math.max(intermediateWeight, targetWeightKg)
    }

    const tbwLbs = tbwKg * 2.2
    const targetCalories = Math.round(tbwLbs * (10 + weeklyTrainingHours) * neat)

    const protein = Math.round(tbwKg * 2.2)
    const fat = Math.round(tbwKg * 1.0)
    const proteinKcal = protein * 4
    const fatKcal = fat * 9
    const carbs = Math.max(0, Math.round((targetCalories - proteinKcal - fatKcal) / 4))

    return {
        tbwKg: Math.round(tbwKg * 10) / 10,
        paceExceeded,
        requestedWeeklyLossKg: Math.round(requestedWeeklyLossKg * 100) / 100,
        maxSafeWeeklyLossKg: Math.round(maxSafeWeeklyLossKg * 100) / 100,
        targetCalories,
        protein,
        fat,
        carbs,
    }
}
