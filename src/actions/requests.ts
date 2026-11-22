import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { ReferralRequest, Referrer, RequestPrivate } from '../types'

// 申请人的两个服务器操作
//   1. submitRequest   提交内推请求
//   2. withdrawRequest 撤回自己的请求

const MAX_TEXT = 20_000 // 简历和 JD 最多 2 万个字符

export const requestActions: Record<string, ActionHandler<Env>> = {
  submitRequest: async ({ userId, params, tools }) => {
    // 1. 读取并检查输入
    const domain = String(params.domain ?? '').trim().toLowerCase()
    const jobId = String(params.jobId ?? '').trim()
    const jobTitle = String(params.jobTitle ?? '').trim()
    const jobUrl = String(params.jobUrl ?? '').trim()
    const resumeText = String(params.resumeText ?? '').trim()
    const jobDescription = String(params.jobDescription ?? '').trim()

    if (!jobId || jobId.length > 50) return { success: false, error: 'Enter the job ID (50 characters max).' }
    if (jobTitle.length > 120) return { success: false, error: 'Job title is too long.' }
    if (jobUrl && !/^https?:\/\//.test(jobUrl)) return { success: false, error: 'The job link must start with http:// or https://.' }
    if (!resumeText) return { success: false, error: 'Paste your resume.' }
    if (resumeText.length > MAX_TEXT || jobDescription.length > MAX_TEXT) {
      return { success: false, error: 'Resume or job description is too long.' }
    }

    // 2. 这家公司必须至少有一个验证过的内推人，否则没人能接
    const refs = await tools.query<Referrer>('referrers', { where: { domain } })
    if (!refs.success || refs.data.records.length === 0) {
      return { success: false, error: 'No verified referrer at this company yet.' }
    }
    const company = refs.data.records[0].data.company

    // 3. 同一个人、同一家公司、同一个岗位，没撤回的请求只能有一个
    const mine = await tools.query<ReferralRequest>('requests', {
      where: { applicantId: userId, domain, jobId },
    })
    if (mine.success && mine.data.records.some((r) => r.data.status !== 'withdrawn')) {
      return { success: false, error: 'You already requested a referral for this job.' }
    }

    // 4. 公开部分：加进 requests 表，状态是 open（等人认领）
    const created = await tools.create('requests', {
      applicantId: userId,
      company,
      domain,
      jobId,
      jobTitle,
      jobUrl,
      status: 'open',
      claimedBy: '',
      remindCount: 0,
      releaseCount: 0,
    } satisfies ReferralRequest)
    if (!created.success) return created
    const requestId = created.data.recordId

    // 5. 私密部分：用同一个 recordId 加进 request_private 表。
    //    viewers 是空的，所以现在只有申请人自己能看
    const savedPrivate = await tools.create(
      'request_private',
      { applicantId: userId, resumeText, jobDescription, referralNote: '', viewers: [] } satisfies RequestPrivate,
      requestId,
    )
    if (!savedPrivate.success) {
      await tools.remove('requests', requestId) // 私密部分没存上，就把公开部分也删掉，不留半条
      return savedPrivate
    }

    return { success: true, data: { requestId } }
  },

  withdrawRequest: async ({ userId, params, tools }) => {
    const requestId = String(params.requestId ?? '')
    const got = await tools.get<ReferralRequest>('requests', requestId)
    if (!got.success) return { success: false, error: 'Request not found.' }
    const req = got.data.record.data

    // 只有申请人自己能撤回；已推或已撤回的不能再撤
    if (req.applicantId !== userId) return { success: false, error: 'Only the applicant can withdraw this request.' }
    if (req.status === 'referred' || req.status === 'withdrawn') {
      return { success: false, error: 'This request can no longer be withdrawn.' }
    }

    await tools.update('requests', requestId, { status: 'withdrawn', claimedBy: '' })
    await tools.update('request_private', requestId, { viewers: [] }) // 认领人也看不到简历了
    return { success: true, data: {} }
  },
}
