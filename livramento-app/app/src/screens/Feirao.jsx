export default function Feirao({ ctx }) {
  const { ofertas, votoHoje, carteira, resgatar, setTela, hoje } = ctx

  const max = ofertas?.maxEscolhasPorDia ?? 3
  const resgatadasHoje = carteira.filter((c) => c.dia === hoje)
  const idsHoje = new Set(resgatadasHoje.map((c) => c.id))
  const restam = max - resgatadasHoje.length

  return (
    <>
      <div className="app-title">🛍️ Feirão do Livramento</div>

      {ofertas?.patrocinadorMaster && (
        <div className="card">
          <h3>Patrocinador master do dia</h3>
          <p>Hoje quem paga a conta é a {ofertas.patrocinadorMaster} 🇧🇷</p>
        </div>
      )}

      {votoHoje === undefined ? (
        <>
          <div className="card">
            <h3>🔒 Cupons bloqueados</h3>
            <p>
              Participe da brincadeira do dia na Urna do Povo para desbloquear as ofertas.
              Qualquer voto vale — até o 13 (a gente julga, mas libera).
            </p>
          </div>
          <button className="cta tonal" onClick={() => setTela('urna')}>🗳️ Votar e desbloquear</button>
        </>
      ) : (
        <div className="card">
          <h3>🎁 Escolha suas ofertas</h3>
          <p>
            Você pode resgatar até {max} cupons por dia — escolha bem.
            {restam > 0 ? ` Ainda restam ${restam}.` : ' Limite de hoje atingido, volte amanhã!'}
          </p>
        </div>
      )}

      {(ofertas?.ofertas ?? []).map((o) => {
        const jaPegou = idsHoje.has(o.id)
        return (
          <div className="oferta" key={o.id}>
            <span className="logo" aria-hidden="true">{o.logoEmoji}</span>
            <span>
              <span className="tt">{o.titulo}</span>
              <span className="ss">
                {o.sponsor} · <span className="badge-tipo">
                  {o.tipo === 'percent' ? '% OFF' : o.tipo === 'reais' ? 'R$ OFF' : 'Voucher'}
                </span>{' '}
                · {o.canal === 'ambos' ? '🌐 site + 🏬 loja' : o.canal === 'online' ? '🌐 site' : '🏬 loja'}
              </span>
            </span>
            <button
              className="pega"
              disabled={votoHoje === undefined || jaPegou || restam <= 0}
              onClick={() => resgatar(o)}
            >
              {jaPegou ? '✅ Na carteira' : 'Pegar'}
            </button>
          </div>
        )
      })}

      <div className="card">
        <p className="aviso-lgpd">
          ⏳ Todo cupom expira em até 48h após o resgate — aqui tudo tem prazo, inclusive o PT.
          Cupons liberados pela participação na brincadeira, independente do voto.
        </p>
      </div>
    </>
  )
}
