/**
 * 清理临时聊天室一个月之前的消息
 * 定时任务接口，由 GitHub Actions 每天调用一次
 *
 * 需要在 Cloudflare Pages 设置中配置环境变量：
 * - SUPABASE_URL: Supabase 项目 URL
 * - SUPABASE_SERVICE_KEY: Supabase service_role key (有删除权限)
 */
import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
  try {
    const { env } = context;
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

    // 使用 service role key 以获得删除权限
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 计算一个月前的时间
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const cutoffTime = oneMonthAgo.toISOString();

    // 删除一个月前的所有消息
    const { data, error, count } = await supabase
      .from('chat_messages')
      .delete()
      .lt('created_at', cutoffTime)
      .select('count', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    const message = count > 0
      ? `已清理 ${count} 条一个月前的聊天消息`
      : '没有需要清理的旧消息';

    return new Response(JSON.stringify({
      success: true,
      message,
      deletedCount: count,
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
