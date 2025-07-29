// 导入 Deno 标准库中的 serve 函数，用于创建 HTTP 服务器
import { serve } from "https://deno.land/std/http/server.ts";

// 定义目标域名（中文维基百科）
const TARGET_HOST = "zh.m.wikipedia.org";

// 启动 HTTP 服务器，处理客户端请求
serve(async (req) => {
  // 解析客户端请求的 URL
  const url = new URL(req.url);
  // 构建目标 URL，将请求路径和查询参数附加到目标域名
  const targetUrl = `https://${TARGET_HOST}${url.pathname}${url.search}`;

  // 复制客户端的请求头
  const headers = new Headers(req.headers);
  // 设置 Host 头为目标域名，确保请求正确路由
  headers.set("Host", TARGET_HOST);
  
  // 保留 User-Agent 头，确保维基百科服务器能识别客户端类型
  if (req.headers.get("User-Agent")) {
    headers.set("User-Agent", req.headers.get("User-Agent") || "");
  }
  
  // 保留 Referer 头，传递原始的引用页面信息
  if (req.headers.get("Referer")) {
    headers.set("Referer", req.headers.get("Referer") || "");
  }

  // 保留 Cookie 以支持会话和登录
  if (req.headers.get("Cookie")) {
    headers.set("Cookie", req.headers.get("Cookie") || "");
  }

  // 准备 fetch 请求的选项
  const fetchOptions: RequestInit = {
    method: req.method, // 保留原始请求方法（GET、POST 等）
    headers: headers,   // 传递修改后的请求头
    redirect: "manual", // 手动处理重定向，确保登录相关的重定向正常
  };

  // 如果请求不是 GET 或 HEAD，则包含请求体（例如 POST 登录表单数据）
  if (req.method !== "GET" && req.method !== "HEAD") {
    fetchOptions.body = req.body;
  }

  // 使用 try-catch 处理异常，确保服务器稳定运行
  try {
    // 向目标 URL 发送请求并获取响应
    const response = await fetch(targetUrl, fetchOptions);

    // 复制响应头，并添加 CORS 相关头以支持跨域请求
    const responseHeaders = new Headers(response.headers);
    // 允许跨域请求
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    // 允许携带凭据（如 Cookie）
    responseHeaders.set("Access-Control-Allow-Credentials", "true");
    // 允许的请求头，包括 Content-Type、Cookie、User-Agent 和 Referer
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Cookie, User-Agent, Referer");
    // 允许的请求方法
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS");

    // 处理 OPTIONS 请求（CORS 预检请求）
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: responseHeaders,
      });
    }

    // 返回维基百科的响应，包含状态码、头部和响应体
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    // 当代理请求失败时，返回 500 错误并记录错误信息
    console.error("代理错误:", error);
    return new Response("代理请求失败", { status: 500 });
  }
}, { port: 8000 });