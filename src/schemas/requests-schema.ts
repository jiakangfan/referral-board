import type { CollectionSchema } from 'deepspace/schema'

const nobody = { read: false, create: false, update: false, delete: false }

// 内推请求（公开部分）：群里所有人都能看到
// 一条记录 = 某个申请人想要某家公司某个岗位的内推
export const requestsSchema: CollectionSchema = {
  name: 'requests',
  columns: [
    { name: 'applicantId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'company', storage: 'text', interpretation: 'plain', required: true },
    { name: 'domain', storage: 'text', interpretation: 'plain', required: true }, // 公司邮箱域名，用来和内推人表对上
    { name: 'jobId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'jobTitle', storage: 'text', interpretation: 'plain' },
    { name: 'jobUrl', storage: 'text', interpretation: { kind: 'url' } },
    {
      name: 'status',
      storage: 'text',
      // open = 等人认领, claimed = 有人认领了, referred = 已推, withdrawn = 申请人撤回
      interpretation: { kind: 'select', options: ['open', 'claimed', 'referred', 'withdrawn'] },
      default: 'open',
    },
    { name: 'claimedBy', storage: 'text', interpretation: 'plain', default: '' }, // 认领人的 user id，没人认领时是空字符串
    { name: 'claimedAt', storage: 'number', interpretation: 'plain' }, // 认领时间，毫秒
    { name: 'referredAt', storage: 'number', interpretation: 'plain' }, // 标记已推的时间，毫秒
    { name: 'remindCount', storage: 'number', interpretation: 'plain', default: 0 }, // 系统提醒过认领人几次
    { name: 'releaseCount', storage: 'number', interpretation: 'plain', default: 0 }, // 因为拖太久被放回过几次
  ],
  ownerField: 'applicantId',
  permissions: {
    '*': nobody,
    viewer: nobody,
    // 普通成员只能看，不能直接改。
    // 提交、认领、标记已推、撤回都走服务器上的 action（src/actions/index.ts），
    // 由服务器检查规则：比如同一个岗位不能重复提交，只有认领人能标记已推。
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

// 内推请求（私密部分）：简历和 JD
// 只有申请人自己和当前认领人能看。recordId 和对应的 requests 记录相同。
export const requestPrivateSchema: CollectionSchema = {
  name: 'request_private',
  columns: [
    { name: 'applicantId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'resumeText', storage: 'text', interpretation: 'plain' },
    { name: 'jobDescription', storage: 'text', interpretation: 'plain' },
    { name: 'referralNote', storage: 'text', interpretation: 'plain', default: '' }, // 推荐理由（AI 起草，内推人修改）
    { name: 'viewers', storage: 'text', interpretation: { kind: 'json' } }, // [认领人 id]；放回时清空
  ],
  ownerField: 'applicantId',
  collaboratorsField: 'viewers',
  permissions: {
    '*': nobody,
    viewer: nobody,
    // 'collaborator' = 申请人本人 或者 在 viewers 名单里的人
    // 认领人只能改推荐理由这一个字段
    member: {
      read: 'collaborator',
      create: false,
      update: 'collaborator',
      delete: false,
      writableFields: ['referralNote'],
    },
    // 管理员（网站主人）也看不到别人的简历，只能删除
    admin: { read: 'collaborator', create: false, update: 'collaborator', delete: true },
  },
}
