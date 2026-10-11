import { getStatus } from "@/lib/aether"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(getStatus(), { headers: { "Cache-Control": "no-store" } })
}
