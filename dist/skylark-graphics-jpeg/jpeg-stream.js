/**
 * skylark-graphics-jpeg - The skylark jpegx utility library
 * @author Hudaokeji Co.,Ltd
 * @version v0.9.0
 * @link www.skylarkjs.org
 * @license MIT
 */
define(["skylark-langx-objects/shadow","skylark-io-streams/decode-stream","skylark-langx-logging","./jpeg","./jpeg-image"],function(t,e,r,s,o){"use strict";function i(t,r,s,o){let i;for(;-1!==(i=t.getByte());)if(255===i){t.skip(-1);break}this.stream=t,this.maybeLength=r,this.dict=s,this.params=o,e.call(this,r)}return i.prototype=Object.create(e.prototype),Object.defineProperty(i.prototype,"bytes",{get:function(){return t(this,"bytes",this.stream.getBytes(this.maybeLength))},configurable:!0}),i.prototype.ensureBuffer=function(t){},i.prototype.readBlock=function(){if(this.eof)return;const t={decodeTransform:void 0,colorTransform:void 0},e=this.dict.getArray("Decode","D");if(this.forceRGB&&Array.isArray(e)){const r=this.dict.get("BitsPerComponent")||8,s=e.length,o=new Int32Array(s);let i=!1;const n=(1<<r)-1;for(let t=0;t<s;t+=2)o[t]=256*(e[t+1]-e[t])|0,o[t+1]=e[t]*n|0,256===o[t]&&0===o[t+1]||(i=!0);i&&(t.decodeTransform=o)}if(this.params&&this.params.get){const e=this.params.get("ColorTransform");Number.isInteger(e)&&(t.colorTransform=e)}const r=new o(t);r.parse(this.bytes);const s=r.getData({width:this.drawWidth,height:this.drawHeight,forceRGB:this.forceRGB,isSourcePDF:!0});this.buffer=s,this.bufferLength=s.length,this.eof=!0},s.JpegStream=i});
//# sourceMappingURL=sourcemaps/jpeg-stream.js.map
