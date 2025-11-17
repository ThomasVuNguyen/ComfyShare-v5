import { defineConfig } from 'vite'

const linkPreviewPlugin = () => {
  const handler = (req, res, next) => {
    if (!req.url?.startsWith('/api/link-preview') || req.method !== 'POST') {
      return next()
    }

    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {}
        const targetUrl = typeof payload?.url === 'string' ? payload.url : ''
        const urlObject = (() => {
          try {
            return targetUrl ? new URL(targetUrl) : null
          } catch {
            return null
          }
        })()

        const hostname = urlObject?.hostname ?? 'example.test'

        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            success: 1,
            meta: {
              title: hostname,
              description: `Mock preview for ${targetUrl || 'your link'}.`,
              site_name: hostname,
              url: targetUrl,
              image: {
                url: 'https://images.unsplash.com/photo-1472289065668-ce650ac443d2?auto=format&fit=crop&w=600&q=80'
              }
            }
          })
        )
      } catch (error) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: 0, error: error.message }))
      }
    })
  }

  return {
    name: 'mock-link-preview-endpoint',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    }
  }
}

export default defineConfig({
  plugins: [linkPreviewPlugin()],
  server: {
    host: true,
    port: 1306
  },
  preview: {
    host: true,
    port: 1306
  }
})
