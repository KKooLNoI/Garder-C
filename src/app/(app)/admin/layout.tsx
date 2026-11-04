import { requireAdmin } from "@/modules/auth/session";

// Guards every /admin page. Server actions and services re-check independently.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="mx-auto max-w-6xl p-6">{children}</div>;
}
