import { describe, expect, it } from 'vitest';
import { DowngradeSelectionRequiredError, GoalNotActiveError, PlanLimitError, ValidationError } from '@/data/errors.ts';
import { goalInput, makeLayer, uniqueDbName } from '../helpers.ts';

describe('objetivos — CRUD e objetivo principal', () => {
  it('primeiro acesso sem metas → criar objetivo → vira o principal', async () => {
    const data = await makeLayer();
    expect(await data.goals.list()).toHaveLength(0);
    const goal = await data.goals.create(goalInput({ title: 'Primeira meta' }));
    expect(goal.status).toBe('active');
    expect(goal.isPrimary).toBe(true);
    expect(goal.currentValue).toBe(0);
  });

  it('o segundo objetivo NÃO rouba o posto de principal', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ title: 'A' }));
    const b = await data.goals.create(goalInput({ title: 'B' }));
    const list = await data.goals.list();
    expect(list.find((g) => g.id === a.id)!.isPrimary).toBe(true);
    expect(list.find((g) => g.id === b.id)!.isPrimary).toBe(false);
  });

  it('trocar o principal mantém exatamente um principal', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ title: 'A' }));
    const b = await data.goals.create(goalInput({ title: 'B' }));
    await data.goals.setPrimary(b.id);
    const list = await data.goals.list();
    expect(list.filter((g) => g.isPrimary).map((g) => g.id)).toEqual([b.id]);
    await data.goals.setPrimary(a.id);
    expect((await data.goals.list()).filter((g) => g.isPrimary).map((g) => g.id)).toEqual([a.id]);
  });

  it('só objetivos ativos podem ser principais', async () => {
    const data = await makeLayer();
    await data.goals.create(goalInput({ title: 'A' }));
    const b = await data.goals.create(goalInput({ title: 'B' }));
    await data.goals.setStatus(b.id, 'paused');
    await expect(data.goals.setPrimary(b.id)).rejects.toBeInstanceOf(GoalNotActiveError);
  });

  it('arquivar o principal promove o ativo com prazo mais próximo', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ title: 'A', targetDate: '2026-12-31' }));
    await data.goals.create(goalInput({ title: 'B (longe)', targetDate: '2027-06-30' }));
    const c = await data.goals.create(goalInput({ title: 'C (perto)', targetDate: '2026-12-01' }));
    await data.goals.setStatus(a.id, 'archived');
    const list = await data.goals.list();
    expect(list.filter((g) => g.isPrimary).map((g) => g.id)).toEqual([c.id]);
    expect(list.find((g) => g.id === a.id)!.isPrimary).toBe(false);
  });

  it('concluir o principal mantém-no como principal (Home mostra a celebração)', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ title: 'A' }));
    await data.goals.create(goalInput({ title: 'B' }));
    const done = await data.goals.setStatus(a.id, 'completed');
    expect(done.status).toBe('completed');
    expect(done.completedAt).toBeTruthy();
    expect(done.isPrimary).toBe(true);
    // ...e arquivar depois promove o próximo ativo
    await data.goals.setStatus(a.id, 'archived');
    expect((await data.goals.list()).filter((g) => g.isPrimary)).toHaveLength(1);
    expect((await data.goals.list()).find((g) => g.isPrimary)!.title).toBe('B');
  });

  it('editar campos e validar datas/valores', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ title: 'A' }));
    const upd = await data.goals.update(a.id, { title: 'A2', targetValue: 200, targetDate: '2027-01-31' });
    expect(upd.title).toBe('A2');
    expect(upd.targetValue).toBe(200);
    await expect(data.goals.update(a.id, { targetDate: '2026-10-01' })).rejects.toBeInstanceOf(ValidationError);
    await expect(data.goals.update(a.id, { title: '   ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(data.goals.update(a.id, { targetValue: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(data.goals.create(goalInput({ startDate: '2026-02-30' }))).rejects.toBeInstanceOf(ValidationError);
  });

  it('valor realizado acima do alvo é preservado', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ targetValue: 10, currentValue: 25 }));
    expect(a.currentValue).toBe(25);
  });

  it('excluir remove check-ins do objetivo e vínculos em hábitos', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ title: 'A' }));
    const b = await data.goals.create(goalInput({ title: 'B' }));
    await data.checkIns.create({ goalId: a.id, localDate: '2026-11-22', quantity: 5 });
    await data.checkIns.create({ goalId: b.id, localDate: '2026-11-22', quantity: 7 });
    const habit = await data.habits.create({
      title: 'Hábito',
      icon: 'target',
      recurrence: { type: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] },
      goalIds: [a.id, b.id],
    });
    await data.goals.remove(a.id);
    expect(await data.goals.get(a.id)).toBeUndefined();
    const cis = await data.checkIns.list();
    expect(cis).toHaveLength(1);
    expect(cis[0]!.goalId).toBe(b.id);
    expect((await data.habits.list()).find((h) => h.id === habit.id)!.goalIds).toEqual([b.id]);
    expect((await data.goals.list()).find((g) => g.id === b.id)!.isPrimary).toBe(true);
  });
});

