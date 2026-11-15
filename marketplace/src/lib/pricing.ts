import { COUNTER_PROPOSAL_MAX_DEVIATION_PERCENT } from "./constants";

export function calcularValorTabela(itens: { valor_unitario: number; quantidade: number }[]) {
  return itens.reduce((total, item) => total + item.valor_unitario * item.quantidade, 0);
}

/** Regra de negócio 7: contrapropostas limitadas a ±60% do preço-tabela. */
export function propostaDentroDoLimite(valorProposta: number, valorTabela: number) {
  if (valorTabela <= 0) return true;
  const desvio = Math.abs(valorProposta - valorTabela) / valorTabela;
  return desvio <= COUNTER_PROPOSAL_MAX_DEVIATION_PERCENT / 100;
}
