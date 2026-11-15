// Sistema de abas do Plano Cômodos, Etapa 0.
//
// A descoberta que organiza tudo: existem DOIS tipos de aba, e misturá-los é o
// erro que transforma qualquer aplicativo num labirinto de menus.
//
//   ARQUIVO (endereço)  A conversa mora em uma só. São mutuamente exclusivas.
//                       Mudar de aba é mudar a conversa de lugar.
//   LENTE (ponto de vista)  Não guarda conversa nenhuma. Atravessa todas as
//                       outras e mostra uma fatia do que já existe. O
//                       comprovante que a mãe mandou no Social e o boleto que a
//                       loja mandou no Atendimento aparecem juntos sem sair do
//                       lugar de origem.
//
// Com essa separação dá para ter dez abas sem confundir ninguém, porque lente
// não compete com endereço.
import { now } from './db.js';

export const ARQUIVO = 'arquivo';
export const LENTE = 'lente';

// Catálogo. Uma aba nova entra aqui e no resto do sistema sozinha.
// `padrao: true` = vem ligada para todo mundo, inclusive para quem já tem conta.
export const TAB_CATALOG = [
  {
    key: 'social', label: 'Social', icon: '💬', type: ARQUIVO, padrao: true, fixa: true,
    descricao: 'Amigos e família. Empresa nenhuma entra aqui.',
  },
  {
    key: 'work', label: 'Trabalho', icon: '💼', type: ARQUIVO, padrao: true, fixa: true,
    descricao: 'Equipes, projetos e combinados de trabalho.',
  },
  {
    key: 'desk', label: 'Atendimento', icon: '🎧', type: ARQUIVO, padrao: true, fixa: true,
    descricao: 'Empresas e suporte. É a única aba onde empresa aparece.',
  },
];

const PORCHAVE = new Map(TAB_CATALOG.map((t) => [t.key, t]));

export const getTab = (key) => PORCHAVE.get(String(key || '')) || null;
export const isArquivo = (key) => getTab(key)?.type === ARQUIVO;
export const isLente = (key) => getTab(key)?.type === LENTE;

// Abas de arquivo são as únicas que podem ser endereço de uma conversa.
// Mandar uma conversa para uma lente é um erro de programação, não de usuário.
export const ARQUIVO_KEYS = TAB_CATALOG.filter((t) => t.type === ARQUIVO).map((t) => t.key);
export const DEFAULT_TAB = 'social';

// Quantas abas cabem na tela do celular antes de o produto virar menu.
export const MAX_VISIVEIS = 4;

// O catálogo é injetável para os testes poderem exercitar o limite da barra
// antes de existirem quatro abas de verdade.
export function createTabService(db, { logger = console, catalog = TAB_CATALOG } = {}) {
  const porChave = new Map(catalog.map((t) => [t.key, t]));
  const buscar = (key) => porChave.get(String(key || '')) || null;

  const s = {
    doUsuario: db.prepare('SELECT * FROM user_tabs WHERE user_id = ? ORDER BY position, rowid'),
    uma: db.prepare('SELECT * FROM user_tabs WHERE user_id = ? AND tab_key = ?'),
    inserir: db.prepare(`INSERT INTO user_tabs (user_id, tab_key, enabled, position, config, created_at)
      VALUES (?, ?, ?, ?, '{}', ?)
      ON CONFLICT(user_id, tab_key) DO NOTHING`),
    ligar: db.prepare('UPDATE user_tabs SET enabled = ? WHERE user_id = ? AND tab_key = ?'),
    posicionar: db.prepare('UPDATE user_tabs SET position = ? WHERE user_id = ? AND tab_key = ?'),
  };

  // Garante que a pessoa tenha as abas padrão registradas. Chamado em toda
  // leitura: quem já tinha conta antes do sistema de abas recebe exatamente as
  // três de sempre, na mesma ordem, sem perceber nada.
  function ensureDefaults(userId) {
    const existentes = new Set(s.doUsuario.all(userId).map((r) => r.tab_key));
    let posicao = existentes.size;
    for (const tab of catalog) {
      if (existentes.has(tab.key)) continue;
      if (!tab.padrao) continue;
      s.inserir.run(userId, tab.key, 1, catalog.indexOf(tab), now());
      posicao += 1;
    }
  }

  // A barra de abas de uma pessoa: o que está ligado, em ordem, mais o que
  // ainda dá para ligar. `visiveis` é o que cabe na tela; o resto vai para o
  // botão "mais".
  function listFor(userId) {
    ensureDefaults(userId);
    const linhas = s.doUsuario.all(userId);
    const ligadas = linhas
      .filter((r) => r.enabled && buscar(r.tab_key))
      .map((r) => ({ ...buscar(r.tab_key), position: r.position, config: parseConfig(r.config) }));

    return {
      tabs: ligadas,
      visiveis: ligadas.slice(0, MAX_VISIVEIS).map((t) => t.key),
      extras: ligadas.slice(MAX_VISIVEIS).map((t) => t.key),
      // Catálogo do que existe e ainda não foi ligado: é a base da Loja de Abas.
      disponiveis: catalog
        .filter((t) => !ligadas.some((l) => l.key === t.key))
        .map(({ key, label, icon, type, descricao }) => ({ key, label, icon, type, descricao })),
      maxVisiveis: MAX_VISIVEIS,
    };
  }

  function setEnabled(userId, tabKey, enabled) {
    const tab = buscar(tabKey);
    if (!tab) return { ok: false, reason: 'Aba desconhecida.' };
    // Aba fixa não desliga: sem Social, Trabalho e Atendimento as conversas
    // existentes ficariam sem endereço nenhum.
    if (tab.fixa && !enabled) return { ok: false, reason: 'Esta aba não pode ser desligada.' };
    ensureDefaults(userId);
    s.inserir.run(userId, tabKey, enabled ? 1 : 0, catalog.indexOf(tab), now());
    s.ligar.run(enabled ? 1 : 0, userId, tabKey);
    return { ok: true, tabs: listFor(userId) };
  }

  function reorder(userId, ordem) {
    ensureDefaults(userId);
    const validas = (Array.isArray(ordem) ? ordem : []).filter((k) => buscar(k));
    validas.forEach((k, i) => s.posicionar.run(i, userId, k));
    return listFor(userId);
  }

  function parseConfig(raw) {
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }

  return { ensureDefaults, listFor, setEnabled, reorder, catalog };
}
