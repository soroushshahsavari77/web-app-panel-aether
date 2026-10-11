import { NextResponse, type NextRequest } from "next/server"

// Basic Auth gate for the whole panel and every /api/aether/* route.
// Fails closed: if PANEL_USER / PANEL_PASSWORD are not set, nothing is served.

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function proxy(req: NextRequest) {
  // Unauthenticated health check for Render / Railway.
  if (req.nextUrl.pathname === "/healthz") return new NextResponse("ok")

  const user = process.env.PANEL_USER
  const pass = process.env.PANEL_PASSWORD
  if (!user || !pass) {
    return new NextResponse("PANEL_USER and PANEL_PASSWORD must be set", { status: 503 })
  }

  const [scheme, encoded] = (req.headers.get("authorization") ?? "").split(" ")
  if (scheme === "Basic" && encoded) {
    try {
      const decoded = atob(encoded)
      const i = decoded.indexOf(":")
      if (i >= 0 && safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), pass)) {
        return NextResponse.next()
      }
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Aether", charset="UTF-8"' },
  })
}

export const config = { matcher: "/:path*" }
