const fs = require('fs-extra');
const path = require('path');


/**
 * 处理vue cli项目配置文件
 * @param {*} configData           小程序配置数据
 * @param {*} outputFolder         输出目录
 */
async function vueCliHandle(configData, outputFolder, targetSrcFolder) {

	try {
		await new Promise((resolve, reject) => {
			const pathArray = [
				{
					source: "vue_cli/public/index.html",
					target: "public/index.html"
				},
				{
					source: "vue_cli/.gitignore",
					target: ".gitignore"
				},
				{
					source: "vue_cli/babel.config.js",
					target: "babel.config.js"
				},
				{
					source: "vue_cli/package.json",
					target: "package.json",
					raplaceArray: [
						"<%= PROJECT_NAME %>"
					],
				},
				// {
				// 	source: "vue_cli/package-lock.json",
				// 	target: "package-lock.json",
				// 	raplaceArray: [
				// 		"<%= PROJECT_NAME %>"
				// 	],
				// },
				{
					source: "vue_cli/postcss.config.js",
					target: "postcss.config.js"
				},
				{
					source: "vue_cli/README.md",
					target: "README.md",
					raplaceArray: [
						"<%= PROJECT_NAME %>"
					],
				},
				{
					source: "vue_cli/vue.config.js",
					target: "vue.config.js",
				},
			]

			for (const key in pathArray) {
				const obj = pathArray[key];
				const source = obj.source;
				const target = obj.target;
				const raplaceArray = obj.raplaceArray;
				const file_source = path.join(__dirname, source);
				const file_target = path.join(outputFolder, target);
				if (raplaceArray) {
					let fileContent = fs.readFileSync(file_source, 'utf-8');
					for (const key2 in raplaceArray) {
						const flag = raplaceArray[key2];
						// console.log(flag);
						switch (flag) {
							case "<%= PROJECT_NAME %>":
								fileContent = fileContent.replace(flag, configData.name);
								break;
							default:
								break;
						}
					}

					fs.writeFile(file_target, fileContent, () => {
						console.log(`write ${target} success!`);
					});
				} else {
					fs.copySync(file_source, file_target);
					console.log(`copy ${target} success!`);
				}
			}

			//////////////////////////////////////////////////////////////////////
			resolve();
		});
	} catch (err) {
		console.log(err);
	}
}

module.exports = vueCliHandle;
