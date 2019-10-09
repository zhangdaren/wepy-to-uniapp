/*
*
* 
*/
const fs = require('fs-extra');
const path = require('path');
const Xmldom = require('xmldom');

const TemplateParser = require('./template/TemplateParser');
const templateConverter = require('./template/templateConverter');


const utils = require('../utils/utils.js');
const pathUtil = require('../utils/pathUtil.js');

/**
 * 判断是否为多根元素模式
 * 分为三种情况：
 * 1.wxml里有多个tag标签
 * 2.根元素含有wx:for或v-for属性
 * 2.根元素只有一个，但含有wx:if属性
 * @param {*} ast 
 */
function checkMultiTag(ast) {
	//判断是否有多个标签存在于一个wxml文件里
	let isMultiTag = false;
	let count = 0;
	let tagList = [];
	ast.forEach(node => {
		if (node.type == "tag") {
			count++;
			//如果根元素含有wx:for，需要在外面再包一层
			if (node.attribs["wx:for"] || node.attribs["v-for"]) isMultiTag = true;
			tagList.push(node);
		}
	});
	if (count > 1) isMultiTag = true;
	if(count == 1)
	{
		if(tagList[0].attribs["wx:if"]) isMultiTag = true;
	}
	return isMultiTag;
}



/**
 * templateHandle文件处理
 * @param {*} fileData wxml文件内容
 * @param {*} file_wxml 当前操作的文件路径
 */
async function templateHandle(v, fileDir, filename, targetFilePath) {
	try {
		return await new Promise((resolve, reject) => {
			//初始化一个解析器
			const templateParser = new TemplateParser();

			//优化ast，key和value相等时候，value设为空
			templateParser.astOptimizer(v.childNodes);

			let templateContent = v.childNodes.toString();

			// let reg = /<template([\s\S]*?)<\/template>/g;

			// //查找有多少个template
			// let tmpArr = templateContent.match(reg) || [];
			// let templateNum = tmpArr.length;

			//去掉命名空间及标志
			templateContent = utils.restoreTagAndEventBind(templateContent);
			templateContent = utils.decode(templateContent);

			//生成语法树
			templateParser.parse(templateContent).then((templateAst) => {

				//判断根标签上是否包含wx:for或v-for
				let isMultiTag = checkMultiTag(templateAst);

				//进行上述目标的转换
				let convertedTemplate = templateConverter(templateAst);
				//把语法树转成文本
				templateConvertedString = templateParser.astToString(convertedTemplate);

				if (isMultiTag) {
					templateConvertedString = `<template>\r\n<view>\r\n${templateConvertedString}\r\n</view>\r\n</template>\r\n\r\n`;
				} else {
					templateConvertedString = `<template>\r\n${templateConvertedString}\r\n</template>\r\n\r\n`;
				}
				resolve(templateConvertedString);
			})
		});
	} catch (err) {
		console.log(err);
	}
}

module.exports = templateHandle;
