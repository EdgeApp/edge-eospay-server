import babel from 'rollup-plugin-babel'
const packageJson = require('./package.json')

export default {
  entry: 'src/getPeers.js',
  external: Object.keys(packageJson.dependencies),
  plugins: [babel({})],
  targets: [
    {
      dest: 'lib/getPeers.js',
      format: 'cjs',
      sourceMap: true
    }
  ]
}
