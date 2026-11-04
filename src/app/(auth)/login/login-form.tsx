"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/modules/auth/actions";
import { Button, Input } from "@/components/ui/primitives";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block text-xs text-muted">
        Username or email
        <Input name="identifier" autoComplete="username" required className="mt-1" />
      </label>
      <label className="block text-xs text-muted">
        Password
        <Input name="password" type="password" autoComplete="current-password" required className="mt-1" />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
