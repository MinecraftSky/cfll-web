// 导入 oak_http_proxy 的 proxy 函数，用于实现 HTTP 代理
import { proxy } from "https://deno.land/x/oak_http_proxy@2.3.0/mod.ts";
// 导入 Oak 框架的 Application 和 Router 类，用于创建 web 服务器和路由
import { Application, Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";

// 创建 Oak 应用程序实例
const app = new Application();
// 创建路由器实例
const router = new Router();

// 配置 CORS 中间件，允许跨域请求
app.use(async (ctx, next) => {
  // 设置 CORS 头，允许所有来源（生产环境中可限制为特定域名）
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, User-Agent, Referer, Cookie");
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true"); // 支持带凭证的请求（如 Cookies）

  // 处理 OPTIONS 预检请求
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  await next();
});

// 配置代理中间件，目标为 claude.ai
const proxyMiddleware = proxy("https://claude.ai", {
  // 确保转发所有请求头，包括 User-Agent、Referer 和 Authorization
  forwardHeaders: true,
  // 保留客户端会话，支持登录功能
  preserveReqSession: true,
  // 自定义转发头，确保 User-Agent 和 Referer 被正确传递
  headers: {
    "User-Agent": true, // 转发客户端的 User-Agent
    "Referer": true,    // 转发客户端的 Referer
    "Cookie": true,     // 保留 Cookies，支持会话
    "Authorization": true, // 支持可能的身份验证头
  },
});

// 定义根路由，处理所有请求并代理到 claude.ai
router.all("(.*)", async (ctx, next) => {
  // 在代理前记录 User-Agent 和 Referer（用于调试）
  console.log("请求 User-Agent:", ctx.request.headers.get("User-Agent"));
  console.log("请求 Referer:", ctx.request.headers.get("Referer"));
  await proxyMiddleware(ctx, next);
});

// 使用路由中间件
app.use(router.routes());
app.use(router.allowedMethods());

// 错误处理中间件，捕获代理过程中的错误
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = { error: "代理服务器错误，请稍后重试" };
    console.error("错误:", err);
  }
});

// 启动服务器，监听 8000 端口（可根据需要修改）
console.log("代理服务器启动于 http://localhost:8000");
await app.listen({ port: 8000 });