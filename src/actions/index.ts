import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { referrerActions } from './referrers'
import { requestActions } from './requests'
import { claimActions } from './claims'

// 所有服务器操作都在这里登记。每个操作会自动变成一个网址：POST /api/actions/<名字>
export const actions: Record<string, ActionHandler<Env>> = {
  ...referrerActions, // 内推人邮箱验证
  ...requestActions, // 申请人：提交、撤回
  ...claimActions, // 内推人：认领、放弃、已推、AI 起草
}
