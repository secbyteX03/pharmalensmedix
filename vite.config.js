import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')
  
  // Expose environment variables to the client
  const define = {
    'process.env': {}
  };

  // Only expose VITE_ prefixed environment variables
  Object.keys(env).forEach(key => {
    if (key.startsWith('VITE_')) {
      define['process.env'][key] = JSON.stringify(env[key]);
    }
  });

  // Combine both define configurations
  const combinedDefine = {
    ...define,
    'import.meta.env': JSON.stringify(env)
  };

  return {
    root: 'public',
    define: combinedDefine,
    server: {
      port: 3000,
      open: true
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('public/index.html', import.meta.url))
        }
      }
    }
  }
})
