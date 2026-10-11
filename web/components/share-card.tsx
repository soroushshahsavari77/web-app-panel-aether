"use client"

import { Check, Copy, Globe, Loader2, Power } from "lucide-react"
import { useState } from "react"
import type { ShareStatus } from "@/lib/types"

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 py-1 ps-3 pe-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted">{label}</span>
        <span className="truncate font-mono text-sm" dir="ltr">
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`کپی ${label}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted active:bg-border/40"
      >
        {copied ? <Check className="size-4 text-accent" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
    </div>
  )
}

export function ShareCard({
  share,
  busy,
  onStart,
  onStop,
}: {
  share: ShareStatus
  busy: boolean
  onStart: () => void
  onStop: () => void
}) {
  const live = share.phase === "on" && share.uri
  const starting = share.phase === "starting"

  return (
    <section aria-labelledby="share-title" className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="share-title" className="flex items-center gap-2 text-sm font-semibold">
            <Globe className="size-4 text-accent" aria-hidden />
            دسترسی از بیرون
          </h2>
          <p className="text-xs leading-relaxed text-muted">
            پراکسی را با نام کاربری و رمز روی یک آدرس عمومی منتشر می‌کند تا از گوشی یا کامپیوتر خودتان به آن وصل شوید.
          </p>
        </div>
        {live && (
          <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
            {share.activeConnections} اتصال
          </span>
        )}
      </div>

      {live && share.host && share.port && share.username && share.password && (
        <div className="flex flex-col gap-2">
          <CopyField label="لینک کامل SOCKS5" value={share.uri!} />
          <div className="grid grid-cols-2 gap-2">
            <CopyField label="سرور" value={share.host} />
            <CopyField label="پورت" value={String(share.port)} />
            <CopyField label="نام کاربری" value={share.username} />
            <CopyField label="رمز" value={share.password} />
          </div>
          <p className="text-xs leading-relaxed text-muted">
            در تنظیمات پراکسی برنامه یا مرورگر، نوع SOCKS5 را انتخاب کنید و این مقادیر را وارد کنید. با هر بار روشن کردن، رمز جدید ساخته می‌شود.
          </p>
        </div>
      )}

      {share.phase === "error" && share.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {share.error}
        </p>
      )}

      <button
        type="button"
        onClick={live ? onStop : onStart}
        disabled={busy || starting}
        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium active:scale-[0.99] disabled:opacity-60 ${
          live ? "border border-danger/40 bg-danger/10 text-danger" : "bg-accent text-background"
        }`}
      >
        {busy || starting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Power className="size-4" aria-hidden />
        )}
        {live ? "توقف اشتراک" : starting ? "در حال ساخت آدرس عمومی..." : "ساخت آدرس عمومی"}
      </button>
    </section>
  )
}
