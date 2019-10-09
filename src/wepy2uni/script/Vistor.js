const t = require('@babel/types');

class Vistor {
	constructor() {
		this.data = []
	}
	handle(path) {
		if (t.isObjectExpression(path)) {
			let properties = path.properties;
			this.data = [...this.data, ...properties];
		}else if (t.isArrayExpression(path)) {
			let elements = path.elements;
			this.data = [...this.data, ...elements];
		}else{
			this.save(path)
		}
	}
	save(path) {
		this.data.push(path);
	}
	getData() {
		return this.data
	}
	clear()
	{
		this.data = [];
	}
}
module.exports = Vistor
