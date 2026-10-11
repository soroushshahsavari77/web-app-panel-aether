import { Dashboard } from "@/components/dashboard"
import { getStatus } from "@/lib/aether"

export const dynamic = "force-dynamic"

export default function Page() {
  return <Dashboard initialStatus={getStatus()} />
}
