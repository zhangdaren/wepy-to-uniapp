//XmlParser定义
const Xmldom = require('xmldom')
const utils = require('../../utils/utils')
class XmlParser {
  constructor() {
  }
  createParser(fileText) {
    return new Xmldom.DOMParser({
      xmlns: {
        xml: "any word"
      },
      errorHandler: {
        warning(x) {
          if (x.indexOf('missed value!!') > -1) {
            // ignore warnings
          } else
            console.warn(x);
        },
        error(x) {
          // console.log("-- ", fileText)
          console.log("一般情况下这个报错可以直接忽略：" + x);
        }
      }
    });
  }
  parse(fileText) {
    let startlen = fileText.indexOf('<script') + 7;
    while (fileText[startlen++] !== '>') {
      // do nothing;
    }
    fileText = utils.encode(fileText, startlen, fileText.indexOf('</script>') - 1);
    
    fileText = utils.replaceTagAndEventBind(fileText);
    return this.createParser(fileText).parseFromString(fileText);
  }
}

module.exports = XmlParser;