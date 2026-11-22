// 内推人认领之后看到的面板：简历、JD、推荐理由（可以让 AI 起草）、"已推"和"放弃"按钮
import { useEffect, useState } from 'react'
import { useMutations } from 'deepspace'
import type { RecordData } from 'deepspace'
import { Button, Textarea } from '@/components/ui'
import { callAction } from '@/lib/action'
import type { RequestPrivate } from '@/types'

export function ClaimedPanel({
  requestId,
  privateRecord,
  onError,
}: {
  requestId: string
  privateRecord?: RecordData<RequestPrivate> // 私密表里这一行。只有认领人和申请人能读到
  onError: (message: string) => void
}) {
  const { put } = useMutations<RequestPrivate>('request_private')
  const [note, setNote] = useState(privateRecord?.data.referralNote ?? '')
  const [busy, setBusy] = useState<'' | 'draft' | 'referred' | 'giveup'>('')

  // 服务器那边的推荐理由变了（比如 AI 刚写完），同步到输入框
  useEffect(() => {
    setNote(privateRecord?.data.referralNote ?? '')
  }, [privateRecord?.data.referralNote])

  async function run(kind: 'draft' | 'referred' | 'giveup', action: string) {
    setBusy(kind)
    onError('')
    const res = await callAction(action, { requestId })
    setBusy('')
    if (!res.success) onError(res.error)
  }

  if (!privateRecord) return <p className="text-sm text-muted-foreground">Loading resume…</p>

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <details open>
        <summary className="cursor-pointer text-sm font-medium">Resume</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
          {privateRecord.data.resumeText}
        </pre>
      </details>
      {privateRecord.data.jobDescription && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Job description</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
            {privateRecord.data.jobDescription}
          </pre>
        </details>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Referral note (copy this into your company's referral form)</p>
        <Textarea
          rows={5}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => put(requestId, { referralNote: note })} // 离开输入框时保存
          placeholder="Write a few sentences, or let AI draft one from the resume."
        />
        <Button size="sm" variant="secondary" loading={busy === 'draft'} onClick={() => run('draft', 'draftReferralNote')}>
          Draft with AI
        </Button>
      </div>

      <div className="flex gap-2">
        <Button size="sm" loading={busy === 'referred'} onClick={() => run('referred', 'markReferred')}>
          Mark referred
        </Button>
        <Button size="sm" variant="outline" loading={busy === 'giveup'} onClick={() => run('giveup', 'unclaimRequest')}>
          Give up
        </Button>
      </div>
    </div>
  )
}
