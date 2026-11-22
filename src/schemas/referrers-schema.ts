import type { CollectionSchema } from 'deepspace/schema'

// 内推人表：一行 = "某个人通过了某家公司的工作邮箱验证"
// 比如 { userId: Tom的id, company: "NVIDIA", domain: "nvidia.com" }
// 只存域名（nvidia.com），不存完整邮箱地址
export const referrersSchema: CollectionSchema = {
  name: 'referrers',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'company', storage: 'text', interpretation: 'plain', required: true },
    { name: 'domain', storage: 'text', interpretation: 'plain', required: true },
    { name: 'verifiedAt', storage: 'number', interpretation: 'plain' }, // 验证通过的时间，毫秒
  ],
  ownerField: 'userId',
  permissions: {
    // 没登录的人：什么都不能看
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: false, create: false, update: false, delete: false },
    // 登录的人：都能看到谁能推哪家；
    // 加和删都不能直接做：加要先通过邮箱验证，删要先确认手上没有这家公司的认领，
    // 都由服务器操作完成（sendReferrerCode / confirmReferrerCode / removeReferrer）
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: true },
  },
}
