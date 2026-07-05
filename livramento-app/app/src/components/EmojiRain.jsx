// Chuva de emojis (confete de mortadela, festa etc.) — puro CSS, sem dependências.
export default function EmojiRain({ emoji, count = 24 }) {
  const gotas = Array.from({ length: count }, (_, i) => ({
    key: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    dur: 2.2 + Math.random() * 2,
    size: 22 + Math.random() * 22,
  }))
  return (
    <div className="rain" aria-hidden="true">
      {gotas.map((g) => (
        <span
          key={g.key}
          style={{
            left: g.left + '%',
            animationDelay: g.delay + 's',
            animationDuration: g.dur + 's',
            fontSize: g.size + 'px',
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  )
}
