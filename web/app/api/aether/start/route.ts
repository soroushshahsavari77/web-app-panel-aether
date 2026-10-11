import { getStatus, startAether } from "@/lib/aether"
import { parseOptions } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  try {
    startAether(parseOptions(body))
    return Response.json(getStatus())
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 409 })
  }
}
