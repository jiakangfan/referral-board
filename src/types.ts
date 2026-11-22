// 几张表里一行数据的样子。页面和服务器操作都用这些类型，
// 写错字段名的话 VS Code 会标红。

export type RequestStatus = 'open' | 'claimed' | 'referred' | 'withdrawn'

// requests 表（公开部分）
export type ReferralRequest = {
  applicantId: string
  company: string
  domain: string
  jobId: string
  jobTitle?: string
  jobUrl?: string
  status: RequestStatus
  claimedBy: string
  claimedAt?: number
  referredAt?: number
  remindCount: number
  releaseCount: number
}

// request_private 表（私密部分）
export type RequestPrivate = {
  applicantId: string
  resumeText: string
  jobDescription: string
  referralNote: string
  viewers: string[]
}

// referrers 表
export type Referrer = {
  userId: string
  company: string
  domain: string
  verifiedAt: number
}
