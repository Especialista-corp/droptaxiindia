import { zodResolver } from '@hookform/resolvers/zod';
import { Annoyed, CircleCheck, Frown, Laugh, Meh, Pencil, Smile, Trash2, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useActions, useAppModel, type AppModel } from '@/app/model.ts';
import { notifyError, notifySuccess } from '@/app/notify.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, SectionTitle } from '@/components/ui/card.tsx';
import { ConfirmDialog } from '@/components/ui/confirm-dialog.tsx';
import { Field, Input, Select, Textarea } from '@/components/ui/field.tsx';
import { EmptyState, PageHeader } from '@/components/ui/page.tsx';
import { isPlanLimitError } from '@/data/errors.ts';
import { formatCivilPt, isValidCivilDate } from '@/domain/dates.ts';
import { formatProgressText, formatQuantity, MOOD_LABELS } from '@/domain/format.ts';
import { LIMITS } from '@/domain/schemas.ts';
import { MOODS, type CheckIn, type Goal, type Mood } from '@/domain/types.ts';
import { parseDecimal } from '@/features/goals/goalForm.ts';
import { useGoalCommands } from '@/features/shared/GoalActions.tsx';
import { useUpgradePrompt } from '@/features/shared/UpgradeProvider.tsx';
import { cn, newId } from '@/lib/utils.ts';

const MOOD_ICONS: Record<Mood, LucideIcon> = {
  very_low: Frown,
  low: Annoyed,
  neutral: Meh,
  good: Smile,
  great: Laugh,
};

const checkInFormSchema = z.object({
  goalId: z.string().min(1, 'Selecione um objetivo'),
  date: z.string().refine(isValidCivilDate, 'Informe uma data válida'),
  quantity: z.string(),
  mood: z.string(),
  notes: z.string().max(LIMITS.notes, `Use no máximo ${LIMITS.notes} caracteres`),
});
type CheckInFormValues = z.infer<typeof checkInFormSchema>;

export function CheckInPage() {
  const model = useAppModel();
  const [params, setParams] = useSearchParams();
  if (!model) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  const editId = params.get('editar');
  const editing = editId ? model.snapshot.checkIns.find((c) => c.id === editId) : undefined;

  if (model.activeGoals.length === 0 && !editing) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Check-in" />
        <EmptyState title="Você ainda não tem um objetivo ativo">
          <p className="max-w-xs">Crie um objetivo (ou reative um pausado) para registrar sua atividade.</p>
          <Button asChild>
            <Link to="/metas/nova">Criar objetivo</Link>
          </Button>
        </EmptyState>
        <RecentCheckIns model={model} onEdit={(id) => setParams({ editar: id })} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={editing ? 'Corrigir check-in' : 'Check-in'}
        subtitle={editing ? 'Altere os dados e salve a correção.' : 'Registre o que você fez. Quantidade, humor e anotação são opcionais.'}
      />
      <CheckInForm
        key={editing?.id ?? `new-${params.get('meta') ?? ''}-${params.get('data') ?? ''}`}
        model={model}
        editing={editing}
        initialGoalId={params.get('meta') ?? undefined}
        initialDate={params.get('data') ?? undefined}
        onFinishedEditing={() => setParams({})}
      />
      <RecentCheckIns model={model} onEdit={(id) => setParams({ editar: id })} />
    </div>
  );
}

