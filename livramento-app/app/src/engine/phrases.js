import { ler, gravar } from './storage.js'

// Sorteio sem reposição: nunca repete uma frase até esgotar o banco naquele tom.
// `banco` é um array de { t: 'eq'|'ac'|'pa', txt }.
export function sortearFrase(nomeBanco, banco, tomId) {
  const candidatas = banco
    .map((f, i) => ({ ...f, i }))
    .filter((f) => f.t === tomId)
  const pool = candidatas.length ? candidatas : banco.map((f, i) => ({ ...f, i }))

  const chaveVistas = `vistas:${nomeBanco}:${tomId}`
  let vistas = ler(chaveVistas, [])
  let ineditas = pool.filter((f) => !vistas.includes(f.i))
  if (ineditas.length === 0) {
    vistas = []
    ineditas = pool
  }
  const escolhida = ineditas[Math.floor(Math.random() * ineditas.length)]
  gravar(chaveVistas, [...vistas, escolhida.i])
  return escolhida.txt
}
