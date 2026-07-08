import externalGlobals from 'rollup-plugin-external-globals'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig(({ command }) => {
  return {
    define: {
      'process.env': {
        NODE_ENV: JSON.stringify(
          command === 'build' ? 'production' : 'development',
        ),
      },
      __PLUGIN_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      minify: false,
      lib: {
        entry: 'src/main.ts',
        fileName: 'index',
        formats: ['es'],
      },
      rollupOptions: {
        // react 和 valtio 都外部化（由 Orca Note 全局提供）
        // 对话框用原生 DOM 实现，不需要 react-dom
        external: ['react', 'valtio'],
      },
    },
    plugins: [
      externalGlobals({ react: 'React', valtio: 'Valtio' }),
    ],
  }
})
