import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6">
        <h1 className="text-lg font-semibold tracking-tight">C Practice</h1>
        <p className="mb-5 mt-1 text-sm text-muted">
          Private platform. Sign in with the account your administrator created.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
