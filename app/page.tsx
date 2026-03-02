export default function Home() {
  const highlights = [
    {
      title: "Быстрый запуск",
      description: "Публикация цифровой визитки за несколько минут без разработки и сложной настройки.",
    },
    {
      title: "Управление из админ-панели",
      description: "Редактирование контента, ссылок, аватаров и активности карточек в одном месте.",
    },
    {
      title: "Аналитика просмотров",
      description: "Отслеживание вовлеченности и эффективности карточек по дням и периодам.",
    },
  ];

  const flow = [
    "Создаете карточку с данными профиля, тегами и кнопками связи.",
    "Публикуете короткую ссылку и делитесь ей в соцсетях, мессенджерах и QR.",
    "Получаете просмотры и обновляете карточку в реальном времени.",
  ];

  return (
    <main className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[800px] -translate-x-1/2 rounded-full bg-white/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[320px] w-[960px] -translate-x-1/2 rounded-full bg-black/5 blur-3xl" />
      </div>

      <section className="mx-auto flex min-h-[72vh] w-full max-w-6xl flex-col justify-center px-6 pb-14 pt-20 sm:px-8 lg:pt-24">
        <p className="animate-in text-sm font-semibold uppercase tracking-[0.24em] text-neutral-600">UNQ+ Platform</p>
        <h1
          className="animate-in mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          Цифровые визитки для команд, экспертов и брендов, которые работают 24/7
        </h1>
        <p
          className="animate-in mt-6 max-w-2xl text-base leading-relaxed text-neutral-700 sm:text-lg"
          style={{ animationDelay: "160ms" }}
        >
          UNQ+ объединяет персональный профиль, контакты, ссылки и аналитику в одном аккуратном публичном
          пространстве. Без бумаги, без потерь и без устаревших данных.
        </p>
        <div className="animate-in mt-10 grid max-w-3xl grid-cols-1 gap-4 text-sm text-neutral-700 sm:grid-cols-3" style={{ animationDelay: "240ms" }}>
          <div className="rounded-2xl border border-black/10 bg-white/55 px-4 py-4 backdrop-blur">
            <p className="text-2xl font-black text-neutral-900">1 мин</p>
            <p className="mt-1">на публикацию карточки</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/55 px-4 py-4 backdrop-blur">
            <p className="text-2xl font-black text-neutral-900">100%</p>
            <p className="mt-1">контроль актуальности данных</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/55 px-4 py-4 backdrop-blur">
            <p className="text-2xl font-black text-neutral-900">24/7</p>
            <p className="mt-1">доступ к профилю по одной ссылке</p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-6 sm:px-8">
        <div className="rounded-3xl border border-black/10 bg-white/65 p-6 backdrop-blur sm:p-8">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Почему выбирают UNQ+</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-2xl bg-neutral-900 px-5 py-6 text-white">
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-300">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-6 rounded-3xl border border-black/10 bg-white/55 p-6 backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:gap-8 sm:p-8">
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Как это работает</h2>
            <ol className="mt-5 space-y-3 text-sm leading-relaxed text-neutral-700 sm:text-base">
              {flow.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-black/10 bg-black px-6 py-7 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Подходит для</p>
            <ul className="mt-4 space-y-2 text-sm text-neutral-200 sm:text-base">
              <li>Агентств и sales-команд</li>
              <li>Экспертов и консультантов</li>
              <li>Руководителей и предпринимателей</li>
              <li>Событий и офлайн-нетворкинга</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-12 pt-2 text-sm text-neutral-600 sm:px-8">
        <div className="rounded-2xl border border-black/10 bg-white/45 px-5 py-4 backdrop-blur">
          UNQ+ • Digital Business Cards Platform • {new Date().getFullYear()}
        </div>
      </footer>
    </main>
  );
}
