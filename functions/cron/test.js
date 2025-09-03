export default {
  async fetch(request, env, ctx) {
    // 简单的测试响应
    const response = {
      status: 'success',
      message: '定时任务测试接口调用成功',
      timestamp: new Date().toISOString(),
      requestMethod: request.method,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '未知',
      data: {
        testId: Math.random().toString(36).substr(2, 9),
        environment: env ? 'production' : 'development',
        randomNumber: Math.floor(Math.random() * 1000)
      }
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
};
