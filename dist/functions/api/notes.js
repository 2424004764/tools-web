export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace('/api/notes', '')

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // Handle preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    // 确保D1数据库存在
    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'Database not available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 根据HTTP方法和路径处理请求
    switch (request.method) {
      case 'GET':
        if (path === '' || path === '/') {
          // 获取所有笔记
          const result = await env.DB.prepare(`
            SELECT id, title, content, 
                   create_time as createTime, 
                   update_time as updateTime
            FROM notes 
            ORDER BY update_time DESC
          `).all()
          
          return new Response(JSON.stringify({ notes: result.results }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } else {
          // 获取单个笔记
          const id = path.substring(1)
          const result = await env.DB.prepare(`
            SELECT id, title, content, 
                   create_time as createTime, 
                   update_time as updateTime
            FROM notes 
            WHERE id = ?
          `).get(id)
          
          if (result) {
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          } else {
            return new Response(JSON.stringify({ error: 'Note not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        }
        break

      case 'POST':
        // 创建新笔记
        const createData = await request.json()
        const createId = crypto.randomUUID()
        
        await env.DB.prepare(`
          INSERT INTO notes (id, title, content)
          VALUES (?, ?, ?)
        `).bind(createId, createData.title, createData.content).run()
        
        return new Response(JSON.stringify({ 
          id: createId, 
          message: 'Note created successfully' 
        }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'PUT':
        const updateId = path.substring(1)

        return new Response(JSON.stringify({ updateId: updateId, path: path }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

        // 更新笔记
        if (path === '' || path === '/') {
          return new Response(JSON.stringify({ error: 'Note ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        
        // 先检查笔记是否存在
        const existingNote = await env.DB.prepare(`
          SELECT id FROM notes WHERE id = ?
        `).get(updateId)
        
        if (!existingNote) {
          return new Response(JSON.stringify({ error: 'Note not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const updateData = await request.json()
        
        const updateResult = await env.DB.prepare(`
          UPDATE notes 
          SET title = ?, content = ?, update_time = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(updateData.title, updateData.content, updateId).run()
        
        return new Response(JSON.stringify({ message: 'Note updated successfully' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

      case 'DELETE':
        // 删除笔记
        if (path === '' || path === '/') {
          return new Response(JSON.stringify({ error: 'Note ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const deleteId = path.substring(1)
        const deleteResult = await env.DB.prepare(`
          DELETE FROM notes WHERE id = ?
        `).bind(deleteId).run()
        
        if (deleteResult.changes > 0) {
          return new Response(JSON.stringify({ message: 'Note deleted successfully' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } else {
          return new Response(JSON.stringify({ error: 'Note not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('Notes API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}