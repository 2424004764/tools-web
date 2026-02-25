import { ResumeRouter } from '../routes/resume.js'

export async function onRequest(context) {
  const { request, env } = context
  const origin = request.headers.get('Origin')
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/resumes', '') || '/'

  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }

  try {
    const resumeRouter = new ResumeRouter(env.DB)
    return await resumeRouter.handle(request, path, env, origin)
  } catch (error) {
    console.error('简历API错误:', error)
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin || '*'
      }
    })
  }
}