const path = require('path')
const isWin = /^win/.test(process.platform)
const normalizePath = path => (isWin ? path.replace(/\\/g, '/') : path)
process.env.UNI_INPUT_DIR = path.join(__dirname, './src')

module.exports = {
	configureWebpack: {
		resolve: {
			alias: {
				'@': path.resolve(__dirname, './src'),
				'assets': path.resolve(__dirname, './src/static')
			}
		}
	}
}
