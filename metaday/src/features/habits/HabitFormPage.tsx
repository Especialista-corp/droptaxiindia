import { Archive, ArchiveRestore, Pause, Play, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActions, useAppModel } from '@/app/model.ts';
import { notifyError, notifySuccess } from '@/app/notify.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, SectionTitle } from '@/components/ui/card.tsx';
import { ConfirmDialog } from '@/components/ui/confirm-dialog.tsx';
import { Field, Input } from '@/components/ui/field.tsx';
import { EmptyState, PageHeader } from '@/components/ui/page.tsx';
import { orderedWeekdays, WEEKDAY_LABELS_LONG, WEEKDAY_LABELS_SHORT } from '@/domain/dates.ts';
import { ALL_DAYS, WEEKDAYS_ONLY, WEEKEND_ONLY } from '@/domain/habits.ts';
import { habitInputSchema, LIMITS } from '@/domain/schemas.ts';
import { HABIT_ICONS, type Habit, type HabitIcon } from '@/domain/types.ts';
import { cn } from '@/lib/utils.ts';
import { HABIT_ICON_COMPONENTS, HABIT_ICON_LABELS } from './habitIcons.ts';

export function HabitFormPage() {
  const { id } = useParams();
  const model = useAppModel();
  if (!model) return <p role="status" className="text-sm text-muted">Carregando…</p>;
  if (id) {
    const habit = model.snapshot.habits.find((h) => h.id === id);
    if (!habit) {
      return (
        <EmptyState title="Hábito não encontrado">
          <Button asChild>
            <Link to="/habitos">Voltar para hábitos</Link>
          </Button>
        </EmptyState>
      );
    }
    return <HabitForm key={habit.id} existing={habit} />;
  }
  return <HabitForm />;
}

const PRESETS: { label: string; days: number[] }[] = [
  { label: 'Todos os dias', days: ALL_DAYS },
  { label: 'Dias úteis', days: WEEKDAYS_ONLY },
  { label: 'Fins de semana', days: WEEKEND_ONLY },
];

function sameDays(a: number[], b: number[]): boolean {
  return [...a].sort().join(',') === [...b].sort().join(',');
}

