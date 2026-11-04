import { cn } from "@/lib/utils";

const base = "w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-xs text-muted", className)}>
      {label}
      <div className="mt-1 text-foreground">{children}</div>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const TextInput = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(base, "h-9", p.className)} />;

export const TextArea = ({ mono, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) => (
  <textarea {...p} className={cn(base, "py-2", mono && "font-mono text-xs", p.className)} />
);

export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(base, "h-9", p.className)} />;

export const Check = ({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" {...p} />
    {label}
  </label>
);

export const SubmitButton = ({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "outline" | "danger" }) => (
  <button
    type="submit"
    className={cn(
      "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium",
      tone === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
      tone === "outline" && "border hover:bg-surface",
      tone === "danger" && "border text-danger hover:bg-surface",
    )}
  >
    {children}
  </button>
);
