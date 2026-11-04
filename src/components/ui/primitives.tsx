import { cn } from "@/lib/utils";
import type { Difficulty, SubmissionStatus } from "@prisma/client";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border bg-background", className)} {...props} />;
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {action}
    </div>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" }) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "outline" && "border hover:bg-surface",
        variant === "ghost" && "hover:bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary",
        className,
      )}
      {...props}
    />
  );
}

type Tone = "neutral" | "success" | "warning" | "danger";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
        tone === "danger" && "text-danger",
        tone === "neutral" && "text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function DifficultyBadge({ value }: { value: Difficulty }) {
  const tone: Tone = value === "EASY" ? "success" : value === "MEDIUM" ? "warning" : "danger";
  return <Badge tone={tone}>{value.charAt(0) + value.slice(1).toLowerCase()}</Badge>;
}

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const tone: Tone =
    status === "ACCEPTED" ? "success" : status === "PENDING" || status === "RUNNING" ? "neutral" : "danger";
  return <Badge tone={tone}>{status.replaceAll("_", " ").toLowerCase()}</Badge>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded bg-border">
      <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    </div>
  );
}
