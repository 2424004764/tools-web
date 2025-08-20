export async function onRequest(context) {
  const { request } = context;
  
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const { credential } = await request.json();
    
    if (!credential) {
      return new Response('Missing credential', { status: 400 });
    }
    
    // 验证谷歌JWT token
    const payload = JSON.parse(atob(credential.split('.')[1]));
    
    // 验证token的有效性（这里可以添加更多验证逻辑）
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp < currentTime) {
      return new Response('Token expired', { status: 401 });
    }
    
    // 创建用户会话或JWT token
    const userInfo = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      loginType: 'google',
      iat: currentTime,
      exp: currentTime + (24 * 60 * 60) // 24小时过期
    };
    
    // 这里可以添加数据库存储逻辑
    // await storeUserSession(userInfo);
    
    // 返回用户信息和认证token
    return new Response(JSON.stringify({
      success: true,
      user: userInfo,
      message: '登录成功'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error) {
    console.error('Google auth error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '认证失败',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 处理OPTIONS请求（CORS预检）
export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}