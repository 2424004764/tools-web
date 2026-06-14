export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json()
    const authHeader = context.request.headers.get('Authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: { message: 'Missing Authorization header' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const response = await fetch('https://apihub.agnes-ai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: { message: error.message } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
