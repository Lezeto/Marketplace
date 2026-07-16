// Estrellas de reputación. `value` admite decimales (ej. 4.3).
// Con `onSelect` se vuelve interactivo (para el formulario de reseña).
export default function Stars({ value = 0, onSelect = null, size = 'md' }) {
  const stars = [1, 2, 3, 4, 5]
  return (
    <span className={`stars stars-${size}`} role={onSelect ? 'radiogroup' : undefined}>
      {stars.map(s => {
        const filled = value >= s - 0.25
        const star = (
          <span key={s} className={filled ? 'star filled' : 'star'}>★</span>
        )
        if (!onSelect) return star
        return (
          <button
            key={s}
            type="button"
            className="star-btn"
            aria-label={`${s} estrellas`}
            onClick={() => onSelect(s)}
          >
            <span className={value >= s ? 'star filled' : 'star'}>★</span>
          </button>
        )
      })}
    </span>
  )
}
