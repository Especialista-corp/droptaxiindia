// Gera docs/STATUS-BETA.md a partir de src/features/beta-status/statusData.ts.
// Uso: npm run docs:status   (Node ≥ 22.18, remoção de tipos nativa)
import { writeFileSync } from 'node:fs';
import { STATUS_DATE, STATUS_ITEMS } from '../src/features/beta-status/statusData.ts';

const order = ['funcional', 'demonstrativo', 'pendente', 'falhou'] as const;
const label = { funcional: 'Funcional', demonstrativo: 'Demonstrativo', pendente: 'Pendente', falhou: 'Falhou' } as const;

let md = `# STATUS DO BETA 0.1\n\n> Gerado por \`npm run docs:status\` a partir de \`src/features/beta-status/statusData.ts\`. **Não edite à mão.**\n> Registro de ${STATUS_DATE}. Evidências vêm de testes automatizados do repositório, não de verificação em produção.\n\n`;
md += `| Situação | Quantidade |\n|---|---|\n`;
for (const s of order) md += `| ${label[s]} | ${STATUS_ITEMS.filter((i) => i.status === s).length} |\n`;
for (const s of order) {
  const items = STATUS_ITEMS.filter((i) => i.status === s);
  if (!items.length) continue;
  md += `\n## ${label[s]}\n\n| Área | Recurso | Evidência / observação |\n|---|---|---|\n`;
  for (const i of items) md += `| ${i.area} | ${i.name} | ${i.evidence.replace(/\|/g, '\\|')} |\n`;
}
writeFileSync(new URL('../docs/STATUS-BETA.md', import.meta.url), md);
console.log('docs/STATUS-BETA.md gerado com', STATUS_ITEMS.length, 'itens');
