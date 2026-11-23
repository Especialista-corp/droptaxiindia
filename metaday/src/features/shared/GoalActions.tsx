import { Archive, ArchiveRestore, CircleCheckBig, Pause, Pencil, Play, RotateCcw, Star, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActions } from '@/app/model.ts';
import { notifyError, notifySuccess } from '@/app/notify.ts';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/confirm-dialog.tsx';
import { isPlanLimitError } from '@/data/errors.ts';
import type { Goal, GoalStatus } from '@/domain/types.ts';
import { useUpgradePrompt } from './UpgradeProvider.tsx';

/** Comandos de objetivo com tratamento padrão de erro e do limite do plano. */
export function useGoalCommands() {
  const actions = useActions();
  const { promptUpgrade } = useUpgradePrompt();

  const guarded = async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
    try {
      await fn();
      if (success) notifySuccess(success);
      return true;
    } catch (e) {
      if (isPlanLimitError(e)) promptUpgrade();
      else notifyError(e);
      return false;
    }
  };

  return {
    setStatus: (goal: Goal, status: GoalStatus, success: string) =>
      guarded(() => actions.setGoalStatus(goal.id, status), success),
    setPrimary: (goal: Goal) => guarded(() => actions.setPrimaryGoal(goal.id), `“${goal.title}” é seu objetivo principal.`),
    remove: (goal: Goal) => guarded(() => actions.deleteGoal(goal.id), 'Objetivo excluído.'),
  };
}

interface Item {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void | Promise<unknown>;
  tone?: 'danger';
}

/** Lista de ações disponíveis para um objetivo conforme o status. */
export function GoalActionList({ goal, onDone }: { goal: Goal; onDone?: () => void }) {
  const navigate = useNavigate();
  const commands = useGoalCommands();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const done = () => onDone?.();
  const items: Item[] = [];

  if (goal.status === 'active' && !goal.isPrimary) {
    items.push({
      key: 'primary',
      label: 'Definir como objetivo principal',
      icon: <Star className="size-4" aria-hidden />,
      onSelect: async () => {
        await commands.setPrimary(goal);
        done();
      },
    });
  }
  if (goal.status !== 'archived') {
    items.push({
      key: 'edit',
      label: 'Editar',
      icon: <Pencil className="size-4" aria-hidden />,
      onSelect: () => {
        done();
        navigate(`/metas/${goal.id}/editar`);
      },
    });
  }
  if (goal.status === 'active') {
    items.push(
      {
        key: 'complete',
        label: 'Marcar como concluído',
        icon: <CircleCheckBig className="size-4" aria-hidden />,
        onSelect: async () => {
          await commands.setStatus(goal, 'completed', 'Meta alcançada! Parabéns.');
          done();
        },
      },
      {
        key: 'pause',
        label: 'Pausar',
        icon: <Pause className="size-4" aria-hidden />,
        onSelect: async () => {
          await commands.setStatus(goal, 'paused', 'Objetivo pausado. Você pode retomá-lo quando quiser.');
          done();
        },
      },
    );
  }
  if (goal.status === 'paused') {
    items.push({
      key: 'resume',
      label: 'Retomar',
      icon: <Play className="size-4" aria-hidden />,
      onSelect: async () => {
        await commands.setStatus(goal, 'active', 'Objetivo retomado.');
        done();
      },
    });
  }
  if (goal.status === 'completed') {
    items.push({
      key: 'reopen',
      label: 'Reabrir objetivo',
      icon: <RotateCcw className="size-4" aria-hidden />,
      onSelect: async () => {
        await commands.setStatus(goal, 'active', 'Objetivo reaberto.');
        done();
      },
    });
  }
  if (goal.status === 'archived') {
    items.push({
      key: 'restore',
      label: 'Restaurar',
      icon: <ArchiveRestore className="size-4" aria-hidden />,
      onSelect: async () => {
        await commands.setStatus(goal, 'active', 'Objetivo restaurado.');
        done();
      },
    });
  } else {
    items.push({
      key: 'archive',
      label: 'Arquivar',
      icon: <Archive className="size-4" aria-hidden />,
      onSelect: async () => {
        await commands.setStatus(goal, 'archived', 'Objetivo arquivado. O histórico foi preservado.');
        done();
      },
    });
  }
  items.push({
    key: 'delete',
    label: 'Excluir…',
    icon: <Trash2 className="size-4" aria-hidden />,
    tone: 'danger',
    onSelect: () => setConfirmDelete(true),
  });

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <Button
              variant={item.tone === 'danger' ? 'danger' : 'secondary'}
              className="w-full justify-start"
              onClick={() => void item.onSelect()}
            >
              {item.icon}
              {item.label}
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir este objetivo?"
        destructive
        confirmLabel="Excluir definitivamente"
        description={
          <>
            <p>
              “{goal.title}” e todos os seus check-ins serão removidos. <strong>Esta ação não pode ser desfeita.</strong>
            </p>
            <p className="mt-2">Se você só quer tirar o objetivo da frente, prefira arquivar: o histórico é mantido.</p>
          </>
        }
        onConfirm={async () => {
          const ok = await commands.remove(goal);
          if (ok) {
            done();
            navigate('/metas');
          }
        }}
      />
    </>
  );
}
