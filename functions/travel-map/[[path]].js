// 旅游地图页面直通 Function（2026-11 CSP 修复）
//
// 线上 prerender 出的静态页面默认不经过 Functions（自动生成的 _routes.json 把
// 静态资源路径排除了），根 _middleware.js 的页面改写（SEO meta / no-store /
// 天地图路径级 CSP 放宽）因此对 /travel-map* 不生效——天地图 SDK 4.1.6 注入的
// 内联脚本被严格 CSP 拦截，点位 T.Label 画不出来。
// 这里放一个直通 Function 让 /travel-map* 强制走 Functions 链路：本文件只把
// 请求交还给静态资源（context.next()），响应头改写全部由根 _middleware.js 完成。
export const onRequest = (context) => context.next()
