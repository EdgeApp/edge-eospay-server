import babel from 'rollup-plugin-babel'
const packageJson = require('./package.json')

export default {
  entry: 'src/checkServers.js',
  external: Object.keys(packageJson.dependencies),
  plugins: [babel({})],
  targets: [
    {
      dest: 'lib/checkServers.js',
      format: 'cjs',
      sourceMap: true
    }
  ]
}
