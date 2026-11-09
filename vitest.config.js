import { defineConfig } from 'vitest/config'

// Pruebas de lógica pura (utils): entorno Node, sin los plugins de la app (PWA, React).
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
