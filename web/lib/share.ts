import "server-only"
import { execFile, spawn, type ChildProcess } from "node:child_process"
import { randomBytes, timingSafeEqual } from "node:crypto"
import { existsSync } from "node:fs"
import { chmod, mkdir, rm, writeFile } from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import type { ShareStatus } from "./types"

const run = promisify(execFile)
// Serverless deployments expose /var/task as the working directory, which is read-only.
// Keep bore and share runtime files in the writable OS temp directory.
const SHARE_DIR = path.join(os.tmpdir(), ".aether")
const BORE_VERSION = "v0.6.0"
const BORE_SERVER = process.env.BORE_SERVER || "bore.pub"
const HANDSHAKE_TIMEOUT_MS = 15_000
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g

interface ShareState {
  phase: ShareStatus["phase"]
  server: net.Server | null
  bore: ChildProcess | null
  username: string | null
  password: string | null
  host: string | null
  port: number | null
  upstreamPort: number | null
  activeConnections: number
  totalConnections: number
  error: string | null
  stopRequested: boolean
}

const globalForShare = globalThis as unknown as { __aetherShare?: ShareState }

const state: ShareState = (globalForShare.__aetherShare ??= {
  phase: "off",
  server: null,
  bore: null,
  username: null,
  password: null,
  host: null,
  port: null,
  upstreamPort: null,
  activeConnections: 0,
  totalConnections: 0,
  error: null,
  stopRequested: false,
})

function socketReader(sock: net.Socket) {
  let buf = Buffer.alloc(0)
  let wake: (() => void) | null = null
  let closed = false
  const onData = (d: Buffer) => {
    buf = Buffer.concat([buf, d])
    wake?.()
  }
  const onClose = () => {
    closed = true
    wake?.()
  }
  sock.on("data", onData)
  sock.on("close", onClose)
  return {
    async read(n: number) {
      while (buf.length < n) {
        if (closed) throw new Error("socket closed")
        await new Promise<void>((resolve) => (wake = resolve))
        wake = null
      }
      const out = buf.subarray(0, n)
      buf = buf.subarray(n)
      return out
    },
    detach() {
      sock.pause()
      sock.off("data", onData)
      sock.off("close", onClose)
      return buf
    },
  }
}

function safeEqual(a: Buffer, b: string) {
  const bb = Buffer.from(b)
  return a.length === bb.length && timingSafeEqual(a, bb)
}

function connectUpstream(port: number) {
  return new Promise<net.Socket>((resolve, reject) => {
    const sock = net.connect(port, "127.0.0.1")
    sock.once("connect", () => resolve(sock))
    sock.once("error", reject)
  })
}

async function handleClient(client: net.Socket) {
  const { username, password, upstreamPort } = state
  if (!username || !password || !upstreamPort) return client.destroy()

  client.setTimeout(HANDSHAKE_TIMEOUT_MS, () => client.destroy())
  const reader = socketReader(client)

  const [ver, nMethods] = await reader.read(2)
  const methods = await reader.read(nMethods)
  if (ver !== 5 || !methods.includes(0x02)) {
    client.end(Buffer.from([5, 0xff]))
    return
  }
  client.write(Buffer.from([5, 0x02]))

  const [authVer, uLen] = await reader.read(2)
  const user = await reader.read(uLen)
  const [pLen] = await reader.read(1)
  const pass = await reader.read(pLen)
  const okUser = safeEqual(user, username)
  const okPass = safeEqual(pass, password)
  if (authVer !== 1 || !okUser || !okPass) {
    client.end(Buffer.from([1, 1]))
    return
  }

  const upstream = await connectUpstream(upstreamPort)
  const upReader = socketReader(upstream)
  upstream.write(Buffer.from([5, 1, 0]))
  const [upVer, upMethod] = await upReader.read(2)
  if (upVer !== 5 || upMethod !== 0) {
    upstream.destroy()
    client.end(Buffer.from([1, 1]))
    return
  }
  client.write(Buffer.from([1, 0]))

  const clientRest = reader.detach()
  const upstreamRest = upReader.detach()
  client.setTimeout(0)
  if (clientRest.length) upstream.write(clientRest)
  if (upstreamRest.length) client.write(upstreamRest)

  upstream.on("error", () => client.destroy())
  client.pipe(upstream)
  upstream.pipe(client)
  client.resume()
  upstream.resume()
}

