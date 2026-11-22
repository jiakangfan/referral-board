// 网站的几条规则，全部放在这里。要改规则只改这个文件。
// 服务器操作、定时任务、页面都从这里读。

export const DAY_MS = 24 * 60 * 60 * 1000 // 一天有多少毫秒

export const REMIND_AFTER_MS = 3 * DAY_MS // 认领后 3 天还没推 → 发邮件提醒认领人
export const RELEASE_AFTER_MS = 7 * DAY_MS // 认领后 7 天还没推 → 自动放回，别人可以认领

export const MAX_ACTIVE_CLAIMS = 3 // 一个内推人同时最多认领 3 个（防止一次拿走很多份简历）
