// 定时任务：每小时检查一次所有"已认领"的请求
//   认领满 3 天还没推 → 给认领人发一封提醒邮件（每次认领只提醒一次）
//   认领满 7 天还没推 → 自动放回，同公司的其他内推人可以认领
import type { CronTask } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../worker'
import type { ReferralRequest } from './types'
import { DAY_MS, REMIND_AFTER_MS, RELEASE_AFTER_MS } from './rules'

type Row<T> = { recordId: string; data: T }

export const tasks: CronTask[] = [{ name: 'nudge-referrers', intervalMinutes: 60 }]

export async function runTask(name: string, env: Env): Promise<void> {
  if (name !== 'nudge-referrers') return

  // 定时任务以网站主人的身份运行，不受表的权限限制
  const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
  const claimed = (await ctx.records.query('requests', {
    where: { status: 'claimed' },
    limit: 500,
  })) as Row<ReferralRequest>[]

  for (const r of claimed) {
    const waited = Date.now() - (r.data.claimedAt ?? Date.now())

    if (waited >= RELEASE_AFTER_MS) {
      // 放回：和"放弃认领"一样，再把"被放回过几次"加 1
      await ctx.records.update('requests', r.recordId, {
        status: 'open',
        claimedBy: '',
        claimedAt: null,
        remindCount: 0,
        releaseCount: r.data.releaseCount + 1,
      })
      await ctx.records.update('request_private', r.recordId, { viewers: [] })
      console.info(`[nudge] released ${r.recordId}`)
    } else if (waited >= REMIND_AFTER_MS && r.data.remindCount === 0) {
      // 提醒：先记下"已提醒"，再发邮件（就算邮件发失败也不会每小时重发）
      await ctx.records.update('requests', r.recordId, { remindCount: 1 })
      const users = (await ctx.records.query('users', {
        where: { recordId: r.data.claimedBy },
        limit: 1,
      })) as Row<{ email?: string }>[]
      const email = users[0]?.data.email
      if (!email) continue
      const daysLeft = Math.ceil((RELEASE_AFTER_MS - waited) / DAY_MS)
      try {
        await ctx.integrations.call('email/send', {
          from: 'Referral Board <referral-board@app.space>',
          to: email,
          subject: `Reminder: referral for ${r.data.company} ${r.data.jobId}`,
          text:
            `You claimed a referral request for ${r.data.company} (${r.data.jobTitle || r.data.jobId}) ` +
            `${Math.floor(waited / DAY_MS)} days ago.\n\n` +
            `Please refer the applicant and mark it referred, or give it up so another referrer can help. ` +
            `If nothing happens, it goes back to the board in ${daysLeft} days.`,
        })
        console.info(`[nudge] reminded claimer of ${r.recordId}`) // 日志里只写 id，不写邮箱
      } catch (err) {
        console.error(`[nudge] reminder for ${r.recordId} failed: ${(err as Error).message}`)
      }
    }
  }
}
