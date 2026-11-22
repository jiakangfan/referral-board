import type { CollectionSchema } from 'deepspace/schema'

const nobody = { read: false, create: false, update: false, delete: false }

// 验证码表：临时的，只有服务器能读写，任何用户（包括管理员）都看不到
// 每个用户最多一行（recordId = userId），验证通过后马上删掉
export const emailCodesSchema: CollectionSchema = {
  name: 'email_codes',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'company', storage: 'text', interpretation: 'plain' },
    { name: 'email', storage: 'text', interpretation: 'plain' },
    { name: 'domain', storage: 'text', interpretation: 'plain' },
    { name: 'codeHash', storage: 'text', interpretation: 'plain' }, // 验证码的哈希，不存验证码本身
    { name: 'expiresAt', storage: 'number', interpretation: 'plain' }, // 过期时间，毫秒
    { name: 'attempts', storage: 'number', interpretation: 'plain', default: 0 }, // 输错了几次
    { name: 'sentAt', storage: 'number', interpretation: 'plain' }, // 上次发送时间，用来限制发送频率
  ],
  permissions: {
    '*': nobody,
    viewer: nobody,
    member: nobody,
    admin: nobody,
  },
}
