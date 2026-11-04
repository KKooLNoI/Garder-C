import { Sidebar } from "@/components/layout/sidebar";
import { logoutAction } from "@/modules/auth/actions";
import { requireUser } from "@/modules/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex h-screen">
      <Sidebar username={user.username} isAdmin={user.role === "ADMIN"} logout={logoutAction} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