describe('plano FREE: máximo de 3 objetivos ativos (validado na camada de dados)', () => {
  it('a quarta meta ativa é bloqueada, sem perder dados', async () => {
    const data = await makeLayer();
    for (const t of ['A', 'B', 'C']) await data.goals.create(goalInput({ title: t }));
    await expect(data.goals.create(goalInput({ title: 'D' }))).rejects.toBeInstanceOf(PlanLimitError);
    const list = await data.goals.list();
    expect(list).toHaveLength(3);
    expect(list.map((g) => g.title)).toEqual(['A', 'B', 'C']);
  });

  it('a mensagem explica como liberar vaga', async () => {
    const data = await makeLayer();
    for (const t of ['A', 'B', 'C']) await data.goals.create(goalInput({ title: t }));
    await expect(data.goals.create(goalInput())).rejects.toThrow(/até 3 objetivos ativos.*arquive/i);
  });

  it('PREMIUM (simulação local) permite a quarta e além — sem fingir cobrança', async () => {
    const data = await makeLayer();
    for (const t of ['A', 'B', 'C']) await data.goals.create(goalInput({ title: t }));
    const { subscription } = await data.subscription.setPlan('premium');
    expect(subscription.plan).toBe('premium');
    expect(subscription.providerRef).toBe('demo-local'); // nenhum provedor de pagamento real
    await data.goals.create(goalInput({ title: 'D' }));
    await data.goals.create(goalInput({ title: 'E' }));
    expect((await data.goals.list()).filter((g) => g.status === 'active')).toHaveLength(5);
  });

  it('concluir ou arquivar libera vaga; restaurar respeita o limite', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ title: 'A' }));
    const b = await data.goals.create(goalInput({ title: 'B' }));
    await data.goals.create(goalInput({ title: 'C' }));
    await data.goals.setStatus(a.id, 'archived'); // libera vaga
    const d = await data.goals.create(goalInput({ title: 'D' })); // agora cabe
    expect(d.status).toBe('active');
    await expect(data.goals.setStatus(a.id, 'active')).rejects.toBeInstanceOf(PlanLimitError); // restaurar não cabe
    await data.goals.setStatus(b.id, 'completed'); // concluir libera vaga
    const restored = await data.goals.setStatus(a.id, 'active');
    expect(restored.status).toBe('active');
    await expect(data.goals.setStatus(b.id, 'active')).rejects.toBeInstanceOf(PlanLimitError); // reabrir também respeita
  });

  it('pausar libera vaga; retomar exige vaga', async () => {
    const data = await makeLayer();
    const a = await data.goals.create(goalInput({ title: 'A' }));
    await data.goals.create(goalInput({ title: 'B' }));
    await data.goals.create(goalInput({ title: 'C' }));
    await data.goals.setStatus(a.id, 'paused');
    await data.goals.create(goalInput({ title: 'D' }));
    await expect(data.goals.setStatus(a.id, 'active')).rejects.toBeInstanceOf(PlanLimitError);
  });

  it('criações concorrentes não furam o limite (transação)', async () => {
    const data = await makeLayer();
    await data.goals.create(goalInput({ title: 'A' }));
    await data.goals.create(goalInput({ title: 'B' }));
    const results = await Promise.allSettled([
      data.goals.create(goalInput({ title: 'C1' })),
      data.goals.create(goalInput({ title: 'C2' })),
      data.goals.create(goalInput({ title: 'C3' })),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(2);
    expect((await data.goals.list()).filter((g) => g.status === 'active')).toHaveLength(3);
  });
});

