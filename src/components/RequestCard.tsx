// 一张请求卡片：公司、岗位、申请人、状态、进度。首页列表里每一行都是它
import type { ReactNode } from 'react'
import type { RecordData } from 'deepspace'
import { Badge, type BadgeProps } from '@/components/ui'
import type { ReferralRequest, RequestStatus } from '@/types'
import { DAY_MS, RELEASE_AFTER_MS } from '@/rules'

const STATUS: Record<RequestStatus, { label: string; variant: BadgeProps['variant'] }> = {
  open: { label: 'Waiting for a referrer', variant: 'warning' },
  claimed: { label: 'Claimed', variant: 'info' },
  referred: { label: 'Referred', variant: 'success' },
  withdrawn: { label: 'Withdrawn', variant: 'outline' },
}

// 毫秒时间 → "Nov 19"
function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// 过了几天
function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / DAY_MS)
}

// 1 → "1 day"，2 → "2 days"
function days(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}

export function RequestCard({
  record,
  getName,
  actions,
}: {
  record: RecordData<ReferralRequest>
  getName: (userId: string) => string | null
  actions?: ReactNode // 卡片右边的按钮（撤回、认领等），由页面决定放什么
}) {
  const r = record.data
  const submittedAt = new Date(record.createdAt).getTime()
  const status = STATUS[r.status]

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">
            {r.company} · {r.jobTitle || 'Untitled role'}{' '}
            <span className="text-muted-foreground">({r.jobId})</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Requested by {getName(r.applicantId) ?? 'Unknown'}
            {r.jobUrl && (
              <>
                {' · '}
                <a href={r.jobUrl} target="_blank" rel="noreferrer" className="underline">
                  Job posting
                </a>
              </>
            )}
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {/* 进度：提交 → 认领 → 已推 */}
      <p className="text-xs text-muted-foreground">
        Submitted {shortDate(submittedAt)}
        {r.status === 'open' && ` · waiting ${days(daysSince(submittedAt))}`}
        {r.claimedBy && r.claimedAt && (
          <>
            {' · '}Claimed by {getName(r.claimedBy) ?? 'Unknown'} {shortDate(r.claimedAt)}
            {r.status === 'claimed' &&
              ` (${days(daysSince(r.claimedAt))} ago, back on the board in ${days(
                Math.max(0, Math.ceil((r.claimedAt + RELEASE_AFTER_MS - Date.now()) / DAY_MS)),
              )} if not referred)`}
          </>
        )}
        {r.referredAt && ` · Referred ${shortDate(r.referredAt)}`}
        {r.remindCount > 0 && ` · reminded ${r.remindCount}×`}
        {r.releaseCount > 0 && ` · released ${r.releaseCount}×`}
      </p>

      {actions && <div className="flex gap-2 pt-1">{actions}</div>}
    </div>
  )
}
