/** Validação (Zod) compartilhada entre formulários e repositórios. */
import { z } from 'zod';
import { isValidCivilDate } from './dates.ts';
import { GOAL_FREQUENCIES, GOAL_PRIORITIES, HABIT_ICONS, MOODS } from './types.ts';

export const LIMITS = {
  title: 80,
  description: 280,
  category: 40,
  unit: 20,
  notes: 500,
  habitTitle: 60,
  displayName: 60,
} as const;

const civilDate = z.string().refine(isValidCivilDate, 'Data inválida');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const goalInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Informe um título').max(LIMITS.title, `Use no máximo ${LIMITS.title} caracteres`),
    description: optionalText(LIMITS.description),
    category: optionalText(LIMITS.category),
    startDate: civilDate,
    targetDate: civilDate,
    targetValue: z.number({ invalid_type_error: 'Informe um número' }).positive('O valor-alvo deve ser maior que zero').finite().optional(),
    currentValue: z.number({ invalid_type_error: 'Informe um número' }).min(0, 'O valor realizado não pode ser negativo').finite().optional(),
    unit: optionalText(LIMITS.unit),
    frequency: z.enum(GOAL_FREQUENCIES),
    priority: z.enum(GOAL_PRIORITIES),
  })
  .superRefine((value, ctx) => {
    if (isValidCivilDate(value.startDate) && isValidCivilDate(value.targetDate) && value.targetDate < value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['targetDate'], message: 'A data-alvo não pode ser anterior à data de início' });
    }
  });

export const checkInInputSchema = z.object({
  id: z.string().min(1).optional(),
  goalId: z.string().min(1, 'Selecione um objetivo'),
  localDate: civilDate,
  quantity: z.number({ invalid_type_error: 'Informe um número' }).finite().min(0, 'A quantidade não pode ser negativa').optional(),
  mood: z.enum(MOODS).optional(),
  notes: optionalText(LIMITS.notes),
});

export const habitInputSchema = z.object({
  title: z.string().trim().min(1, 'Informe um título').max(LIMITS.habitTitle, `Use no máximo ${LIMITS.habitTitle} caracteres`),
  icon: z.enum(HABIT_ICONS),
  recurrence: z.object({
    type: z.literal('weekly'),
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1, 'Escolha ao menos um dia da semana')
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  }),
  goalIds: z.array(z.string()).transform((ids) => [...new Set(ids)]),
  startDate: civilDate.optional(),
});

export const settingsPatchSchema = z.object({
  displayName: z.string().trim().max(LIMITS.displayName).optional(),
  timezone: z.string().min(1).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
});
