import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/lib/auth-context";

export function FullScreenMessage({
  children,
}: Readonly<{ children: string }>) {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-muted-foreground">{children}</p>
    </main>
  );
}

/** Renders child routes only with a signed-in session; otherwise goes to login. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
