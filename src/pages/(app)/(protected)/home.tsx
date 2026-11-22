// 首页 Board：网址 /home，必须登录
// 从上到下：我认领的 → 我可以认领的 → 我的请求 → 其他人的请求
import { useState } from 'react'
import { useAuth, useCronMonitor, useQuery, useUser, useUserLookup } from 'deepspace'
import { Button } from '@/components/ui'
import { ClaimedPanel } from '@/components/ClaimedPanel'
import { RequestCard } from '@/components/RequestCard'
import { SCOPE_ID } from '@/constants'
import { callAction } from '@/lib/action'
import { Link } from '@/router'
import type { ReferralRequest, Referrer, RequestPrivate } from '@/types'

export default function BoardPage() {
  const { userId } = useAuth()
  const { getName } = useUserLookup()
  const [error, setError] = useState('')

  // 三张表。数据一变，页面自动更新
  const { records, status } = useQuery<ReferralRequest>('requests', { orderBy: 'createdAt', orderDir: 'desc' })
  const { records: myReferrers } = useQuery<Referrer>('referrers', { where: { userId } })
  const { records: privates } = useQuery<RequestPrivate>('request_private') // 只会收到我有权限看的那些行

  const myDomains = new Set(myReferrers.map((r) => r.data.domain)) // 我验证过的公司域名

  // 把请求分成四组
  const claimedByMe = records.filter((r) => r.data.claimedBy === userId && r.data.status === 'claimed')
  const canClaim = records.filter(
    (r) => r.data.status === 'open' && r.data.applicantId !== userId && myDomains.has(r.data.domain),
  )
  const mine = records.filter((r) => r.data.applicantId === userId)
  const shown = new Set([...claimedByMe, ...canClaim, ...mine].map((r) => r.recordId))
  const others = records.filter((r) => !shown.has(r.recordId) && r.data.status !== 'withdrawn')

  async function act(action: string, requestId: string) {
    setError('')
    const res = await callAction(action, { requestId })
    if (!res.success) setError(res.error)
  }

  if (status === 'loading') return <p className="px-6 py-16 text-center text-muted-foreground">Loading…</p>

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-3xl space-y-10 px-6 py-16">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Referral board</h1>
            <p className="text-sm text-muted-foreground">
              Ask for a referral, see who picked it up, and how long it has been waiting.
            </p>
          </div>
          <Link to="/ask">
            <Button>Ask for a referral</Button>
          </Link>
        </header>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {claimedByMe.length > 0 && (
          <Section title="Claimed by you">
            {claimedByMe.map((r) => (
              <div key={r.recordId} className="space-y-0">
                <RequestCard record={r} getName={getName} />
                <div className="rounded-b-lg border border-t-0 border-border bg-card px-4 pb-4">
                  <ClaimedPanel
                    requestId={r.recordId}
                    privateRecord={privates.find((p) => p.recordId === r.recordId)}
                    onError={setError}
                  />
                </div>
              </div>
            ))}
          </Section>
        )}

        {myDomains.size > 0 && (
          <Section title="You can refer" empty={canClaim.length === 0 ? 'No open requests at your companies.' : ''}>
            {canClaim.map((r) => (
              <RequestCard
                key={r.recordId}
                record={r}
                getName={getName}
                actions={
                  <Button size="sm" onClick={() => act('claimRequest', r.recordId)}>
                    Claim and view resume
                  </Button>
                }
              />
            ))}
          </Section>
        )}

        <Section title="My requests" empty={mine.length === 0 ? "You haven't asked for a referral yet." : ''}>
          {mine.map((r) => (
            <RequestCard
              key={r.recordId}
              record={r}
              getName={getName}
              actions={
                (r.data.status === 'open' || r.data.status === 'claimed') && (
                  <Button size="sm" variant="outline" onClick={() => act('withdrawRequest', r.recordId)}>
                    Withdraw
                  </Button>
                )
              }
            />
          ))}
        </Section>

        <Section title="Everyone else" empty={others.length === 0 ? 'No other requests yet.' : ''}>
          {others.map((r) => (
            <RequestCard key={r.recordId} record={r} getName={getName} />
          ))}
        </Section>

        <ReminderJob />
      </div>
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {empty && <p className="text-sm text-muted-foreground">{empty}</p>}
      {children}
    </section>
  )
}

// 只有管理员看得到：定时任务上次什么时候跑的，以及"马上跑一次"按钮（测试用）
function ReminderJob() {
  const { user } = useUser()
  const { history, connected, trigger } = useCronMonitor(SCOPE_ID)
  const [result, setResult] = useState('')
  if (user?.role !== 'admin') return null

  const last = history[0]
  return (
    <section className="space-y-2 rounded-lg border border-dashed border-border p-4 text-sm">
      <p className="font-medium">Reminder job (admin only)</p>
      <p className="text-muted-foreground">
        Runs every hour: reminds a referrer 3 days after claiming, releases the request after 7.
        {last && ` Last run: ${new Date(last.startedAt).toLocaleString()}.`}
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={!connected}
        onClick={async () => {
          setResult('Running…')
          const receipt = await trigger('nudge-referrers')
          setResult(receipt.ok ? 'Done.' : `Failed: ${receipt.reason ?? 'unknown'}`)
        }}
      >
        Run check now
      </Button>
      {result && <span className="ml-3 text-muted-foreground">{result}</span>}
    </section>
  )
}
