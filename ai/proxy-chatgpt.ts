// 导入 Deno 标准库中的 HTTP 服务器模块，用于创建服务器
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// 定义请求处理函数，接收客户端请求并转发到 chatgpt.com
async function handler(req: Request) {
  // 解析客户端请求的 URL
  const url = new URL(req.url);
  // 构造目标 URL，指向 chatgpt.com，保留路径和查询参数
  const targetUrl = `https://chatgpt.com${url.pathname}${url.search}`;
  
  // 复制客户端请求的头部
  const headers = new Headers(req.headers);
  // 设置 Host 头部为 chatgpt.com，以符合目标服务器要求
  headers.set("Host", "chatgpt.com");
  // 设置默认 User-Agent，防止 Cloudflare 检测到异常请求
  headers.set("User-Agent", req.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  // 转发 Referer 头部，若客户端未提供，则使用 chatgpt.com 作为默认值
  headers.set("Referer", req.headers.get("Referer") || "https://chatgpt.com");
  // 转发 Cookie，确保登录会话有效
  if (req.headers.get("Cookie")) {
    headers.set("Cookie", req.headers.get("Cookie")!);
  }

  // 使用 fetch API 转发请求到 chatgpt.com
  const response = await fetch(targetUrl, {
    method: req.method, // 保持原始请求方法（GET、POST 等）
    headers: headers,   // 传递修改后的头部
    body: req.body,    // 传递请求体（如登录表单数据）
    redirect: "manual" // 手动处理重定向，防止会话丢失
  });

  // 创建响应头部，复制目标服务器的头部
  const responseHeaders = new Headers(response.headers);
  // 转发 Set-Cookie 头部，维持登录会话
  if (response.headers.get("Set-Cookie")) {
    responseHeaders.set("Set-Cookie", response.headers.get("Set-Cookie")!);
  }
  // 添加 CORS 头部，允许跨域请求
  responseHeaders.set("Access-Control-Allow-Origin", "*"); // 允许所有来源
  responseHeaders.set("Access-Control-Allow-Credentials", "true"); // 允许凭据（如 Cookie）
  responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"); // 允许的请求方法
  responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, User-Agent, Referer"); // 允许的请求头部

  // 处理预检请求（OPTIONS），满足 CORS 要求
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders
    });
  }

  // 返回响应，包含状态码、头部和响应体
  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders
  });
}

// 启动 HTTP 服务器，监听端口 8000，处理客户端请求
serve(handler, { port: 8000 });