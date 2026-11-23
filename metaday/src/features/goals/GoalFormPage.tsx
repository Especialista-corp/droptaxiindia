import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useNow } from '@/app/clock.tsx';
import { useActions, useAppModel } from '@/app/model.ts';
import { notifyError, notifySuccess } from '@/app/notify.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import { Field, Input, Select, Textarea } from '@/components/ui/field.tsx';
import { EmptyState, PageHeader } from '@/components/ui/page.tsx';
import { isPlanLimitError } from '@/data/errors.ts';
import { describeCountdown, getCountdown } from '@/domain/countdown.ts';
import { addDays, formatCivilPt, isValidCivilDate } from '@/domain/dates.ts';
import { FREQUENCY_LABELS, PRIORITY_LABELS, UNIT_PRESETS } from '@/domain/format.ts';
import { LIMITS } from '@/domain/schemas.ts';
import { GOAL_FREQUENCIES, GOAL_PRIORITIES, type Goal } from '@/domain/types.ts';
import { useUpgradePrompt } from '@/features/shared/UpgradeProvider.tsx';
import { formValuesToGoalInput, goalFormSchema, goalToFormValues, type GoalFormValues } from './goalForm.ts';

const CATEGORY_SUGGESTIONS = ['Saúde', 'Finanças', 'Estudos', 'Carreira', 'Pessoal', 'Família', 'Lazer'];

export function GoalFormPage() {
  const { id } = useParams();
  const model = useAppModel();
  if (!model) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  if (id) {
    const goal = model.goals.find((g) => g.id === id);
    if (!goal || goal.status === 'archived') {
      return (
        <EmptyState title={goal ? 'Restaure o objetivo para editá-lo' : 'Objetivo não encontrado'}>
          <Button asChild>
            <Link to="/metas">Voltar para meus objetivos</Link>
          </Button>
        </EmptyState>
      );
    }
    return <GoalForm key={goal.id} existing={goal} />;
  }
  return model.canAddGoal ? <GoalForm /> : <LimitReached />;
}

function LimitReached() {
  const { promptUpgrade } = useUpgradePrompt();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Novo objetivo" back={{ to: '/metas', label: 'Meus objetivos' }} />
      <EmptyState title="Limite do plano Grátis atingido">
        <p className="max-w-xs">
          Você já tem 3 objetivos ativos. Conclua, pause ou arquive um deles para criar outro — nada é apagado.
        </p>
        <Button onClick={promptUpgrade}>Entender as opções</Button>
      </EmptyState>
    </div>
  );
}

function GoalForm({ existing }: { existing?: Goal }) {
  const model = useAppModel()!;
  const actions = useActions();
  const navigate = useNavigate();
  const { promptUpgrade } = useUpgradePrompt();
  const now = useNow(60_000);

  const editing = !!existing;
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: existing
      ? goalToFormValues(existing)
      : {
          title: '',
          description: '',
          category: '',
          startDate: model.today,
          targetDate: addDays(model.today, 30),
          unitChoice: 'none',
          customUnit: '',
          targetValue: '',
          currentValue: '0',
          frequency: 'weekly',
          priority: 'medium',
        },
  });
  const { register, handleSubmit, formState, control } = form;
  const { errors, isSubmitting } = formState;
  const watched = useWatch({ control });

  const previewTitle = watched.title?.trim() || (editing ? existing!.title : 'Seu objetivo');
  const previewDate = watched.targetDate && isValidCivilDate(watched.targetDate) ? watched.targetDate : null;
  const previewCountdown = previewDate ? getCountdown(previewDate, now, model.tz) : null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input = formValuesToGoalInput(values);
      if (editing) {
        await actions.updateGoal(existing!.id, input);
        notifySuccess('Objetivo atualizado.');
        navigate(`/metas/${existing!.id}`);
      } else {
        const created = await actions.createGoal(input);
        notifySuccess('Objetivo criado.');
        navigate(created.isPrimary ? '/' : '/metas');
      }
    } catch (e) {
      if (isPlanLimitError(e)) promptUpgrade();
      else notifyError(e);
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={editing ? 'Editar objetivo' : 'Novo objetivo'}
        back={editing ? { to: `/metas/${existing!.id}`, label: 'Voltar ao objetivo' } : { to: '/metas', label: 'Meus objetivos' }}
      />

      <Card aria-label="Prévia do objetivo" className="flex flex-col gap-1 border-accent/30" data-testid="goal-preview">
        <Badge tone="accent" className="self-start">
          Prévia
        </Badge>
        <p className="break-words text-lg font-bold text-foreground">{previewTitle}</p>
        <p className="tabular text-sm text-muted">
          {previewDate ? `Data-alvo: ${formatCivilPt(previewDate)}` : 'Informe uma data-alvo válida'}
          {previewCountdown && ` · ${describeCountdown(previewCountdown)}`}
        </p>
      </Card>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Título" error={errors.title?.message}>
          {(c) => <Input {...c} maxLength={LIMITS.title + 20} placeholder="Ex.: Correr 10 km" autoComplete="off" {...register('title')} />}
        </Field>
        <Field label="Descrição" optional error={errors.description?.message}>
          {(c) => <Textarea {...c} rows={3} {...register('description')} />}
        </Field>
        <Field label="Categoria" optional error={errors.category?.message}>
          {(c) => (
            <>
              <Input {...c} list="categorias" autoComplete="off" placeholder="Ex.: Saúde" {...register('category')} />
              <datalist id="categorias">
                {CATEGORY_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data de início" error={errors.startDate?.message}>
            {(c) => <Input {...c} type="date" {...register('startDate')} />}
          </Field>
          <Field label="Data-alvo" error={errors.targetDate?.message} hint="O dia-alvo conta: o prazo termina às 23:59 desse dia.">
            {(c) => <Input {...c} type="date" {...register('targetDate')} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Unidade" optional>
            {(c) => (
              <Select {...c} {...register('unitChoice')}>
                <option value="none">Sem unidade</option>
                {UNIT_PRESETS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="custom">Personalizada…</option>
              </Select>
            )}
          </Field>
          {watched.unitChoice === 'custom' && (
            <Field label="Unidade personalizada" error={errors.customUnit?.message}>
              {(c) => <Input {...c} placeholder="Ex.: páginas" autoComplete="off" {...register('customUnit')} />}
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Valor-alvo"
            optional
            error={errors.targetValue?.message}
            hint="Sem valor-alvo não calculamos o progresso nem o ritmo."
          >
            {(c) => <Input {...c} inputMode="decimal" placeholder="Ex.: 150" autoComplete="off" {...register('targetValue')} />}
          </Field>
          <Field label="Valor realizado" optional error={errors.currentValue?.message} hint="Quanto você já realizou.">
            {(c) => <Input {...c} inputMode="decimal" autoComplete="off" {...register('currentValue')} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Frequência">
            {(c) => (
              <Select {...c} {...register('frequency')}>
                {GOAL_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Prioridade">
            {(c) => (
              <Select {...c} {...register('priority')}>
                {GOAL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" asChild>
            <Link to={editing ? `/metas/${existing!.id}` : '/metas'}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {editing ? 'Salvar alterações' : 'Criar objetivo'}
          </Button>
        </div>
      </form>
    </div>
  );
}
