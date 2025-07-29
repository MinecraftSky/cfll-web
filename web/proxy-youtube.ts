// 导入 Oak 框架的 Application 类，用于创建 Web 服务器
import { Application } from "https://deno.land/x/oak@v10.1.0/mod.ts";

// 导入 oak_http_proxy 的 proxy 函数，用于创建代理服务器
import { proxy } from "https://deno.land/x/oak_http_proxy@2.1.0/mod.ts";

// 创建一个新的 Application 实例，用于处理 HTTP 请求
const app = new Application();

// 添加 CORS 中间件，允许跨域请求
app.use(async (ctx, next) => {
  // 设置允许所有来源的跨域请求
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  // 设置允许的请求头，包括 Cookie、User-Agent 和 Referer
  ctx.response.headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Cookie, User-Agent, Referer");
  // 设置允许的请求方法
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  // 支持 Cookie 的跨域请求
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  
  // 处理 OPTIONS 预检请求
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  
  await next();
});

// 配置代理，将所有请求转发到 youtube.com，并处理登录及相关头信息
app.use(proxy("https://www.youtube.com", {
  // 确保请求头中的 Host 保持为 youtube.com，避免目标服务器混淆
  preserveHostHeader: true,
  
  // 解析请求体，确保 POST 请求（如登录表单）的数据被正确转发
  parseReqBody: true,
  
  // 设置请求体编码为 UTF-8，适配 YouTube 的登录请求
  reqBodyEncoding: "utf-8",
  
  // 设置请求体大小限制为 10MB，避免大文件上传导致超时
  reqBodyLimit: 10_485_760,
  
  // 自定义请求装饰器，处理登录相关的请求头（包括 Cookie、User-Agent 和 Referer）
  proxyReqInitDecorator: (proxyReqOpts, srcReq) => {
    // 复制原始请求的 Cookie，确保登录会话能够保持
    const cookies = srcReq.headers.get("cookie");
    if (cookies) {
      proxyReqOpts.headers.set("Cookie", cookies);
    }
    
    // 设置 User-Agent，模拟真实浏览器请求，避免 YouTube 检测为机器人
    proxyReqOpts.headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
    
    // 设置 Referer，模拟从 youtube.com 发起的请求，增加可信度
    proxyReqOpts.headers.set("Referer", "https://www.youtube.com");
    
    // 返回修改后的请求选项
    return proxyReqOpts;
  },
  
  // 自定义响应装饰器，处理登录相关的重定向和 Cookie
  proxyResDecorator: async (proxyRes, proxyResData, srcReq, srcRes) => {
    // 如果响应包含 Set-Cookie 头，将其传递给客户端以维持登录会话
    const setCookie = proxyRes.headers.get("set-cookie");
    if (setCookie) {
      srcRes.headers.set("set-cookie", setCookie);
    }
    
    // 返回原始响应数据
    return proxyResData;
  }
}));

// 启动服务器，监听 8000 端口，以便本地测试
// 访问 http://localhost:8000 即可通过代理访问 YouTube
await app.listen({ port: 8000 });