function startGateway(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((client) => {
      state.activeConnections += 1
      state.totalConnections += 1
      client.once("close", () => (state.activeConnections -= 1))
      client.on("error", () => client.destroy())
      handleClient(client).catch(() => client.destroy())
    })
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      state.server = server
      resolve((server.address() as net.AddressInfo).port)
    })
  })
}

function boreAsset() {
  if (process.platform !== "linux") throw new Error(`سیستم‌عامل ${process.platform} پشتیبانی نمی‌شود`)
  const arch = process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : null
  if (!arch) throw new Error(`معماری ${process.arch} پشتیبانی نمی‌شود`)
  return `bore-${BORE_VERSION}-${arch}-unknown-linux-musl.tar.gz`
}

async function ensureBore() {
  const bin = path.join(SHARE_DIR, "bore")
  if (existsSync(bin)) return bin
  const asset = boreAsset()
  const res = await fetch(`https://github.com/ekzhang/bore/releases/download/${BORE_VERSION}/${asset}`, {
    redirect: "follow",
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`دانلود bore ناموفق بود (${res.status})`)
  await mkdir(SHARE_DIR, { recursive: true })
  const archive = path.join(SHARE_DIR, asset)
  await writeFile(archive, Buffer.from(await res.arrayBuffer()))
  await run("tar", ["-xzf", archive, "-C", SHARE_DIR])
  await rm(archive, { force: true })
  await chmod(bin, 0o755)
  return bin
}

function startBore(bin: string, localPort: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, ["local", String(localPort), "--to", BORE_SERVER], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    })
    state.bore = proc
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      proc.kill("SIGKILL")
      reject(new Error(`اتصال به ${BORE_SERVER} در زمان مقرر برقرار نشد`))
    }, 20_000)

    const onOutput = (chunk: Buffer) => {
      const text = chunk.toString("utf8").replace(ANSI, "")
      const match = text.match(/listening at ([^\s:]+):(\d+)/)
      if (match && !settled) {
        settled = true
        clearTimeout(timer)
        state.host = match[1]
        state.port = Number(match[2])
        resolve()
      }
    }
    proc.stdout?.on("data", onOutput)
    proc.stderr?.on("data", onOutput)

    proc.once("error", (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    proc.once("exit", (code) => {
      if (state.bore !== proc) return
      state.bore = null
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(new Error(`bore با کد ${code} بسته شد`))
        return
      }
      if (!state.stopRequested) {
        state.phase = "error"
        state.error = "ارتباط با سرور اشتراک قطع شد"
        state.host = null
        state.port = null
        state.server?.close()
        state.server = null
      }
    })
  })
}

export async function startShare(upstreamPort: number) {
  if (state.phase === "starting" || state.phase === "on") return
  state.phase = "starting"
  state.error = null
  state.stopRequested = false
  state.upstreamPort = upstreamPort
  state.username = `ae${randomBytes(3).toString("hex")}`
  state.password = randomBytes(12).toString("base64url")
  state.totalConnections = 0

  try {
    const bin = await ensureBore()
    const localPort = await startGateway()
    await startBore(bin, localPort)
    state.phase = "on"
  } catch (err) {
    await stopShare()
    state.phase = "error"
    state.error = (err as Error).message
    throw err
  }
}

export async function stopShare() {
  state.stopRequested = true
  const bore = state.bore
  state.bore = null
  bore?.kill("SIGTERM")
  await new Promise<void>((resolve) => {
    if (!state.server) return resolve()
    state.server.close(() => resolve())
    state.server = null
  })
  state.phase = "off"
  state.host = null
  state.port = null
  state.username = null
  state.password = null
  state.activeConnections = 0
}

export function getShareStatus(): ShareStatus {
  const live = state.phase === "on" && state.host && state.port && state.username && state.password
  return {
    phase: state.phase,
    host: live ? state.host : null,
    port: live ? state.port : null,
    username: live ? state.username : null,
    password: live ? state.password : null,
    uri: live ? `socks5://${state.username}:${state.password}@${state.host}:${state.port}` : null,
    activeConnections: state.activeConnections,
    totalConnections: state.totalConnections,
    error: state.error,
  }
}
