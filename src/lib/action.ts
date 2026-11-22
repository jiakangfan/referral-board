import { getAuthToken } from 'deepspace'

export type ActionResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

// 从网页调用服务器操作（src/actions/ 里的函数）。
// 带上登录凭证，服务器才知道是谁在操作。
export async function callAction<T = unknown>(
  name: string,
  params: Record<string, unknown>,
): Promise<ActionResponse<T>> {
  try {
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify(params),
    })
    const body = (await res.json()) as { success?: boolean; data?: T; error?: string }
    if (body.success) return { success: true, data: body.data as T }
    return { success: false, error: body.error ?? `Request failed (${res.status})` }
  } catch {
    return { success: false, error: 'Network error. Try again.' }
  }
}
