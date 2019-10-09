const fs = require('fs-extra');
const path = require('path');

const utils = require('../utils/utils.js');
const pathUtil = require('../utils/pathUtil.js');

const t = require('@babel/types');
const nodePath = require('path');
const parse = require('@babel/parser').parse;
const generate = require('@babel/generator').default;
const traverse = require('@babel/traverse').default;

const template = require('@babel/template').default;

const componentConverter = require('./script/componentConverter');
const JavascriptParser = require('./script/JavascriptParser')


/**
 * 将ast属性数组组合为ast对象
 * @param {*} pathAry 
 */
function arrayToObject(pathAry, property) {
    let obj = {};
    switch (property) {
        case "mixins":
            obj = t.arrayExpression(pathAry);
            break;
        default:
            obj = t.objectExpression(pathAry);
            break;
    }

    return obj;
}

/**
 * 子页面/组件的模板
 */
const componentTemplate =
    `
export default {
  data() {
    return DATA
  },
  mixins: MIXINS,
  components: COMPONENTS,
  props:PROPS,
  methods: METHODS,
  computed: COMPUTED,
  watch:WATCH,
}
`;

/**
 * 处理require()里的路径
 * @param {*} path      CallExpression类型的path，未做校验
 * @param {*} fileDir   当前文件所在目录
 */
function requireHandle(path, fileDir) {
    let callee = path.node.callee;
    if (t.isIdentifier(callee, { name: "require" })) {
        //处理require()路径
        let arguments = path.node.arguments;
        if (arguments && arguments.length) {
            if (t.isStringLiteral(arguments[0])) {
                let filePath = arguments[0].value;
                filePath = pathUtil.relativePath(filePath, global.miniprogramRoot, fileDir);
                path.node.arguments[0] = t.stringLiteral(filePath);
            }
        }
    }
}


/**
 * 组件模板处理
 */
const componentTemplateBuilder = function (ast, vistors, filePath, isApp) {
    let buildRequire = null;

    //非app.js文件
    buildRequire = template(componentTemplate);

    ast = buildRequire({
        PROPS: arrayToObject(vistors.props.getData(), "props"),
        DATA: arrayToObject(vistors.data.getData(), "data"),
        MIXINS: arrayToObject(vistors.mixins.getData(), "mixins"),
        COMPONENTS: arrayToObject(vistors.components.getData(), "components"),
        METHODS: arrayToObject(vistors.methods.getData(), "methods"),
        COMPUTED: arrayToObject(vistors.computed.getData(), "computed"),
        WATCH: arrayToObject(vistors.watch.getData(), "watch"),
        // LIFECYCLE: arrayToObject(vistors.lifeCycle.getData(), "lifeCycle"),
    });

    //获取配置
    let config = vistors.config.getData();
    let oe = t.objectExpression(config);  //需要先转成objectExpression才能转成字符串
    let code = generate(oe).code;
    let object = null;
    try {
        object = eval('(' + code + ')');  //非标准json，使用JSON.parse()无法转换
    } catch (error) {
        console.log("config解析失败，file: " + filePath);
    }

    if (object) {
        if (isApp) {
            global.appConfig = object;

        } else {
            let extname = path.extname(filePath).toLowerCase();
            let fileNameNoExt = pathUtil.getFileNameNoExt(filePath);
            let relativePath = path.relative(global.sourceFolder, filePath);
            relativePath = relativePath.split(extname).join("");
            const key = relativePath.split("\\").join("/");

            //判断是否有引用自定义组件
            if (!object.usingComponents || JSON.stringify(object.usingComponents) == "{}") {
                object.usingComponents = {};
            }

            //处理根路径
            for (const kk in object.usingComponents) {
                let value = object.usingComponents[kk];
                //plugin是微信自定义组件
                if (value.indexOf("plugin:") == -1) {
                    let fileDir = path.dirname(filePath);
                    value = pathUtil.relativePath(value, global.miniprogramRoot, fileDir);
                    global.pageUsingComponents[kk] = value;
                }
            }

            delete object.usingComponents;
            //
            global.pageConfigs[key] = object;
        }
    }
    let fileDir = path.dirname(filePath);

    traverse(ast, {
        noScope: true,
        ImportDeclaration(path) {
            requireHandle(path, fileDir);
        },
        ObjectMethod(path) {
            const name = path.node.key.name;
            if (name === 'data') {
                //将require()里的地址都处理一遍
                traverse(path.node, {
                    noScope: true,
                    CallExpression(path2) {
                        requireHandle(path2, fileDir);
                    }
                });

                let liftCycleArr = vistors.lifeCycle.getData();
                //逆序一下
                liftCycleArr = liftCycleArr.reverse();
                for (let key in liftCycleArr) {
                    // console.log(liftCycleArr[key]);
                    path.insertAfter(liftCycleArr[key]);
                }
                //停止，不往后遍历了
                path.skip();
            }
        },

        ObjectProperty(path) {
            // const name = path.node.key.name;
            // console.log("--------", path);
            // console.log("--------", path);
            // if (name === "mixins") {
            //     console.log("--------", path);
            //     console.log("--------", path);
            //     var aa = t.arrayExpression(vistors.mixins.getData());
            //     path.node.value = aa;
            //     // let mixinsArr = vistors.mixins.getData();
            //     // for (let key in mixinsArr) {
            //     // 	path.insertAfter(mixinsArr[key]);
            //     // }
            // }
        },
        CallExpression(path) {
            let callee = path.node.callee;
            //将wx.createWorker('workers/fib/index.js')转为wx.createWorker('./static/workers/fib/index.js');
            if (t.isMemberExpression(callee)) {
                let object = callee.object;
                let property = callee.property;
                if (t.isIdentifier(object, { name: "wx" }) && t.isIdentifier(property, { name: "createWorker" })) {
                    let arguments = path.node.arguments;
                    if (arguments && arguments.length > 0) {
                        let val = arguments[0].value;
                        arguments[0] = t.stringLiteral("./static/" + val);
                    }
                }
            } else {
                requireHandle(path, fileDir);
            }
        }
    });
    return ast;
}


/**
 * 处理css文件 
 * 1.内部引用的wxss文件修改为css文件
 * 2.修正引用的wxss文件的路径
 * 
 * @param {*} fileContent       css文件内容
 * @param {*} file_wxss         当前处理的文件路径
 */
async function scriptHandle(v, filePath, targetFilePath, isApp) {
    let styleContent = v.toString();
    try {
        return await new Promise((resolve, reject) => {
            //先反转义
            let javascriptContent = v.childNodes.toString(),
                //初始化一个解析器
                javascriptParser = new JavascriptParser()

            //去除无用代码   
            javascriptContent = javascriptParser.beforeParse(javascriptContent);

            //去掉命名空间及标志
            javascriptContent = utils.restoreTagAndEventBind(javascriptContent);

            javascriptContent = utils.decode(javascriptContent);


            // console.log("javascriptContent   --  ", javascriptContent)
            //解析成AST
            javascriptParser.parse(javascriptContent).then((javascriptAst) => {
                //进行代码转换
                let { convertedJavascript, vistors, declareStr } = componentConverter(javascriptAst, isApp);
                //放到预先定义好的模板中
                convertedJavascript = componentTemplateBuilder(convertedJavascript, vistors, filePath, isApp)

                //生成文本并写入到文件
                let codeText = `<script>\r\n${declareStr}\r\n${generate(convertedJavascript).code}\r\n</script>\r\n`;
                resolve(codeText);
            });
        });
    } catch (err) {
        console.log(err);
    }
}

module.exports = scriptHandle;
