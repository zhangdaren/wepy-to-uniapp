const fs = require('fs-extra');
const path = require('path');
const t = require('@babel/types');
const generate = require('@babel/generator').default;

const utils = require('../utils/utils.js');
const pathUtil = require('../utils/pathUtil.js');


/**
 * 处理配置文件
 * 生成配置文件: pages.json、manifest.json、main.js
 * @param {*} configData        小程序配置数据
 * @param {*} routerData        所有的路由页面数据
 * @param {*} miniprogramRoot   小程序主体所在目录
 * @param {*} targetFolder      最终要生成的目录
 */
async function configHandle(appConfig, pageConfigs, miniprogramRoot, targetSrcFolder) {
	try {
		await new Promise((resolve, reject) => {
			////////////////////////////write pages.json/////////////////////////////

			//app.json里面引用的全局组件
			let globalUsingComponents = appConfig.usingComponents || {};
			globalUsingComponents = { ...globalUsingComponents, ...global.globalUsingComponents };

			//将pages节点里的数据，提取routerData对应的标题，写入到pages节点里
			let pages = [];
			for (const key in appConfig.pages) {
				let pagePath = appConfig.pages[key];
				let pageInfo = pageConfigs[key];
				let obj = {
					"path": pagePath,
					"style": pageInfo
				}
				pages.push(obj);
			}

			appConfig.pages = pages;


			//替换window节点为globalStyle
			appConfig["globalStyle"] = appConfig["window"];
			delete appConfig["window"];

			//usingComponents节点，上面删除缓存，这里删除
			delete appConfig["usingComponents"];

			//workers处理，简单处理一下
			if (appConfig["workers"]) appConfig["workers"] = "static/" + appConfig["workers"];

			//tabBar节点
			//将iconPath引用的图标路径进行修复
			let tabBar = appConfig["tabBar"];
			if (tabBar && tabBar.list && tabBar.list.length) {
				for (const key in tabBar.list) {
					let item = tabBar.list[key];
					/**
					 * 目前已知的规则：
					 * iconPath和selectedIconPath字段是使用/images下面的文件
					 * 而 /pages/images下面的文件是用于页面里的
					 * 其余情况后面发现再加入
					 */
					if (item.iconPath) item.iconPath = "./static/" + item.iconPath;
					if (item.selectedIconPath) item.selectedIconPath = "./static/" + item.selectedIconPath;
				}
			}

			//写入pages.json
			let file_pages = path.join(targetSrcFolder, "pages.json");
			fs.writeFile(file_pages, JSON.stringify(appConfig, null, '\t'), () => {
				console.log(`write ${path.relative(global.targetFolder, file_pages)} success!`);
			});

			////////////////////////////write manifest.json/////////////////////////////

			//这里还需要研究一下下~~~~
			let file_package = path.join(global.sourceFolder, "package.json");
			let packageJson = {};
			if (fs.existsSync(file_package)) {
				packageJson = fs.readJsonSync(file_package);
			}else{
				console.log("找不到package.json");
			}

			//注：因json里不能含有注释，因些template/manifest.json文件里的注释已经被删除。
			let file_manifest = path.join(__dirname, "./manifest.json");
			let manifestJson = {};
			if (fs.existsSync(file_manifest)) {
				manifestJson = fs.readJsonSync(file_manifest);
				//
				manifestJson.name = packageJson.name || "";
				manifestJson.description = packageJson.description || "";
				manifestJson.versionName = packageJson.version || "1.0.0";
				manifestJson["mp-weixin"].appid = packageJson.appid || "";
			}else{
				console.log("找不到manifest.json");
			}

			//manifest.json
			file_manifest = path.join(targetSrcFolder, "manifest.json");
			fs.writeFile(file_manifest, JSON.stringify(manifestJson, null, '\t'), () => {
				console.log(`write ${path.relative(global.targetFolder, file_manifest)} success!`);
			});

			////////////////////////////write main.js/////////////////////////////
			let mainContent = "import Vue from 'vue';\r\n";
			mainContent += "import App from './App';\r\n\r\n";

			//全局引入自定义组件
			//import firstcompoent from '../firstcompoent/firstcompoent'
			for (const key in globalUsingComponents) {
				//key可能含有后缀名，也可能是用-连接的，统统转成驼峰
				let newKey = utils.toCamel2(key);
				newKey = newKey.split(".vue").join(""); //去掉后缀名
				let filePath = globalUsingComponents[key];
				let extname = path.extname(filePath);
				if (extname) filePath = filePath.replace(extname, ".vue");
				filePath = filePath.replace(/^\//, "./"); //相对路径处理
				let node = t.importDeclaration([t.importDefaultSpecifier(t.identifier(newKey))], t.stringLiteral(filePath));
				mainContent += `${generate(node).code}\r\n`;
				let name = path.basename(filePath);
				name = name.split(".vue").join(""); //去掉后缀名
				name = utils.toCamel2(name);
				mainContent += `Vue.component('${name}', ${newKey});\r\n\r\n`;
			}
			//
			mainContent += "Vue.config.productionTip = false;\r\n\r\n";
			mainContent += "App.mpType = 'app';\r\n\r\n";
			mainContent += "const app = new Vue({\r\n";
			mainContent += "    ...App\r\n";
			mainContent += "});\r\n";
			mainContent += "app.$mount();\r\n";
			//
			let file_main = path.join(targetSrcFolder, "main.js");
			fs.writeFile(file_main, mainContent, () => {
				console.log(`write ${path.relative(global.targetFolder, file_main)} success!`);
			});

			//////////////////////////////////////////////////////////////////////
			resolve();
		});
	} catch (err) {
		console.log(err);
	}
}

module.exports = configHandle;
