// 博客动态站点地图
// GET /sitemap-blog.xml   输出全部已发布文章的 <url>（含 lastmod）。
// 动态输出的意义：新发文无需重新构建即可被搜索引擎收录（静态 sitemap.xml 只含构建期已知的路由）。
// 表缺失/查询失败时输出空 sitemap，不给爬虫报错。
import { siteOrigin } from './_page-meta.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
}

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// 'YYYY-MM-DD HH:MM:SS'（UTC）→ W3C 格式（YYYY-MM-DDTHH:MM:SSZ）；解析失败返回 null
function toW3CDate(value) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export async function onRequest(context) {
  const { env } = context

  let urls = ''
  try {
    if (env && env.DB) {
      const { results } = await env.DB
        .prepare(
          `SELECT slug, updated_at, published_at FROM blog_posts
           WHERE status = 'published' AND published_at IS NOT NULL
           ORDER BY published_at DESC LIMIT 5000`,
        )
        .all()
      for (const row of results || []) {
        const lastmod = toW3CDate(row.updated_at || row.published_at)
        urls +=
          `  <url>\n` +
          `    <loc>${xmlEscape(`${siteOrigin}/blog/${row.slug}/`)}</loc>\n` +
          (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
          `  </url>\n`
      }
    }
  } catch (e) {
    // 表未迁移 / 查询异常：输出空 sitemap，不影响站点其他部分
    console.error('sitemap-blog query failed:', e)
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls +
    `</urlset>\n`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      ...corsHeaders,
    },
  })
}
