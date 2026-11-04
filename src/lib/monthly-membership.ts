import { z } from 'zod'

export const monthlyPlanChangeSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '対象月を選択してください'),
  plan: z.string().trim().min(1, 'プランを選択してください'),
  monthlyFee: z.number().int().nonnegative().max(2147483647),
  status: z.enum(['active', 'suspended', 'withdrawn']).default('active'),
  applyScope: z.enum(['month', 'continuing']).default('month'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, '入金日を確認してください').nullish(),
  memo: z.string().nullish(),
}).superRefine((value, context) => {
  if (value.status === 'active' && ['休会', '退会'].includes(value.plan)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'プランと在籍状態を一致させてください' })
  }
  if (value.status !== 'active' && value.monthlyFee !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '休会・退会の月額費用は0円にしてください' })
  }
})

export type MonthlyPlanChange = z.infer<typeof monthlyPlanChangeSchema>
