/**
 * カロリーおよびPFC設定・調整アルゴリズム
 * 
 * 1. 初期設定: アラン・アラゴン式（Alan Aragon Method）
 * 2. 2週間評価: 停滞期および生活習慣によるアラート判定
 */

export interface DietInputs {
  targetWeightKg: number; // 目標体重 (kg)
  weeklyTrainingHours: number; // 週のトレーニング時間 (h)
  neatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'; // NEAT係数
}

export interface PFCResult {
  totalCalories: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  proteinRatio: number;
  fatRatio: number;
  carbsRatio: number;
}

export interface LifestyleScore {
  sleep: number; // 0-10
  stress: number; // 0-10
  alcohol: number; // 0-10 (低いほど良い)
  smoking: number; // 0-10 (低いほど良い)
}

export interface ProgressData {
  startWeightKg: number;
  currentWeightKg: number;
  weightHistory: number[]; // 過去14日分の体重
  lifestyleScore: LifestyleScore;
  targetLossRatePerWeek: number; // 例: 0.005 (0.5%) ～ 0.01 (1.0%)
}

export type AdjustmentType = 'STAY_COURSE' | 'REDUCE_CALORIES' | 'IMPROVE_LIFESTYLE' | 'SUCCESS';

export interface AdjustmentResult {
  type: AdjustmentType;
  message: string;
  recommendedCalories?: number;
  recommendedPFC?: PFCResult;
}

const NEAT_COEFFICIENTS = {
  LOW: 1.0,
  MEDIUM: 1.1,
  HIGH: 1.2,
  EXTREME: 1.4,
};

const LBS_PER_KG = 2.2;

/**
 * 初期カロリー・PFC算出 (アラン・アラゴン式)
 * @param inputs 目標体重、トレーニング時間、NEATレベル
 */
export function calculateInitialTarget(inputs: DietInputs): PFCResult {
  const tbwLbs = inputs.targetWeightKg * LBS_PER_KG;
  const neatMultiplier = NEAT_COEFFICIENTS[inputs.neatLevel];

  // 総カロリー計算: TBW (lbs) × (10 + 週のトレーニング時間) × NEAT係数
  const totalCalories = Math.round(tbwLbs * (10 + inputs.weeklyTrainingHours) * neatMultiplier);

  // P (タンパク質): TBW (lbs) × 1.0g
  const proteinGrams = Math.round(tbwLbs * 1.0);
  const proteinCalories = proteinGrams * 4;

  // F (脂質) の最低確保量: TBW (lbs) × 0.3g
  const minFatGrams = Math.round(tbwLbs * 0.3);
  const minFatCalories = minFatGrams * 9;

  // C (糖質) の計算: 
  // 一般的な推奨（総カロリーの 40-50% 程度、または活動量に応じた残り）
  // ここでは (総カロリー - Pカロリー) の 60% を C に、残りを F に割り当て、Fが最小値を下回らないように調整する
  let remainingCalories = totalCalories - proteinCalories;
  
  // 仮の配分: Cを優先的に確保 (残りの60%)
  let carbsCalories = Math.max(0, Math.round(remainingCalories * 0.6));
  let fatCalories = remainingCalories - carbsCalories;

  // Fが最低量を下回る場合は、Cを削ってFを補填
  if (fatCalories < minFatCalories) {
    fatCalories = minFatCalories;
    carbsCalories = Math.max(0, totalCalories - proteinCalories - fatCalories);
  }

  const fatGrams = Math.round(fatCalories / 9);
  const carbsGrams = Math.round(carbsCalories / 4);

  return {
    totalCalories,
    proteinGrams,
    fatGrams,
    carbsGrams,
    proteinRatio: Math.round((proteinCalories / totalCalories) * 100),
    fatRatio: Math.round((fatCalories / totalCalories) * 100),
    carbsRatio: Math.round((carbsCalories / totalCalories) * 100),
  };
}

/**
 * 2週間ごとの進捗評価と調整アラート
 * @param progress 過去の体重データ、ライフスタイルスコア
 * @param currentPFC 現在設定されているPFC
 */
