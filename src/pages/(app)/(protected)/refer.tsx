// 内推人页面：网址 /refer
// 放在 (protected) 文件夹里，所以必须登录才能打开
import { useState } from 'react'
import { useAuth, useQuery, useUserLookup } from 'deepspace'
import { Button, Input, Label } from '@/components/ui'
import { callAction } from '@/lib/action'
import type { Referrer } from '@/types'

export default function ReferPage() {
  const { userId } = useAuth() // 当前登录的人
  const { getName } = useUserLookup() // 用 user id 查名字

  // 读内推人表。数据变了（比如别人刚验证完），页面会自动更新
  const { records } = useQuery<Referrer>('referrers', { orderBy: 'createdAt', orderDir: 'desc' })
  const mine = records.filter((r) => r.data.userId === userId)

  // 表单里填的内容
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email') // 第一步填邮箱，第二步填验证码
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // 点"Send code"：让服务器发验证码
  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const res = await callAction('sendReferrerCode', { company, email })
    setBusy(false)
    if (res.success) {
      setStep('code')
      setMessage(`We sent a 6-digit code to ${email}. It expires in 10 minutes.`)
    } else {
      setMessage(res.error)
    }
  }

  // 点"Remove"：让服务器取消这个验证（手上还有这家公司的认领会被拒绝，原因显示在下面）
  async function removeVerification(referrerId: string) {
    setMessage('')
    const res = await callAction('removeReferrer', { referrerId })
    if (!res.success) setMessage(res.error)
  }

  // 点"Verify"：让服务器核对验证码
  async function confirmCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const res = await callAction<{ company: string; domain: string }>('confirmReferrerCode', { code })
    setBusy(false)
    if (res.success) {
      setMessage(`Verified. You can now pick up referral requests for ${res.data.company}.`)
      setCompany('')
      setEmail('')
      setCode('')
      setStep('email')
    } else {
      setMessage(res.error)
    }
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl space-y-10 px-6 py-16">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Refer at your company</h1>
          <p className="text-sm text-muted-foreground">
            Applicants share their resumes here, so referrers confirm a work email first. We keep
            only the domain (like nvidia.com), never the full address.
          </p>
        </header>

        {/* 第一步：填公司和工作邮箱 */}
        {step === 'email' && (
          <form onSubmit={sendCode} className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="NVIDIA" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@nvidia.com" required />
            </div>
            <Button type="submit" loading={busy}>Send code</Button>
          </form>
        )}

        {/* 第二步：填验证码 */}
        {step === 'code' && (
          <form onSubmit={confirmCode} className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="space-y-2">
              <Label htmlFor="code">6-digit code</Label>
              <Input id="code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="flex gap-3">
              <Button type="submit" loading={busy}>Verify</Button>
              <Button type="button" variant="ghost" onClick={() => { setStep('email'); setMessage('') }}>
                Use a different email
              </Button>
            </div>
          </form>
        )}

        {message && <p role="status" className="text-sm">{message}</p>}

        {/* 我验证过的公司 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your verified companies</h2>
          {mine.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
          {mine.map((r) => (
            <div key={r.recordId} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <span>
                {r.data.company} <span className="text-muted-foreground">· @{r.data.domain}</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => removeVerification(r.recordId)}>Remove</Button>
            </div>
          ))}
        </section>

        {/* 所有内推人 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">All referrers</h2>
          {records.length === 0 && <p className="text-sm text-muted-foreground">No one has verified yet.</p>}
          {records.map((r) => (
            <div key={r.recordId} className="rounded-md border border-border px-4 py-3 text-sm">
              <span className="font-medium">{r.data.company}</span>{' '}
              <span className="text-muted-foreground">
                · verified @{r.data.domain} · {getName(r.data.userId) ?? 'Unknown'}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
