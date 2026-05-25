type SummaryCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

export default function SummaryCard({
  title,
  value,
  subtitle,
}: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">
        {title}
      </p>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {subtitle ? (
        <p className="mt-2 text-xs text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}