export function evaluateProgress(
  progress: ProgressData,
  currentPFC: PFCResult
): AdjustmentResult {
  const { weightHistory, lifestyleScore, targetLossRatePerWeek } = progress;
  
  if (weightHistory.length < 14) {
    return {
      type: 'STAY_COURSE',
      message: 'データが不足しています（最低2週間分のデータが必要です）。'
    };
  }

  // 1週目の平均と2週目の平均を比較
  const week1 = weightHistory.slice(0, 7);
  const week2 = weightHistory.slice(7, 14);
  
  const avgWeight1 = week1.reduce((a, b) => a + b, 0) / 7;
  const avgWeight2 = week2.reduce((a, b) => a + b, 0) / 7;
  
  const actualLossRate = (avgWeight1 - avgWeight2) / avgWeight1; // 週あたりの減少率

  // 総合的なライフスタイルスコア (0-100点満点)
  // 睡眠、ストレスは高いほうが良く、酒・タバコは低いほうが良い
  const normalizedLifestyleScore = (
    lifestyleScore.sleep * 2.5 + // 10 -> 25
    lifestyleScore.stress * 2.5 + // 10 -> 25
    (10 - lifestyleScore.alcohol) * 2.5 + // 0 -> 25
    (10 - lifestyleScore.smoking) * 2.5   // 0 -> 25
  );

  const IS_STAGNANT = actualLossRate < targetLossRatePerWeek;
  const IS_LIFESTYLE_GOOD = normalizedLifestyleScore >= 70; // 70点以上を良好と判定

  // 条件1: 純粋な停滞期 (落ち幅不足 且つ 生活習慣良好)
  if (IS_STAGNANT && IS_LIFESTYLE_GOOD) {
    const newTotalCalories = Math.round(currentPFC.totalCalories * 0.9);
    
    // Pは固定 (tbw * 1.0g なので基本変わらないが、既存のPを維持)
    const proteinCalories = currentPFC.proteinGrams * 4;
    let remainingCalories = newTotalCalories - proteinCalories;
    
    // 既存のF:Cの比率を維持して削減
    const currentFcRatio = currentPFC.fatGrams * 9 / (currentPFC.fatGrams * 9 + currentPFC.carbsGrams * 4);
    let newFatCalories = Math.round(remainingCalories * currentFcRatio);
    let newCarbsCalories = remainingCalories - newFatCalories;

    // Fの最低ラインチェック (あらかじめ計算した proteinGrams のベースとなっている TBW (lbs) * 0.3g を想定)
    // 簡略化のため、元のPFCからPの値を使い、TBWを逆算して0.3g/lbを確保
    const tbwLbs = currentPFC.proteinGrams;
    const minFatGrams = Math.round(tbwLbs * 0.3);
    const minFatCalories = minFatGrams * 9;

    if (newFatCalories < minFatCalories) {
      newFatCalories = minFatCalories;
      newCarbsCalories = Math.max(0, remainingCalories - newFatCalories);
    }

    const newResult: PFCResult = {
      totalCalories: newTotalCalories,
      proteinGrams: currentPFC.proteinGrams,
      fatGrams: Math.round(newFatCalories / 9),
      carbsGrams: Math.round(newCarbsCalories / 4),
      proteinRatio: Math.round((proteinCalories / newTotalCalories) * 100),
      fatRatio: Math.round((newFatCalories / newTotalCalories) * 100),
      carbsRatio: Math.round((newCarbsCalories / newTotalCalories) * 100),
    };

    return {
      type: 'REDUCE_CALORIES',
      message: '【停滞期判定】体重の減少が目標を下回っていますが、生活習慣は良好です。摂取カロリーを10%削減することを推奨します。',
      recommendedCalories: newTotalCalories,
      recommendedPFC: newResult
    };
  }

  // 条件2: 生活習慣の乱れ (落ち幅不足 且つ 生活習慣不良)
  if (IS_STAGNANT && !IS_LIFESTYLE_GOOD) {
    return {
      type: 'IMPROVE_LIFESTYLE',
      message: '【要生活改善】体重が停滞していますが、睡眠不足やストレス、アルコール等の影響が懸念されます。カロリー変更の前に生活習慣の改善を指導してください。'
    };
  }

  // 順調な場合
  if (actualLossRate >= targetLossRatePerWeek) {
    return {
      type: 'SUCCESS',
      message: '順調に体重が減少しています。現在のプランを継続しましょう。'
    };
  }

  return {
    type: 'STAY_COURSE',
    message: '現状維持で様子を見ましょう。'
  };
}
