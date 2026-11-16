import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleAiRequest } from './api/ai.ts';

const MAX_LOCAL_BODY_BYTES = 64_000;

export default defineConfig(() => ({
  plugins: [
    react(),
    {
      name: 'mailmind-local-ai-api',
      configureServer(server) {
        const loadedEnvironment = loadEnv(server.config.mode, server.config.root, '');
        for (const key of ['GROQ_API_KEY', 'GROQ_MODEL', 'ALLOWED_ORIGINS'] as const) {
          if (process.env[key] === undefined && loadedEnvironment[key] !== undefined) {
            process.env[key] = loadedEnvironment[key];
          }
        }

        server.middlewares.use('/api/ai', (request, response, _next) => {
          if (request.method !== 'POST') {
            void handleAiRequest({ method: request.method, headers: request.headers, socket: request.socket }, {
              setHeader: (name, value) => response.setHeader(name, value),
              status(code) {
                response.statusCode = code;
                return this;
              },
              json(body) {
                response.end(JSON.stringify(body));
              },
            });
            return;
          }

          void (async () => {
            const chunks: Uint8Array[] = [];
            let size = 0;
            for await (const chunk of request) {
              const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk);
              size += bytes.byteLength;
              if (size > MAX_LOCAL_BODY_BYTES) {
                response.statusCode = 413;
                response.setHeader('Content-Type', 'application/json; charset=utf-8');
                response.end(JSON.stringify({
                  ok: false,
                  error: { code: 'too_large', message: 'Request is too large.' },
                }));
                return;
              }
              chunks.push(bytes);
            }

            const bodyBytes = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {
              bodyBytes.set(chunk, offset);
              offset += chunk.byteLength;
            }

            await handleAiRequest({
              method: request.method,
              headers: request.headers,
              socket: request.socket,
              body: new TextDecoder().decode(bodyBytes),
            }, {
              setHeader: (name, value) => response.setHeader(name, value),
              status(code) {
                response.statusCode = code;
                return this;
              },
              json(result) {
                response.end(JSON.stringify(result));
              },
            });
          })().catch(() => {
            response.statusCode = 500;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({
              ok: false,
              error: { code: 'ai_unavailable', message: 'The AI service is temporarily unavailable. Please try again.' },
            }));
          });
        });
      },
    },
  ],
}));
