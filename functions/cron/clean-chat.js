/**
 * 清理临时聊天室一个月之前的消息
 * 定时任务接口，由 GitHub Actions 每天调用一次
 *
 * 需要在 Cloudflare Pages 设置中配置环境变量：
 * - CRON_SECRET: 定时任务调用密钥（调度方以 X-Cron-Secret 头携带，见 utils/cron-auth.js）
 * - SUPABASE_URL: Supabase 项目 URL (如 https://xxx.supabase.co)
 * - SUPABASE_SERVICE_KEY: Supabase service_role key (有删除权限)
 */
import { isCronAuthorized, cronUnauthorized } from '../utils/cron-auth.js'

export async function onRequest(context) {
  try {
    const { request, env } = context;

    // 定时任务鉴权：调度方（GitHub Actions）需带 X-Cron-Secret 头，见 utils/cron-auth.js
    if (!isCronAuthorized(request, env)) {
      return cronUnauthorized();
    }

    const supabaseUrl = env.SUPABASE_URL || '';
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少 Supabase 环境变量配置',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 计算一个月前的时间
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const cutoffTime = oneMonthAgo.toISOString();

    // 先查询要删除的数据量；count 请求失败必须显式报错，
    // 否则清理链路断掉会被静默当作"无需清理"，旧消息永久堆积
    const countResponse = await fetch(`${supabaseUrl}/rest/v1/chat_messages?select=count&created_at=lt.${cutoffTime}`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'count=exact',
      },
    });

    if (!countResponse.ok) {
      throw new Error(`Supabase count 查询失败: ${countResponse.status}`);
    }

    let deletedCount = 0;
    const contentRange = countResponse.headers.get('Content-Range');
    if (contentRange) {
      // Content-Range 格式: "*/Y" 或 "0-X/Y"
      const match = contentRange.match(/\/(\d+)/);
      if (match) {
        deletedCount = parseInt(match[1]) || 0;
      }
    }

    // 如果有需要删除的数据，执行删除
    if (deletedCount > 0) {
      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/chat_messages?created_at=lt.${cutoffTime}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Supabase 删除失败: ${deleteResponse.status} ${errorText}`);
      }
    }

    const message = deletedCount > 0
      ? `已清理 ${deletedCount} 条一个月前的聊天消息`
      : '没有需要清理的旧消息';

    return new Response(JSON.stringify({
      success: true,
      message,
      deletedCount,
      cutoffTime,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('清理聊天消息失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
