import { getStatus, stopAether } from "@/lib/aether"

export const dynamic = "force-dynamic"

export async function POST() {
  await stopAether()
  return Response.json(getStatus())
}
