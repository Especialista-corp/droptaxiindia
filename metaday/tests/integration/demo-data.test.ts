import { describe, expect, it } from 'vitest';
import { evaluateGoal } from '@/domain/progress.ts';
import { countActiveGoals } from '@/domain/plan.ts';
import { goalInput, makeLayer, TODAY } from '../helpers.ts';

describe('dados de demonstração', () => {
  it('seed: 3 ativas + 1 concluída com prazo futuro + 1 arquivada; exatamente um principal', async () => {
    const data = await makeLayer({ mode: 'demo' });
    expect(await data.admin.isEmpty()).toBe(true);
    await data.admin.seedDemo();
    const goals = await data.goals.list();
    expect(goals).toHaveLength(5);
    expect(countActiveGoals(goals)).toBe(3);
    expect(goals.filter((g) => g.isPrimary)).toHaveLength(1);
    expect(goals.find((g) => g.isPrimary)!.status).toBe('active');
    const done = goals.find((g) => g.status === 'completed')!;
    expect(done.targetDate > TODAY).toBe(true);
    expect(evaluateGoal(done, TODAY).status).toBe('completed');
    expect((await data.subscription.get()).plan).toBe('free');
    // FREE no limite: a quarta ativa é bloqueada também na demonstração
    await expect(data.goals.create(goalInput())).rejects.toThrow(/até 3 objetivos ativos/);
  });

  it('seed: o valor realizado de cada meta corresponde à soma dos check-ins', async () => {
    const data = await makeLayer({ mode: 'demo' });
    await data.admin.seedDemo();
    const [goals, checkIns] = await Promise.all([data.goals.list(), data.checkIns.list()]);
    for (const g of goals) {
      const sum = checkIns.filter((c) => c.goalId === g.id).reduce((acc, c) => acc + (c.quantity ?? 0), 0);
      expect(g.currentValue).toBe(sum);
    }
  });

  it('seed: há ao menos uma meta "no ritmo" e uma "em risco" para demonstrar os filtros', async () => {
    const data = await makeLayer({ mode: 'demo' });
    await data.admin.seedDemo();
    const statuses = (await data.goals.list()).filter((g) => g.status === 'active').map((g) => evaluateGoal(g, TODAY).status);
    expect(statuses).toContain('on_track');
    expect(statuses).toContain('at_risk');
  });

  it('restaurar a demonstração descarta alterações da demo e restaura somente dados demo', async () => {
    const data = await makeLayer({ mode: 'demo' });
    await data.admin.seedDemo();
    const original = await data.goals.list();
    await data.subscription.setPlan('premium');
    await data.goals.create(goalInput({ title: 'Extra da demo' }));
    await data.goals.remove(original[0]!.id);
    await data.admin.seedDemo();
    const restored = await data.goals.list();
    expect(restored.map((g) => g.id).sort()).toEqual(original.map((g) => g.id).sort());
    expect(restored.some((g) => g.title === 'Extra da demo')).toBe(false);
    expect((await data.subscription.get()).plan).toBe('free');
  });

  it('clearAll apaga tudo do conjunto de dados e exportJson reflete o conteúdo', async () => {
    const data = await makeLayer({ mode: 'local' });
    await data.goals.create(goalInput({ title: 'X' }));
    const json = JSON.parse(await data.admin.exportJson());
    expect(json.app).toBe('METADAY');
    expect(json.data.goals).toHaveLength(1);
    await data.admin.clearAll();
    expect(await data.admin.isEmpty()).toBe(true);
  });
});
