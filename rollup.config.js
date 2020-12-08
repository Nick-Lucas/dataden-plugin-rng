import typescript from '@wessberg/rollup-plugin-ts'
import commonjs from '@rollup/plugin-commonjs'

/**
 * @type {() => import("rollup").RollupOptions}
 */
export default () => ({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
    sourcemap: true,
    exports: 'default'
  },
  plugins: [
    typescript({
      tsconfig: 'tsconfig.json',
      exclude: ['node_modules/**/*', '*/**/node_modules/**/*']
    }),
    commonjs()
  ].filter(Boolean)
})
