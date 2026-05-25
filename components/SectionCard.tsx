type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export default function SectionCard({
  title,
  description,
  children,
}: SectionCardProps) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