describe('downgrade Premium → Grátis (sem excluir dados)', () => {
  async function premiumWithFive() {
    const data = await makeLayer();
    await data.subscription.setPlan('premium');
    const ids: string[] = [];
    for (const t of ['A', 'B', 'C', 'D', 'E']) ids.push((await data.goals.create(goalInput({ title: t }))).id);
    return { data, ids };
  }

  it('exige escolher até 3 metas quando há mais de 3 ativas; o plano não muda sem a escolha', async () => {
    const { data } = await premiumWithFive();
    await expect(data.subscription.setPlan('free')).rejects.toBeInstanceOf(DowngradeSelectionRequiredError);
    expect((await data.subscription.get()).plan).toBe('premium');
    await expect(data.subscription.setPlan('free', { keepActiveGoalIds: ['a', 'b', 'c', 'd'] })).rejects.toBeInstanceOf(
      DowngradeSelectionRequiredError,
    );
  });

  it('suspende as demais de forma reversível e preserva todos os dados', async () => {
    const { data, ids } = await premiumWithFive();
    await data.checkIns.create({ goalId: ids[4]!, localDate: '2026-11-22', quantity: 3 });
    const keep = [ids[1]!, ids[2]!, ids[3]!];
    const result = await data.subscription.setPlan('free', { keepActiveGoalIds: keep });
    expect(result.suspendedGoalIds.sort()).toEqual([ids[0]!, ids[4]!].sort());
    const list = await data.goals.list();
    expect(list).toHaveLength(5); // nada excluído
    expect(list.filter((g) => g.status === 'active').map((g) => g.id).sort()).toEqual(keep.sort());
    const suspended = list.filter((g) => g.suspendedByPlan);
    expect(suspended).toHaveLength(2);
    expect(suspended.every((g) => g.status === 'paused')).toBe(true);
    expect(await data.checkIns.list()).toHaveLength(1); // histórico preservado
    expect(list.filter((g) => g.isPrimary)).toHaveLength(1);
    expect(list.find((g) => g.isPrimary)!.status).toBe('active'); // principal sempre ativo
  });

  it('upgrade permite reativar as suspensas', async () => {
    const { data, ids } = await premiumWithFive();
    await data.subscription.setPlan('free', { keepActiveGoalIds: [ids[0]!, ids[1]!, ids[2]!] });
    expect(await data.subscription.reactivateSuspendedGoals()).toEqual([]); // FREE sem vaga
    await data.subscription.setPlan('premium');
    const reactivated = await data.subscription.reactivateSuspendedGoals();
    expect(reactivated.sort()).toEqual([ids[3]!, ids[4]!].sort());
    const list = await data.goals.list();
    expect(list.filter((g) => g.status === 'active')).toHaveLength(5);
    expect(list.some((g) => g.suspendedByPlan)).toBe(false);
  });

  it('com até 3 ativas o downgrade é direto', async () => {
    const data = await makeLayer();
    await data.subscription.setPlan('premium');
    await data.goals.create(goalInput());
    const r = await data.subscription.setPlan('free');
    expect(r.suspendedGoalIds).toEqual([]);
    expect(r.subscription.plan).toBe('free');
  });
});

describe('persistência: recarregar mantém os dados', () => {
  it('fechar e reabrir o mesmo banco preserva metas, check-ins e plano', async () => {
    const dbName = uniqueDbName();
    const first = await makeLayer({ dbName });
    const goal = await first.goals.create(goalInput({ title: 'Persistente' }));
    await first.checkIns.create({ goalId: goal.id, localDate: '2026-11-22', quantity: 4 });
    await first.subscription.setPlan('premium');
    first.close();

    const second = await makeLayer({ dbName });
    const goals = await second.goals.list();
    expect(goals).toHaveLength(1);
    expect(goals[0]!.title).toBe('Persistente');
    expect(goals[0]!.currentValue).toBe(4);
    expect(goals[0]!.isPrimary).toBe(true);
    expect(await second.checkIns.list()).toHaveLength(1);
    expect((await second.subscription.get()).plan).toBe('premium');
  });

  it('bancos de modos diferentes são isolados (demo nunca se mistura com dados reais)', async () => {
    const local = await makeLayer({ mode: 'local' });
    const demo = await makeLayer({ mode: 'demo' });
    await local.goals.create(goalInput({ title: 'Minha meta real' }));
    await demo.admin.seedDemo();
    expect((await local.goals.list()).map((g) => g.title)).toEqual(['Minha meta real']);
    expect((await demo.goals.list()).some((g) => g.title === 'Minha meta real')).toBe(false);
  });
});
