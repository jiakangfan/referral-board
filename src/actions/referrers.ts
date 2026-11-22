import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { ReferralRequest, Referrer } from '../types'

// 内推人：三个服务器操作
//   1. sendReferrerCode    填公司名和工作邮箱 → 往这个邮箱发 6 位验证码
//   2. confirmReferrerCode 填验证码 → 对了就把这个人加进内推人表
//   3. removeReferrer      取消自己在某家公司的验证（手上还有这家的认领就不让取消）

const CODE_TTL_MS = 10 * 60 * 1000 // 验证码 10 分钟后失效
const RESEND_WAIT_MS = 60 * 1000 // 两次发送至少隔 1 分钟（每封邮件要花钱）
const MAX_ATTEMPTS = 5 // 最多输错 5 次

// 个人邮箱不算工作邮箱
const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com',
  'qq.com', 'foxmail.com', '163.com', '126.com', 'sina.com', 'yeah.net',
])

type EmailCode = {
  userId: string
  company: string
  email: string
  domain: string
  codeHash: string
  expiresAt: number
  attempts: number
  sentAt: number
}

// 把文字变成 SHA-256 哈希。数据库里只存哈希，就算数据泄露也看不到验证码
async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 生成 6 位随机数字，比如 "042917"
function makeCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return n.toString().padStart(6, '0')
}

export const referrerActions: Record<string, ActionHandler<Env>> = {
  sendReferrerCode: async ({ userId, params, tools }) => {
    // 1. 检查输入
    const company = String(params.company ?? '').trim()
    const email = String(params.email ?? '').trim().toLowerCase()
    if (!company || company.length > 60) {
      return { success: false, error: 'Enter a company name (60 characters max).' }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Enter a valid work email.' }
    }
    const domain = email.split('@')[1]
    if (PUBLIC_DOMAINS.has(domain)) {
      return { success: false, error: 'Use your work email, not a personal one.' }
    }

    // 2. 限制频率：距离上次发送不到 1 分钟就拒绝
    const existing = await tools.get<EmailCode>('email_codes', userId)
    if (existing.success) {
      const old = existing.data.record.data
      if (Date.now() - old.sentAt < RESEND_WAIT_MS) {
        return { success: false, error: 'Please wait a minute before requesting another code.' }
      }
    }

    // 3. 生成验证码，存它的哈希（recordId 用 userId，所以每人只有一行，新的覆盖旧的）
    const code = makeCode()
    const now = Date.now()
    const saved = await tools.create(
      'email_codes',
      {
        userId,
        company,
        email,
        domain,
        codeHash: await sha256(`${userId}:${code}`),
        expiresAt: now + CODE_TTL_MS,
        attempts: 0,
        sentAt: now,
      },
      userId,
    )
    if (!saved.success) return saved

    // 4. 发邮件（DeepSpace 自带的 email/send，每封 $0.013，从网站主人的余额扣）
    const sent = await tools.integration('email/send', {
      from: 'Referral Board <referral-board@app.space>',
      to: email,
      subject: `Your Referral Board code: ${code}`,
      text:
        `Your verification code is ${code}. It expires in 10 minutes.\n\n` +
        `You are confirming that you work at ${company} (${domain}). ` +
        `If you did not request this, you can ignore this email.`,
    })
    if (!sent.success) {
      return { success: false, error: 'Could not send the email. Try again later.' }
    }
    return { success: true, data: { domain } }
  },

  confirmReferrerCode: async ({ userId, params, tools }) => {
    const code = String(params.code ?? '').trim()

    // 1. 找到这个人的验证码记录
    const got = await tools.get<EmailCode>('email_codes', userId)
    if (!got.success) return { success: false, error: 'Request a code first.' }
    const row = got.data.record.data

    // 2. 过期、输错太多次都拒绝
    if (Date.now() > row.expiresAt) {
      return { success: false, error: 'This code has expired. Request a new one.' }
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return { success: false, error: 'Too many wrong tries. Request a new code.' }
    }

    // 3. 比较哈希：不对就把"输错次数"加 1
    if ((await sha256(`${userId}:${code}`)) !== row.codeHash) {
      await tools.update('email_codes', userId, { attempts: row.attempts + 1 })
      return { success: false, error: 'Wrong code.' }
    }

    // 4. 对了：加进内推人表（同一个人同一个域名只加一次）
    const dup = await tools.query('referrers', { where: { userId, domain: row.domain } })
    const alreadyThere = dup.success && dup.data.records.length > 0
    if (!alreadyThere) {
      const created = await tools.create('referrers', {
        userId,
        company: row.company,
        domain: row.domain,
        verifiedAt: Date.now(),
      })
      if (!created.success) return created
    }

    // 5. 验证码用完就删，完整邮箱地址不留在数据库里
    await tools.remove('email_codes', userId)
    return { success: true, data: { company: row.company, domain: row.domain } }
  },

  removeReferrer: async ({ userId, params, tools }) => {
    const referrerId = String(params.referrerId ?? '')
    const got = await tools.get<Referrer>('referrers', referrerId)
    if (!got.success) return { success: false, error: 'Not found.' }
    const ref = got.data.record.data

    // 1. 只能取消自己的验证
    if (ref.userId !== userId) return { success: false, error: 'You can only remove your own verification.' }

    // 2. 手上还有这家公司的认领：先推或者放弃，否则简历还在一个"已经不是内推人"的人手里
    const held = await tools.query<ReferralRequest>('requests', {
      where: { claimedBy: userId, status: 'claimed', domain: ref.domain },
    })
    const count = held.success ? held.data.records.length : 0
    if (count > 0) {
      return {
        success: false,
        error: `You still hold ${count} claim${count === 1 ? '' : 's'} at ${ref.company}. Refer or give ${count === 1 ? 'it' : 'them'} up first.`,
      }
    }

    await tools.remove('referrers', referrerId)
    return { success: true, data: {} }
  },
}
