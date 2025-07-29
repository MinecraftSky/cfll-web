// 使用 Deno.serve 创建一个 HTTP 服务器，监听指定端口
Deno.serve({ port: 8080 }, async (request) => {
  // 处理 CORS 预检请求 (OPTIONS)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*", // 允许所有域名，生产环境可限制
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, User-Agent, Referer",
        "Access-Control-Max-Age": "86400", // 缓存预检请求 24 小时
      },
    });
  }

  // 解析传入请求的 URL，获取路径和查询参数
  const { pathname, search } = new URL(request.url);
  
  // 构建目标 URL，将请求的路径附加到 gemini.google.com
  const url = new URL(pathname, 'https://gemini.google.com');
  url.search = search;

  // 创建新的 Headers 对象，复制原始请求的头部
  const headers = new Headers(request.headers);
  // 设置 Host 头部为目标域名
  headers.set('Host', 'gemini.google.com');
  // 设置 Referer 头部，模拟从 gemini.google.com 发起的请求
  headers.set('Referer', 'https://gemini.google.com' + pathname);
  // 设置或传递 User-Agent，防止 Google 检测异常
  headers.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36');
  // 传递 Cookie 以支持会话和登录
  if (request.headers.get('Cookie')) {
    headers.set('Cookie', request.headers.get('Cookie'));
  }

  try {
    // 使用 fetch 将请求转发到目标 URL
    const response = await fetch(url, {
      method: request.method, // 使用原始请求的 HTTP 方法
      headers,               // 使用修改后的头部
      body: request.body,    // 传递原始请求的 body
      redirect: 'manual',    // 手动处理重定向
    });

    // 创建新的响应头部，传递返回的 Cookie 以维持会话
    const responseHeaders = new Headers(response.headers);
    // 添加 CORS 头部，允许跨域访问
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    // 确保返回的 Set-Cookie 头部被传递给客户端
    if (response.headers.get('Set-Cookie')) {
      responseHeaders.set('Set-Cookie', response.headers.get('Set-Cookie'));
    }

    // 处理重定向（登录流程可能涉及多次重定向）
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get('Location');
      if (redirectUrl) {
        // 如果是相对路径，转换为代理路径
        return new Response(null, {
          status: response.status,
          headers: {
            'Location': redirectUrl.startsWith('/')
              ? `http://localhost:8080${redirectUrl}`
              : redirectUrl,
            'Set-Cookie': response.headers.get('Set-Cookie') || '',
            'Access-Control-Allow-Origin': '*', // 确保重定向响应支持 CORS
          },
        });
      }
    }

    // 返回目标服务器的响应
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    // 错误处理
    console.error('代理请求失败:', error);
    return new Response('代理请求失败', { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});