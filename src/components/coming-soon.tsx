export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>}
    </div>
  );
}

export function ComingSoon({ icon, title, description, phase }: { icon: string; title: string; description: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-2xl text-ice">
          <i className={`bi ${icon}`} aria-hidden="true" />
        </span>
        <p className="mt-5 font-medium">This page is built in phase {phase}</p>
        <p className="mt-1 text-sm text-muted">The menu and layout are ready for it.</p>
      </div>
    </>
  );
}