function CheckInForm({
  model,
  editing,
  initialGoalId,
  initialDate,
  onFinishedEditing,
}: {
  model: AppModel;
  editing?: CheckIn;
  initialGoalId?: string;
  initialDate?: string;
  onFinishedEditing: () => void;
}) {
  const actions = useActions();
  const commands = useGoalCommands();
  const navigate = useNavigate();
  const { promptUpgrade } = useUpgradePrompt();
  // Id gerado ao abrir o formulário: reenvios (duplo toque) apontam para o MESMO registro.
  const clientId = useRef(newId());
  const [saved, setSaved] = useState<{ goalId: string; quantity?: number } | null>(null);
  const [reachedGoal, setReachedGoal] = useState<Goal | null>(null);

  // Opções de objetivo: ativos (e o do check-in em edição, mesmo que não esteja mais ativo).
  const options = model.goals.filter((g) => g.status === 'active' || g.id === editing?.goalId);
  const preferred =
    options.find((g) => g.id === (editing?.goalId ?? initialGoalId) && (g.status === 'active' || editing)) ??
    options.find((g) => g.id === model.primary?.id && g.status === 'active') ??
    options[0];
  const initialDay = initialDate && isValidCivilDate(initialDate) && initialDate <= model.today ? initialDate : model.today;

  const { register, handleSubmit, control, watch, reset, formState, setError } = useForm<CheckInFormValues>({
    resolver: zodResolver(checkInFormSchema),
    defaultValues: {
      goalId: preferred?.id ?? '',
      date: editing?.localDate ?? initialDay,
      quantity: editing?.quantity !== undefined ? String(editing.quantity).replace('.', ',') : '',
      mood: editing?.mood ?? '',
      notes: editing?.notes ?? '',
    },
  });
  const { errors, isSubmitting } = formState;
  const goalId = watch('goalId');
  const selected = model.goals.find((g) => g.id === goalId);
  const notesLength = watch('notes').length;

  const onSubmit = handleSubmit(async (values) => {
    const quantity = parseDecimal(values.quantity);
    if (quantity !== undefined && (Number.isNaN(quantity) || quantity < 0)) {
      setError('quantity', { message: 'Informe um número igual ou maior que zero' });
      return;
    }
    if (values.date > model.today) {
      setError('date', { message: 'A data do check-in não pode ser futura' });
      return;
    }
    const payload = {
      goalId: values.goalId,
      localDate: values.date,
      quantity,
      mood: (values.mood || undefined) as Mood | undefined,
      notes: values.notes.trim() || undefined,
    };
    try {
      if (editing) {
        await actions.updateCheckIn(editing.id, payload);
        notifySuccess('Check-in corrigido.');
        onFinishedEditing();
        return;
      }
      await actions.createCheckIn({ id: clientId.current, ...payload });
      const goal = model.goals.find((g) => g.id === values.goalId);
      if (
        goal &&
        goal.status === 'active' &&
        goal.targetValue !== undefined &&
        quantity &&
        goal.currentValue < goal.targetValue &&
        goal.currentValue + quantity >= goal.targetValue
      ) {
        setReachedGoal(goal);
      }
      setSaved({ goalId: values.goalId, quantity });
      notifySuccess('Check-in registrado!');
    } catch (e) {
      if (isPlanLimitError(e)) promptUpgrade();
      else notifyError(e);
    }
  });

  if (saved) {
    const goal = model.goals.find((g) => g.id === saved.goalId);
    return (
      <>
        <Card className="flex flex-col items-center gap-3 p-6 text-center" role="status" data-testid="checkin-confirmation">
          <CircleCheck className="size-12 text-accent" aria-hidden />
          <h2 className="text-xl font-bold">Check-in registrado!</h2>
          {goal && (
            <p className="tabular text-sm text-muted">
              {goal.title}
              {goal.targetValue !== undefined && <> · {formatProgressText(goal.currentValue, goal.targetValue, goal.unit)}</>}
            </p>
          )}
          <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() => {
                clientId.current = newId();
                setSaved(null);
                reset({ goalId: goal?.id ?? '', date: model.today, quantity: '', mood: '', notes: '' });
              }}
            >
              Registrar outro
            </Button>
            <Button onClick={() => navigate('/')}>Voltar ao início</Button>
          </div>
        </Card>
        <ConfirmDialog
          open={reachedGoal !== null}
          onOpenChange={(open) => !open && setReachedGoal(null)}
          title="Você atingiu o valor-alvo!"
          cancelLabel="Ainda não"
          confirmLabel="Concluir objetivo"
          description={
            <p>
              “{reachedGoal?.title}” chegou ao valor-alvo. Quer marcá-lo como concluído? Você também pode continuar registrando
              e concluir depois.
            </p>
          }
          onConfirm={async () => {
            if (reachedGoal) await commands.setStatus(reachedGoal, 'completed', 'Meta alcançada! Parabéns.');
          }}
        />
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label={editing ? 'Corrigir check-in' : 'Novo check-in'}>
      <Field label="Objetivo" error={errors.goalId?.message}>
        {(c) => (
          <Select {...c} {...register('goalId')}>
            {options.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
                {g.status !== 'active' ? ' (inativo)' : ''}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label={selected?.unit ? `Quantidade (${selected.unit})` : 'Quantidade'}
          optional
          error={errors.quantity?.message}
          hint={selected?.targetValue !== undefined ? 'Soma ao valor realizado do objetivo.' : 'Sem valor-alvo, a quantidade fica só no histórico.'}
        >
          {(c) => <Input {...c} inputMode="decimal" autoComplete="off" placeholder="Ex.: 5" {...register('quantity')} />}
        </Field>
        <Field label="Data" error={errors.date?.message}>
          {(c) => <Input {...c} type="date" max={model.today} {...register('date')} />}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">
          Como você se sentiu? <span className="font-normal text-dim">(opcional)</span>
        </legend>
        <Controller
          control={control}
          name="mood"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Humor" className="grid grid-cols-5 gap-2">
              {MOODS.map((m) => {
                const Icon = MOOD_ICONS[m];
                const active = field.value === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => field.onChange(active ? '' : m)}
                    className={cn(
                      'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-semibold transition-colors',
                      active ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong bg-card text-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                    {MOOD_LABELS[m]}
                  </button>
                );
              })}
            </div>
          )}
        />
      </fieldset>

      <Field label="Anotação" optional error={errors.notes?.message} hint={`${notesLength}/${LIMITS.notes}`}>
        {(c) => <Textarea {...c} rows={3} placeholder="Como foi hoje?" {...register('notes')} />}
      </Field>

      <div className={cn('grid gap-2 pt-1', editing ? 'grid-cols-2' : 'grid-cols-1')}>
        {editing && (
          <Button variant="outline" onClick={onFinishedEditing}>
            Cancelar
          </Button>
        )}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : editing ? 'Salvar correção' : 'Registrar check-in'}
        </Button>
      </div>
    </form>
  );
}

