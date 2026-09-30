// 「このあとのSTEPで作ります」を示す共通の枠
export default function ComingSoon({ step, title, items }: { step: string; title: string; items: string[] }) {
  return (
    <section className="coming-soon">
      <span className="coming-soon__step">{step}で作ります</span>
      <h2 className="coming-soon__title">{title}</h2>
      <ul className="coming-soon__list">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </section>
  );
}
