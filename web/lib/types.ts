export const PROTOCOLS = ["masque", "wg", "gool", "mim"] as const
export const TRANSPORTS = ["h2", "h3"] as const
export const SCAN_MODES = ["turbo", "balanced", "thorough", "verified", "ironclad"] as const
export const IP_MODES = ["4", "6", "dual"] as const
export const NOIZE_PROFILES = ["default", "off", "light", "firewall", "balanced", "gfw", "aggressive"] as const

export type Protocol = (typeof PROTOCOLS)[number]
export type Transport = (typeof TRANSPORTS)[number]
export type ScanMode = (typeof SCAN_MODES)[number]
export type IpMode = (typeof IP_MODES)[number]
export type NoizeProfile = (typeof NOIZE_PROFILES)[number]

export interface StartOptions {
  protocol: Protocol
  transport: Transport
  scan: ScanMode
  ip: IpMode
  noize: NoizeProfile
  port: number
  httpProxy: boolean
  quickReconnect: boolean
}

export const DEFAULT_OPTIONS: StartOptions = {
  protocol: "masque",
  transport: "h2",
  scan: "turbo",
  ip: "4",
  noize: "default",
  port: 1819,
  httpProxy: false,
  quickReconnect: true,
}

export type Phase = "stopped" | "starting" | "scanning" | "connecting" | "connected" | "reconnecting" | "error"

export interface LogLine {
  id: number
  text: string
  level: "info" | "warn" | "error"
  ts: number
}

export interface ExitInfo {
  ip: string
  country: string
  colo: string
  latencyMs: number
  warp: string | null
}

export interface AetherStatus {
  binary: string | null
  running: boolean
  phase: Phase
  pid: number | null
  options: StartOptions | null
  gateway: string | null
  exit: ExitInfo | null
  lastError: string | null
  uptimeSec: number | null
  runningSec: number | null
  logs: LogLine[]
  share: ShareStatus
}

export interface ShareStatus {
  phase: "off" | "starting" | "on" | "error"
  host: string | null
  port: number | null
  username: string | null
  password: string | null
  uri: string | null
  activeConnections: number
  totalConnections: number
  error: string | null
}

export interface TraceResult {
  ok: boolean
  ip?: string
  loc?: string
  colo?: string
  warp?: string
  ms?: number
  error?: string
}

function oneOf<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback
}

export function parseOptions(input: unknown): StartOptions {
  const o = (input ?? {}) as Record<string, unknown>
  const port = Number(o.port)
  return {
    protocol: oneOf(PROTOCOLS, o.protocol, DEFAULT_OPTIONS.protocol),
    transport: oneOf(TRANSPORTS, o.transport, DEFAULT_OPTIONS.transport),
    scan: oneOf(SCAN_MODES, o.scan, DEFAULT_OPTIONS.scan),
    ip: oneOf(IP_MODES, o.ip, DEFAULT_OPTIONS.ip),
    noize: oneOf(NOIZE_PROFILES, o.noize, DEFAULT_OPTIONS.noize),
    port: Number.isInteger(port) && port >= 1024 && port <= 65534 ? port : DEFAULT_OPTIONS.port,
    httpProxy: o.httpProxy === true,
    quickReconnect: o.quickReconnect !== false,
  }
}
