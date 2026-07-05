// Persistência local — tudo fica só no aparelho do usuário (regra de ouro: zero dado sensível no servidor).
const PREFIXO = 'cdl:'

export function ler(chave, padrao) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave)
    return bruto === null ? padrao : JSON.parse(bruto)
  } catch {
    return padrao
  }
}

export function gravar(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor))
  } catch {
    // armazenamento cheio/indisponível: o app segue funcionando sem persistir
  }
}