function RecentCheckIns({ model, onEdit }: { model: AppModel; onEdit: (id: string) => void }) {
  const actions = useActions();
  const [toDelete, setToDelete] = useState<CheckIn | null>(null);
  const recent = [...model.snapshot.checkIns]
    .sort((a, b) => b.localDate.localeCompare(a.localDate) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  if (recent.length === 0) return null;
  const titleOf = (id: string) => model.goals.find((g) => g.id === id);

  return (
    <section aria-labelledby="recentes" className="flex flex-col gap-2">
      <SectionTitle id="recentes">Registros recentes</SectionTitle>
      <ul className="flex flex-col gap-2">
        {recent.map((c) => {
          const goal = titleOf(c.goalId);
          return (
            <li key={c.id} className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2.5" data-testid="recent-checkin">
              <div className="min-w-0 flex-1 text-sm">
                <p className="break-words font-semibold text-foreground">{goal?.title ?? 'Objetivo removido'}</p>
                <p className="tabular text-xs text-muted">
                  {formatCivilPt(c.localDate)}
                  {c.quantity !== undefined && ` · ${formatQuantity(c.quantity, goal?.unit)}`}
                  {c.mood && ` · ${MOOD_LABELS[c.mood]}`}
                </p>
                {c.notes && <p className="mt-1 break-words text-xs text-muted">{c.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => onEdit(c.id)}
                aria-label={`Corrigir check-in de ${formatCivilPt(c.localDate)}`}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-card-2 hover:text-foreground"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setToDelete(c)}
                aria-label={`Excluir check-in de ${formatCivilPt(c.localDate)}`}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-card-2 hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir este check-in?"
        destructive
        confirmLabel="Excluir"
        description={
          <p>
            O registro de {toDelete ? formatCivilPt(toDelete.localDate) : ''} será removido e o valor realizado do objetivo será
            ajustado.
          </p>
        }
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await actions.deleteCheckIn(toDelete.id);
            notifySuccess('Check-in excluído.');
          } catch (e) {
            notifyError(e);
          }
        }}
      />
    </section>
  );
}
