type StatCardProps = {
  label: string;
  value: number;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-background p-6">
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