function HabitForm({ existing }: { existing?: Habit }) {
  const model = useAppModel()!;
  const actions = useActions();
  const navigate = useNavigate();
  const editing = !!existing;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [icon, setIcon] = useState<HabitIcon>(existing?.icon ?? 'target');
  const [days, setDays] = useState<number[]>(existing?.recurrence.days ?? ALL_DAYS);
  const [goalIds, setGoalIds] = useState<string[]>(existing?.goalIds ?? []);
  const [errors, setErrors] = useState<{ title?: string; days?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const linkable = model.goals.filter((g) => g.status !== 'archived');
  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const toggleGoal = (id: string) => setGoalIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const parsed = habitInputSchema.safeParse({ title, icon, recurrence: { type: 'weekly', days }, goalIds });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'title') next.title ??= issue.message;
        if (issue.path[0] === 'recurrence') next.days ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      if (editing) {
        await actions.updateHabit(existing!.id, parsed.data);
        notifySuccess('Hábito atualizado.');
      } else {
        await actions.createHabit(parsed.data);
        notifySuccess('Hábito criado.');
      }
      navigate('/habitos');
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const setStatus = async (status: Habit['status'], message: string) => {
    try {
      await actions.setHabitStatus(existing!.id, status);
      notifySuccess(message);
      navigate('/habitos');
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={editing ? 'Editar hábito' : 'Novo hábito'} back={{ to: '/habitos', label: 'Hábitos' }} />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field label="Título" error={errors.title}>
          {(c) => (
            <Input
              {...c}
              value={title}
              maxLength={LIMITS.habitTitle + 20}
              autoComplete="off"
              placeholder="Ex.: Caminhar 30 minutos"
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Ícone</legend>
          <div role="radiogroup" aria-label="Ícone do hábito" className="grid grid-cols-6 gap-2">
            {HABIT_ICONS.map((key) => {
              const Icon = HABIT_ICON_COMPONENTS[key];
              const active = icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={HABIT_ICON_LABELS[key]}
                  title={HABIT_ICON_LABELS[key]}
                  onClick={() => setIcon(key)}
                  className={cn(
                    'grid min-h-11 place-items-center rounded-xl border transition-colors',
                    active ? 'border-accent bg-accent/15 text-accent' : 'border-border-strong bg-card text-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Recorrência</legend>
          <div className="mb-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={sameDays(days, p.days)}
                onClick={() => setDays(p.days)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors',
                  sameDays(days, p.days)
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border-strong bg-card text-muted hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Dias da semana">
            {orderedWeekdays(model.snapshot.settings.weekStartsOn).map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'min-h-11 rounded-xl border text-xs font-bold transition-colors',
                    on ? 'border-accent bg-accent text-accent-foreground' : 'border-border-strong bg-card text-muted hover:text-foreground',
                  )}
                >
                  {WEEKDAY_LABELS_SHORT[d]}
                  {/* O nome completo entra DEPOIS do texto visível, para o nome acessível começar com ele (WCAG 2.5.3). */}
                  <span className="sr-only"> ({WEEKDAY_LABELS_LONG[d]})</span>
                </button>
              );
            })}
          </div>
          {errors.days && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {errors.days}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">Dias fora da recorrência não contam como falta.</p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            Objetivos vinculados <span className="font-normal text-dim">(opcional)</span>
          </legend>
          {linkable.length === 0 ? (
            <p className="text-sm text-muted">Você ainda não tem objetivos para vincular.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {linkable.map((g) => (
                <li key={g.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 accent-[#E9AE12]"
                      checked={goalIds.includes(g.id)}
                      onChange={() => toggleGoal(g.id)}
                    />
                    <span className="min-w-0 break-words">{g.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" asChild>
            <Link to="/habitos">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {editing ? 'Salvar alterações' : 'Criar hábito'}
          </Button>
        </div>
      </form>

      {editing && (
        <Card className="flex flex-col gap-2">
          <SectionTitle>Gerenciar</SectionTitle>
          {existing!.status === 'active' && (
            <Button variant="secondary" className="justify-start" onClick={() => void setStatus('paused', 'Hábito pausado. Os dias em pausa não contam como falta.')}>
              <Pause className="size-4" aria-hidden /> Pausar
            </Button>
          )}
          {existing!.status === 'paused' && (
            <Button variant="secondary" className="justify-start" onClick={() => void setStatus('active', 'Hábito retomado.')}>
              <Play className="size-4" aria-hidden /> Retomar
            </Button>
          )}
          {existing!.status === 'archived' ? (
            <Button variant="secondary" className="justify-start" onClick={() => void setStatus('active', 'Hábito restaurado.')}>
              <ArchiveRestore className="size-4" aria-hidden /> Restaurar
            </Button>
          ) : (
            <Button variant="secondary" className="justify-start" onClick={() => void setStatus('archived', 'Hábito arquivado. O histórico foi mantido.')}>
              <Archive className="size-4" aria-hidden /> Arquivar
            </Button>
          )}
          <Button variant="danger" className="justify-start" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden /> Excluir…
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="Excluir este hábito?"
            destructive
            confirmLabel="Excluir definitivamente"
            description={
              <p>
                “{existing!.title}” e todo o seu histórico de registros serão removidos. <strong>Esta ação não pode ser desfeita.</strong>{' '}
                Se preferir manter o histórico, arquive o hábito.
              </p>
            }
            onConfirm={async () => {
              try {
                await actions.deleteHabit(existing!.id);
                notifySuccess('Hábito excluído.');
                navigate('/habitos');
              } catch (err) {
                notifyError(err);
              }
            }}
          />
        </Card>
      )}
    </div>
  );
}
