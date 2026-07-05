import EmojiRain from '../components/EmojiRain.jsx'

export default function Resultado({ ctx }) {
  const { resultado, streak, setTela, candidatos } = ctx

  if (!resultado) {
    return (
      <>
        <div className="card"><p>Nenhum resultado por aqui. Vá votar primeiro, patriota!</p></div>
        <button className="cta" onClick={() => setTela('urna')}>🗳️ Ir para a urna</button>
      </>
    )
  }

  if (resultado.tipo === '13') {
    return (
      <>
        <EmojiRain emoji="🍖" />
        <div className="resultado-hero">
          <div className="big">🍖</div>
          <h2>Chuva de mortadela liberada…</h2>
          <p>{resultado.frase}</p>
        </div>
        <div className="certificado">
          <h3>Certificado Oficial de Amnésia Eleitoral</h3>
          <p style={{ margin: 0, fontSize: 13 }}>
            Conferido a este eleitor, que mesmo avisado, com card flutuante e tudo,
            confirmou o 13. O Contador do Livramento testemunhou. A picanha lamenta.
          </p>
        </div>
        <button
          className="cta"
          onClick={() => {
            const texto = 'Ganhei meu Certificado de Amnésia Eleitoral no Contador do Livramento 🍖 Faltam poucos dias para o livramento — vem rir também!'
            navigator.clipboard?.writeText(texto)
          }}
        >
          📋 Copiar certificado para compartilhar
        </button>
        <button className="cta" onClick={() => setTela('feirao')}>
          🛍️ Cupom do dia (sim, você também tem direito)
        </button>
      </>
    )
  }

  const cand = candidatos.direita.find((c) => c.numero === resultado.numero)

  return (
    <>
      <EmojiRain emoji="🎉" />
      <div className="resultado-hero">
        <div className="big">{cand?.emoji ?? '🇧🇷'}</div>
        <h2>Voto computado: {cand?.nome} ({resultado.numero})</h2>
        <p>{resultado.fraseParabens}</p>
        {resultado.fraseFidelidade && <p>{resultado.fraseFidelidade}</p>}
        <p className="streak">🔥 Streak de patriota: {streak} {streak === 1 ? 'dia' : 'dias'} seguidos</p>
      </div>
      <button className="cta tonal" onClick={() => setTela('feirao')}>
        🎁 Desbloquear os cupons do dia
      </button>
      <button
        className="cta"
        onClick={() => {
          const texto = `Votei no ${cand?.nome} na Urna do Povo 🗳️ Streak de ${streak} dias no Contador do Livramento. Não importa em quem da direita — o que importa é o PT sair!`
          navigator.clipboard?.writeText(texto)
        }}
      >
        📋 Copiar resultado para compartilhar
      </button>
    </>
  )
}
