import { isCronAuthorized, cronUnauthorized } from '../utils/cron-auth.js'

export async function onRequest(context) {
    if (!isCronAuthorized(context.request, context.env)) {
        return cronUnauthorized()
    }
    return new Response('定时任务测试接口调用成功', { status: 200 });
}
