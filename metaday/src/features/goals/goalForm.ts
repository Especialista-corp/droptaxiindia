import { z } from 'zod';
import { isValidCivilDate } from '@/domain/dates.ts';
import { UNIT_PRESETS } from '@/domain/format.ts';
import { LIMITS } from '@/domain/schemas.ts';
import { GOAL_FREQUENCIES, GOAL_PRIORITIES, type Goal, type GoalInput } from '@/domain/types.ts';

/** Aceita "1.234,5", "1234,5" e "1234.5". Retorna undefined se vazio e NaN se inválido. */
export function parseDecimal(raw: string): number | undefined {
  const text = raw.trim();
  if (text === '') return undefined;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

export const goalFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Informe um título').max(LIMITS.title, `Use no máximo ${LIMITS.title} caracteres`),
    description: z.string().max(LIMITS.description, `Use no máximo ${LIMITS.description} caracteres`),
    category: z.string().max(LIMITS.category, `Use no máximo ${LIMITS.category} caracteres`),
    startDate: z.string().refine(isValidCivilDate, 'Informe uma data válida'),
    targetDate: z.string().refine(isValidCivilDate, 'Informe uma data válida'),
    unitChoice: z.string(),
    customUnit: z.string().max(LIMITS.unit, `Use no máximo ${LIMITS.unit} caracteres`),
    targetValue: z.string(),
    currentValue: z.string(),
    frequency: z.enum(GOAL_FREQUENCIES),
    priority: z.enum(GOAL_PRIORITIES),
  })
  .superRefine((v, ctx) => {
    if (isValidCivilDate(v.startDate) && isValidCivilDate(v.targetDate) && v.targetDate < v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['targetDate'], message: 'A data-alvo não pode ser anterior à data de início' });
    }
    const target = parseDecimal(v.targetValue);
    if (target !== undefined && (Number.isNaN(target) || target <= 0)) {
      ctx.addIssue({ code: 'custom', path: ['targetValue'], message: 'Informe um número maior que zero' });
    }
    const current = parseDecimal(v.currentValue);
    if (current !== undefined && (Number.isNaN(current) || current < 0)) {
      ctx.addIssue({ code: 'custom', path: ['currentValue'], message: 'Informe um número igual ou maior que zero' });
    }
    if (v.unitChoice === 'custom' && v.customUnit.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['customUnit'], message: 'Informe a unidade personalizada' });
    }
  });

export type GoalFormValues = z.infer<typeof goalFormSchema>;

export function goalToFormValues(goal: Goal): GoalFormValues {
  const preset = (UNIT_PRESETS as readonly string[]).includes(goal.unit ?? '');
  return {
    title: goal.title,
    description: goal.description ?? '',
    category: goal.category ?? '',
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    unitChoice: goal.unit ? (preset ? goal.unit : 'custom') : 'none',
    customUnit: goal.unit && !preset ? goal.unit : '',
    targetValue: goal.targetValue !== undefined ? String(goal.targetValue).replace('.', ',') : '',
    currentValue: String(goal.currentValue).replace('.', ','),
    frequency: goal.frequency,
    priority: goal.priority,
  };
}

export function formValuesToGoalInput(v: GoalFormValues): GoalInput {
  const unit = v.unitChoice === 'none' ? undefined : v.unitChoice === 'custom' ? v.customUnit.trim() : v.unitChoice;
  return {
    title: v.title.trim(),
    description: v.description.trim() || undefined,
    category: v.category.trim() || undefined,
    startDate: v.startDate,
    targetDate: v.targetDate,
    targetValue: parseDecimal(v.targetValue),
    currentValue: parseDecimal(v.currentValue) ?? 0,
    unit,
    frequency: v.frequency,
    priority: v.priority,
  };
}
