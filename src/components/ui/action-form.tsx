"use client";

import { useActionState } from "react";
import type { FormState } from "@/modules/admin/actions";
import { cn } from "@/lib/utils";

/** Form bound to a server action that reports success or an error message. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className={cn(className, pending && "opacity-70")}>
      {children}
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p role="status" className="mt-2 text-sm text-success">
          {state.ok}
        </p>
      )}
    </form>
  );
}
