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
  
      // 安全地解析JWT token
      let payload;
      try {
        // 分割JWT token
        const parts = credential.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid JWT format');
        }
  
        // 解码payload部分
        const payloadBase64 = parts[1];
  
        // 处理base64url编码，转换为标准Base64
        let base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
  
        // 添加必要的padding
        while (base64.length % 4) {
          base64 += '=';
        }
  
        // 【修复点】使用标准、现代的方式解码包含UTF-8字符的Base64字符串
        // 1. 使用 atob() 将 Base64 解码为一个 "二进制字符串"
        const binaryString = atob(base64);
  
        // 2. 将 "二进制字符串" 转换为字节数组 (Uint8Array)
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // 3. 使用 TextDecoder API 将字节数组按 UTF-8 编码正确解析为字符串
        const decodedString = new TextDecoder('utf-8').decode(bytes);
  
        // 4. 解析JSON
        payload = JSON.parse(decodedString);
  
        console.log('Decoded payload:', payload);
  
      } catch (parseError) {
        console.error('JWT parsing error:', parseError);
        console.error('Original credential:', credential);
        return new Response(JSON.stringify({
          success: false,
          error: '无效的认证凭据',
          message: 'JWT解析失败: ' + parseError.message
        }), { status: 400 });
      }
  
      // 验证token的有效性
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < currentTime) {
        return new Response(JSON.stringify({
          success: false,
          error: '认证凭据已过期',
          message: '请重新登录'
        }), { status: 401 });
      }
  
      // 验证必要的字段
      if (!payload.sub || !payload.email) {
        return new Response(JSON.stringify({
          success: false,
          error: '认证凭据不完整',
          message: '缺少必要的用户信息'
        }), { status: 400 });
      }
  
      // 创建用户会话，确保中文字符正确
      const userInfo = {
        id: payload.sub,
        name: payload.name || payload.email.split('@')[0],
        email: payload.email,
        picture: payload.picture || '',
        loginType: 'google',
        iat: currentTime,
        exp: currentTime + (24 * 60 * 60) // 24小时过期
      };
  
      console.log('Created user info:', userInfo);
  
      // 返回用户信息和认证token，确保正确的Content-Type和编码
      return new Response(JSON.stringify({
        success: true,
        user: userInfo,
        message: '登录成功'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
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
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  // 处理OPTIONS请求（CORS预检），这部分保持不变
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