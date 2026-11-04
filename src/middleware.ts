import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate: no session cookie means redirect to login. Real validation
// (DB lookup, expiry, isActive, role) happens in the server layouts and handlers.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("cp_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next|favicon.ico|api/health).*)"],
};
