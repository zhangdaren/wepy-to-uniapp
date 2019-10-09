//html标签替换规则，可以添加更多
const tagConverterConfig = {
	// 'view': 'div',
	// 'image': 'img'
}
//属性替换规则，也可以加入更多
const attrConverterConfig = {
	// 'wx:for': {
	// 	key: 'v-for',
	// 	value: (str) => {
	// 		return str.replace(/{{(.*)}}/, '(item,key) in $1')
	// 	}
	// },
	'wx:if': {
		key: 'v-if',
		value: (str) => {
			return str.replace(/{{(.*)}}/, '$1')
		}
	},
	'wx-if': {
		key: 'v-if',
		value: (str) => {
			return str.replace(/{{(.*)}}/, '$1')
		}
	},
	'wx:else': {
		key: 'v-else',
		value: (str) => {
			return str.replace(/{{ ?(.*?) ?}}/, '$1').replace(/\"/g, "'")
		}
	},
	'wx:elif': {
		key: 'v-else-if',
		value: (str) => {
			return str.replace(/{{ ?(.*?) ?}}/, '$1').replace(/\"/g, "'")
		}
	},
	'scrollX': {
		key: 'scroll-x',
		value: (str) => {
			return str.replace(/{{ ?(.*?) ?}}/, '$1').replace(/\"/g, "'")
		}
	},
	'scrollY': {
		key: 'scroll-y',
		value: (str) => {
			return str.replace(/{{ ?(.*?) ?}}/, '$1').replace(/\"/g, "'")
		}
	},
	'bindtap': {
		key: '@tap',
		value: (str) => {
			return str.replace(/{{ ?(.*?) ?}}/, '$1').replace(/\"/g, "'")
		}
	},
	'bind:tap': {
		key: '@tap',
		value: (str) => {
			return str.replace(/{{ ?(.*?) ?}}/, '$1').replace(/\"/g, "'")
		}
	},
	'catchtap': {
		key: '@click.stop',
		value: (str) => {
			return str.replace(/{{ ?(.*?) ?}}/, '$1').replace(/\"/g, "'")
		}
	},
	'bindinput': {
		key: '@input'
	},
	'bindgetuserinfo': {
		key: '@getuserinfo'
	},
	'catch:tap': {
		key: '@tap.native.stop',
		value: (str) => {
			return str.replace(/{{ ?(.*?) ?}}/, '$1').replace(/\"/g, "'")
		}
	},
}

/**
 * 1. 替换bind为@，有两种情况：bindtap="" 和 bind:tap=""，
 * 2. 转换@tap.user=""为@tap
 */
function replaceBindToAt(attr) {
	return attr.replace(/^bind:*/, "@").replace(/(@.*?).user/, "$1");
}

/**
 * 替换wx:abc为:abc
 */
function replaceWxBind(attr) {
	return attr.replace(/^wx:*/, ":");
}

/**
 * 遍历往上查找祖先，看是否有v-for存在，存在就返回它的:key，不存在返回空
 */
function findParentsWithFor(node) {
	if (node.parent) {
		if (node.parent.attribs["v-for"]) {
			return node.parent.attribs[":key"];
		} else {
			return findParentsWithFor(node.parent);
		}
	}
}

//表达式列表
const expArr = [" + ", " - ", " * ", " / ", "?"];
/**
 * 查找字符串里是否包含加减乘除以及？等表达式
 * @param {*} str 
 */
function checkExp(str) {
	return expArr.some(function (exp) {
		return str.indexOf(exp) > -1;
	});
}

//替换入口方法
const templateConverter = function (ast) {
	let reg_tag = /{{.*?}}/; //注：连续test时，这里不能加/g，因为会被记录上次index位置
	for (let i = 0; i < ast.length; i++) {
		let node = ast[i];
		//检测到是html节点
		if (node.type === 'tag') {
			//进行标签替换  
			if (tagConverterConfig[node.name]) {
				node.name = tagConverterConfig[node.name];
			}
			//进行属性替换
			let attrs = {}
			for (let k in node.attribs) {
				let target = attrConverterConfig[k];
				if (target) {
					//单独判断style的绑定情况
					let key = target['key'];
					let value = node.attribs[k];
					//将双引号转换单引号
					value = value.replace(/\"/g, "'");

					// if (k == 'style') {
					// 	let hasBind = value.indexOf("{{") > -1;
					// 	key = hasBind ? ':style' : this.key;
					// } else 
					if (k == 'url') {
						let hasBind = value.indexOf("{{") > -1;
						key = hasBind ? ':url' : this.key;
					}
					attrs[key] = target['value'] ?
						target['value'](node.attribs[k]) :
						node.attribs[k];

				} else if (k == 'wx:key' || k == 'wx:for' || k == 'for' || k == 'wx:for-items') {
					//wx:for单独处理
					//wx:key="*item" -----不知道vue支持不
					/**
					 * wx:for规则:
					 * 
					 * 情况一：
					 * <block wx:for="{{uploadImgsArr}}" wx:key="">{{item.savethumbname}}</block>
					 * 解析规则：
					 * 1.没有key时，设为index
					 * 2.没有wx:for-item时，默认设置为item
					 * 
					 * 情况二：
					 * <block wx:for="{{hotGoodsList}}" wx:key="" wx:for-item="item">
           			 * 		<block wx:for="{{item.markIcon}}" wx:key="" wx:for-item="subItem">
          			 *   		<text>{{subItem}}</text>
          			 *  	</block>
         			 * </block>
					 * 解析规则：同上
					 * 
					 * 
					 * 情况三：
					 * <block wx:for-items="{{countyList}}" wx:key="{{index}}">
					 *     <view data-index="{{index}}" data-code="{{item.cityCode}}">
					 *     		<view>{{item.areaName}}</view>
					 *     </view>
					 * </block>
					 * 解析规则：同上
					 * 
					 * 情况四：
					 * <view wx:for="{{list}}" wx:key="{{index}}">
					 *		<view wx:for-items="{{item.child}}" wx:key="{{index}}" data-id="{{item.id}}" wx:for-item="item">
					 *		</view>
					 * </view>
					 * 解析规则：
					 * 1.wx:for同上
					 * 2.遍历到wx:for-items这一层时，如果有wx:for-item属性，且parent含有wx:for时，将wx:for-item的值设置为parent的wx:for遍历出的子元素的别称
					 */

					//这里预先设置wx:for是最前面的一个属性，这样会第一个被遍历到
					let wx_key = node.attribs["wx:key"];

					//如果wx:key="*this" 或wx:key="*item"时，那么直接设置为空
					if (wx_key && wx_key.indexOf("*") > -1) wx_key = "";
					let wx_for = node.attribs["wx:for"] || node.attribs["for"];
					let wx_forItem = node.attribs["wx:for-item"];
					let wx_forItems = node.attribs["wx:for-items"];
					//wx:for与wx:for-items互斥
					let value = wx_for ? wx_for : wx_forItems;

					//替换{{}}
					if (wx_key) {
						wx_key = wx_key.trim();
						wx_key = wx_key.replace(/{{ ?(.*?) ?}}/, '$1').replace(/\"/g, "'");
					}
					//------------处理wx:key------------
					//查找父级的key
					let pKey = findParentsWithFor(node);
					if (pKey && pKey.indexOf("index") > -1) {
						let count = pKey.split("index").join("");
						if (count) {
							count = parseInt(count);
						} else {
							count = 1; //如果第一个找到的父级的key为index时，则默认为1
						}
						count++; //递增
						wx_key = (wx_key && pKey != wx_key) ? wx_key : "index" + count;
					} else {
						wx_key = wx_key ? wx_key : "index";
					}
					//修复index，防止使用的item.id来替换index
					let newKey = wx_key.indexOf(".") == -1 ? wx_key : "index";

					//设置for-item默认值
					wx_forItem = wx_forItem ? wx_forItem : "item";

					if (value) {
						//将双引号转换单引号
						value = value.replace(/\"/g, "'");
						value = value.replace(/{{ ?(.*?) ?}}/, '(' + wx_forItem + ', ' + newKey + ') in $1');

						if (value == node.attribs[k]) {
							//奇葩!!! 小程序写起来太自由了，相比js有过之而无不及，{{}}可加可不加……我能说什么？
							//这里处理无{{}}的情况
							value = '(' + wx_forItem + ', ' + newKey + ') in ' + value;
						}

						attrs['v-for'] = value;
						attrs[':key'] = newKey;
						if (node.attribs.hasOwnProperty("wx:key")) delete node.attribs["wx:key"];
						if (node.attribs.hasOwnProperty("wx:for-index")) delete node.attribs["wx:for-index"];
						if (node.attribs.hasOwnProperty("wx:for-item")) delete node.attribs["wx:for-item"];
						if (node.attribs.hasOwnProperty("wx:for-items")) delete node.attribs["wx:for-items"];
					}
				} else {
					// "../list/list?type={{ item.key }}&title={{ item.title }}"
					// "'../list/list?type=' + item.key ' + '&title=' + item.title"
					//

					//替换带有bind前缀的key，避免漏网之鱼，因为实在太多情况了。
					let newKey = replaceBindToAt(k);
					attrs[newKey] = node.attribs[k];

					//替换xx="xx:'{{}}';" 为xx="xx:{{}};"
					node.attribs[k] = node.attribs[k].replace(/['"]{{.*?}}['"]/, "{{$1}}");

					if (newKey == k) {
						newKey = replaceWxBind(k);
						attrs[newKey] = node.attribs[k];
					}

					//其他属性
					//处理下面这种嵌套关系的样式或绑定的属性
					//style="background-image: url({{avatarUrl}});color:{{abc}};font-size:12px;"
					let value = attrs[newKey];
					let hasBind = reg_tag.test(value);
					if (hasBind) {
						let reg1 = /(?!^){{ ?/g; //中间的{{
						let reg2 = / ?}}(?!$)/g; //中间的}}
						let reg3 = /^{{ ?/; //起始的{{
						let reg4 = / ?}}$/; //文末的}}

						//查找{{}}里是否有?，有就加个括号括起来
						//处理这种情况：<view class="abc abc-d-{{item.id}} {{selectId===item.id?'active':''}}"></view>
						value = value.replace(/{{(.*?)}}/g, function (match, $1) {
							if (checkExp(match)) {
								match = "{{(" + $1 + ")}}";
							}
							return match;
						});

						value = value.replace(reg1, "' + ").replace(reg2, " + '");

						//单独处理前后是否有{{}}的情况
						if (reg3.test(value)) {
							//有起始的{{的情况
							value = value.replace(reg3, "");
						} else {
							value = "'" + value;
						}
						if (reg4.test(value)) {
							//有结束的}}的情况
							value = value.replace(reg4, "");
						} else {
							value = value + "'";
						}
						//将双引号转换单引号（这里还有问题----------------------------）
						value = value.replace(/\"/g, "'");

						//如果value={{true}}或value={{false}}，则不添加bind
						if (newKey == k && value !== "true" && value !== "false") {
							//处理<view style="display:{{}}"></view>，转换后，可能末尾多余一个+，编译会报错
							if (/\+$/.test(value)) value = value.replace(/\s*\+$/, "");
							//
							attrs[":" + newKey] = value;
							delete attrs[newKey];
						} else {
							attrs[newKey] = value;
						}
					}
				}
			}

			node.attribs = attrs;
		}
		//因为是树状结构，所以需要进行递归
		if (node.children) {
			templateConverter(node.children);
		}
	}
	return ast;
}


module.exports = templateConverter;
