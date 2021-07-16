/**
 * skylark-graphics-image - The skylark imagex utility library
 * @author Hudaokeji Co.,Ltd
 * @version v0.9.0
 * @link www.skylarkjs.org
 * @license MIT
 */
define(["skylark-langx-exceptions/base-exception","skylark-langx-binary","./jpeg"],function(e,n,r){"use strict";class a extends e{constructor(e){super(`JPEG error: ${e}`)}}class t extends e{constructor(e,n){super(e),this.scanLines=n}}class o extends e{}var i=new Uint8Array([0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63]),s=4017,c=799,l=3406,f=2276,u=1567,h=3784,d=5793,m=2896;function v({decodeTransform:e=null,colorTransform:n=-1}={}){this._decodeTransform=e,this._colorTransform=n}function p(e,n){for(var r,a,t=0,o=[],i=16;i>0&&!e[i-1];)i--;o.push({children:[],index:0});var s,c=o[0];for(r=0;r<i;r++){for(a=0;a<e[r];a++){for((c=o.pop()).children[c.index]=n[t];c.index>0;)c=o.pop();for(c.index++,o.push(c);o.length<=r;)o.push(s={children:[],index:0}),c.children[c.index]=s.children,c=s;t++}r+1<i&&(o.push(s={children:[],index:0}),c.children[c.index]=s.children,c=s)}return o[0].children}function b(e,n,r){return 64*((e.blocksPerLine+1)*n+r)}function k(e,r,s,c,l,f,u,h,d,m=!1){var v=s.mcusPerLine,p=s.progressive;const k=r;let g=0,w=0;function x(){if(w>0)return g>>--w&1;if(255===(g=e[r++])){var i=e[r++];if(i){if(220===i&&m){r+=2;const a=n.readUint16(e,r);if(r+=2,a>0&&a!==s.scanLines)throw new t("Found DNL marker (0xFFDC) while parsing scan data",a)}else if(217===i){if(m){const e=I*(8===s.precision?8:0);if(e>0&&Math.round(s.scanLines/e)>=10)throw new t("Found EOI marker (0xFFD9) while parsing scan data, possibly caused by incorrect `scanLines` parameter",e)}throw new o("Found EOI marker (0xFFD9) while parsing scan data")}throw new a(`unexpected marker ${(g<<8|i).toString(16)}`)}}return w=7,g>>>7}function C(e){for(var n=e;;){switch(typeof(n=n[x()])){case"number":return n;case"object":continue}throw new a("invalid huffman sequence")}}function y(e){for(var n=0;e>0;)n=n<<1|x(),e--;return n}function P(e){if(1===e)return 1===x()?1:-1;var n=y(e);return n>=1<<e-1?n:n+(-1<<e)+1}var T=0;var L,U=0;let I=0;function _(e,n,r,a,t){var o=r%v;I=(r/v|0)*e.v+a;var i=o*e.h+t;n(e,b(e,I,i))}function F(e,n,r){I=r/e.blocksPerLine|0;var a=r%e.blocksPerLine;n(e,b(e,I,a))}var A,S,J,M,z,R,Y=c.length;R=p?0===f?0===h?function(e,n){var r=C(e.huffmanTableDC),a=0===r?0:P(r)<<d;e.blockData[n]=e.pred+=a}:function(e,n){e.blockData[n]|=x()<<d}:0===h?function(e,n){if(T>0)T--;else for(var r=f,a=u;r<=a;){var t=C(e.huffmanTableAC),o=15&t,s=t>>4;if(0!==o){var c=i[r+=s];e.blockData[n+c]=P(o)*(1<<d),r++}else{if(s<15){T=y(s)+(1<<s)-1;break}r+=16}}}:function(e,n){for(var r,t,o=f,s=u,c=0;o<=s;){const s=n+i[o],l=e.blockData[s]<0?-1:1;switch(U){case 0:if(c=(t=C(e.huffmanTableAC))>>4,0==(r=15&t))c<15?(T=y(c)+(1<<c),U=4):(c=16,U=1);else{if(1!==r)throw new a("invalid ACn encoding");L=P(r),U=c?2:3}continue;case 1:case 2:e.blockData[s]?e.blockData[s]+=l*(x()<<d):0==--c&&(U=2===U?3:0);break;case 3:e.blockData[s]?e.blockData[s]+=l*(x()<<d):(e.blockData[s]=L<<d,U=0);break;case 4:e.blockData[s]&&(e.blockData[s]+=l*(x()<<d))}o++}4===U&&0==--T&&(U=0)}:function(e,n){var r=C(e.huffmanTableDC),a=0===r?0:P(r);e.blockData[n]=e.pred+=a;for(var t=1;t<64;){var o=C(e.huffmanTableAC),s=15&o,c=o>>4;if(0!==s){var l=i[t+=c];e.blockData[n+l]=P(s),t++}else{if(c<15)break;t+=16}}};var q,E,O,N,$=0;for(E=1===Y?c[0].blocksPerLine*c[0].blocksPerColumn:v*s.mcusPerColumn;$<=E;){var G=l?Math.min(E-$,l):E;if(G>0){for(S=0;S<Y;S++)c[S].pred=0;if(T=0,1===Y)for(A=c[0],z=0;z<G;z++)F(A,R,$),$++;else for(z=0;z<G;z++){for(S=0;S<Y;S++)for(O=(A=c[S]).h,N=A.v,J=0;J<N;J++)for(M=0;M<O;M++)_(A,R,$,J,M);$++}}if(w=0,!(q=D(e,r)))break;if(q.invalid){const e=G>0?"unexpected":"excessive";sutil.warn(`decodeScan - ${e} MCU data, current marker is: ${q.invalid}`),r=q.offset}if(!(q.marker>=65488&&q.marker<=65495))break;r+=2}return r-k}function g(e,n,r){var t,o,i,v,p,b,k,g,w,D,x,C,y,P,T,L,U,I=e.quantizationTable,_=e.blockData;if(!I)throw new a("missing required Quantization Table.");for(var F=0;F<64;F+=8)w=_[n+F],D=_[n+F+1],x=_[n+F+2],C=_[n+F+3],y=_[n+F+4],P=_[n+F+5],T=_[n+F+6],L=_[n+F+7],w*=I[F],0!=(D|x|C|y|P|T|L)?(D*=I[F+1],x*=I[F+2],C*=I[F+3],y*=I[F+4],P*=I[F+5],T*=I[F+6],L*=I[F+7],o=(t=(t=d*w+128>>8)+(o=d*y+128>>8)+1>>1)-o,U=(i=x)*h+(v=T)*u+128>>8,i=i*u-v*h+128>>8,k=(p=(p=m*(D-L)+128>>8)+(k=P<<4)+1>>1)-k,b=(g=(g=m*(D+L)+128>>8)+(b=C<<4)+1>>1)-b,v=(t=t+(v=U)+1>>1)-v,i=(o=o+i+1>>1)-i,U=p*f+g*l+2048>>12,p=p*l-g*f+2048>>12,g=U,U=b*c+k*s+2048>>12,b=b*s-k*c+2048>>12,k=U,r[F]=t+g,r[F+7]=t-g,r[F+1]=o+k,r[F+6]=o-k,r[F+2]=i+b,r[F+5]=i-b,r[F+3]=v+p,r[F+4]=v-p):(U=d*w+512>>10,r[F]=U,r[F+1]=U,r[F+2]=U,r[F+3]=U,r[F+4]=U,r[F+5]=U,r[F+6]=U,r[F+7]=U);for(var A=0;A<8;++A)w=r[A],0!=((D=r[A+8])|(x=r[A+16])|(C=r[A+24])|(y=r[A+32])|(P=r[A+40])|(T=r[A+48])|(L=r[A+56]))?(o=(t=4112+((t=d*w+2048>>12)+(o=d*y+2048>>12)+1>>1))-o,U=(i=x)*h+(v=T)*u+2048>>12,i=i*u-v*h+2048>>12,v=U,k=(p=(p=m*(D-L)+2048>>12)+(k=P)+1>>1)-k,b=(g=(g=m*(D+L)+2048>>12)+(b=C)+1>>1)-b,U=p*f+g*l+2048>>12,p=p*l-g*f+2048>>12,g=U,U=b*c+k*s+2048>>12,b=b*s-k*c+2048>>12,L=(t=t+v+1>>1)-g,D=(o=o+i+1>>1)+(k=U),T=o-k,x=(i=o-i)+b,P=i-b,C=(v=t-v)+p,y=v-p,(w=t+g)<16?w=0:w>=4080?w=255:w>>=4,D<16?D=0:D>=4080?D=255:D>>=4,x<16?x=0:x>=4080?x=255:x>>=4,C<16?C=0:C>=4080?C=255:C>>=4,y<16?y=0:y>=4080?y=255:y>>=4,P<16?P=0:P>=4080?P=255:P>>=4,T<16?T=0:T>=4080?T=255:T>>=4,L<16?L=0:L>=4080?L=255:L>>=4,_[n+A]=w,_[n+A+8]=D,_[n+A+16]=x,_[n+A+24]=C,_[n+A+32]=y,_[n+A+40]=P,_[n+A+48]=T,_[n+A+56]=L):(U=(U=d*w+8192>>14)<-2040?0:U>=2024?255:U+2056>>4,_[n+A]=U,_[n+A+8]=U,_[n+A+16]=U,_[n+A+24]=U,_[n+A+32]=U,_[n+A+40]=U,_[n+A+48]=U,_[n+A+56]=U)}function w(e,n){for(var r=n.blocksPerLine,a=n.blocksPerColumn,t=new Int16Array(64),o=0;o<a;o++)for(var i=0;i<r;i++){g(n,b(n,o,i),t)}return n.blockData}function D(e,r,a=r){const t=e.length-1;var o=a<r?a:r;if(r>=t)return null;var i=n.readUint16(e,r);if(i>=65472&&i<=65534)return{invalid:null,marker:i,offset:r};for(var s=n.readUint16(e,o);!(s>=65472&&s<=65534);){if(++o>=t)return null;s=n.readUint16(e,o)}return{invalid:i.toString(16),marker:s,offset:o}}return v.prototype={parse(e,{dnlScanLines:r=null}={}){function s(){const r=n.readUint16(e,u);let a=(u+=2)+r-2;var t=D(e,a,u);t&&t.invalid&&(sutil.warn("readDataBlock - incorrect length, current marker is: "+t.invalid),a=t.offset);var o=e.subarray(u,a);return u+=o.length,o}function c(e){for(var n=Math.ceil(e.samplesPerLine/8/e.maxH),r=Math.ceil(e.scanLines/8/e.maxV),a=0;a<e.components.length;a++){O=e.components[a];var t=Math.ceil(Math.ceil(e.samplesPerLine/8)*O.h/e.maxH),o=Math.ceil(Math.ceil(e.scanLines/8)*O.v/e.maxV),i=n*O.h,s=64*(r*O.v)*(i+1);O.blockData=new Int16Array(s),O.blocksPerLine=t,O.blocksPerColumn=o}e.mcusPerLine=n,e.mcusPerColumn=r}var l,f,u=0,h=null,d=null;let m=0;var v=[],b=[],g=[];let x=n.readUint16(e,u);if(u+=2,65496!==x)throw new a("SOI not found");x=n.readUint16(e,u),u+=2;e:for(;65497!==x;){var C,y,P;switch(x){case 65504:case 65505:case 65506:case 65507:case 65508:case 65509:case 65510:case 65511:case 65512:case 65513:case 65514:case 65515:case 65516:case 65517:case 65518:case 65519:case 65534:var T=s();65504===x&&74===T[0]&&70===T[1]&&73===T[2]&&70===T[3]&&0===T[4]&&(h={version:{major:T[5],minor:T[6]},densityUnits:T[7],xDensity:T[8]<<8|T[9],yDensity:T[10]<<8|T[11],thumbWidth:T[12],thumbHeight:T[13],thumbData:T.subarray(14,14+3*T[12]*T[13])}),65518===x&&65===T[0]&&100===T[1]&&111===T[2]&&98===T[3]&&101===T[4]&&(d={version:T[5]<<8|T[6],flags0:T[7]<<8|T[8],flags1:T[9]<<8|T[10],transformCode:T[11]});break;case 65499:for(var L=n.readUint16(e,u)+(u+=2)-2;u<L;){var U=e[u++],I=new Uint16Array(64);if(U>>4==0)for(y=0;y<64;y++)I[i[y]]=e[u++];else{if(U>>4!=1)throw new a("DQT - invalid table spec");for(y=0;y<64;y++)I[i[y]]=n.readUint16(e,u),u+=2}v[15&U]=I}break;case 65472:case 65473:case 65474:if(l)throw new a("Only single frame JPEGs supported");u+=2,(l={}).extended=65473===x,l.progressive=65474===x,l.precision=e[u++];const w=n.readUint16(e,u);u+=2,l.scanLines=r||w,l.samplesPerLine=n.readUint16(e,u),u+=2,l.components=[],l.componentIds={};var _,F=e[u++],A=0,S=0;for(C=0;C<F;C++){_=e[u];var J=e[u+1]>>4,M=15&e[u+1];A<J&&(A=J),S<M&&(S=M);var z=e[u+2];P=l.components.push({h:J,v:M,quantizationId:z,quantizationTable:null}),l.componentIds[_]=P-1,u+=3}l.maxH=A,l.maxV=S,c(l);break;case 65476:const X=n.readUint16(e,u);for(u+=2,C=2;C<X;){var R=e[u++],Y=new Uint8Array(16),q=0;for(y=0;y<16;y++,u++)q+=Y[y]=e[u];var E=new Uint8Array(q);for(y=0;y<q;y++,u++)E[y]=e[u];C+=17+q,(R>>4==0?g:b)[15&R]=p(Y,E)}break;case 65501:u+=2,f=n.readUint16(e,u),u+=2;break;case 65498:const W=1==++m&&!r;u+=2;var O,N=e[u++],$=[];for(C=0;C<N;C++){const n=e[u++];var G=l.componentIds[n];(O=l.components[G]).index=n;var H=e[u++];O.huffmanTableDC=g[H>>4],O.huffmanTableAC=b[15&H],$.push(O)}var j=e[u++],B=e[u++],V=e[u++];try{var Q=k(e,u,l,$,f,j,B,V>>4,15&V,W);u+=Q}catch(n){if(n instanceof t)return sutil.warn(`${n.message} -- attempting to re-parse the JPEG image.`),this.parse(e,{dnlScanLines:n.scanLines});if(n instanceof o){sutil.warn(`${n.message} -- ignoring the rest of the image data.`);break e}throw n}break;case 65500:u+=4;break;case 65535:255!==e[u]&&u--;break;default:const K=D(e,u-2,u-3);if(K&&K.invalid){sutil.warn("JpegImage.parse - unexpected data, current marker is: "+K.invalid),u=K.offset;break}if(!K||u>=e.length-1){sutil.warn("JpegImage.parse - reached the end of the image data without finding an EOI marker (0xFFD9).");break e}throw new a("JpegImage.parse - unknown marker: "+x.toString(16))}x=n.readUint16(e,u),u+=2}for(this.width=l.samplesPerLine,this.height=l.scanLines,this.jfif=h,this.adobe=d,this.components=[],C=0;C<l.components.length;C++){var X=v[(O=l.components[C]).quantizationId];X&&(O.quantizationTable=X),this.components.push({index:O.index,output:w(0,O),scaleX:O.h/l.maxH,scaleY:O.v/l.maxV,blocksPerLine:O.blocksPerLine,blocksPerColumn:O.blocksPerColumn})}this.numComponents=this.components.length},_getLinearizedBlockData(e,n,r=!1){var a,t,o,i,s,c,l,f,u,h,d,m=this.width/e,v=this.height/n,p=0,b=this.components.length,k=e*n*b,g=new Uint8ClampedArray(k),w=new Uint32Array(e);let D;for(l=0;l<b;l++){if(t=(a=this.components[l]).scaleX*m,o=a.scaleY*v,p=l,d=a.output,i=a.blocksPerLine+1<<3,t!==D){for(s=0;s<e;s++)f=0|s*t,w[s]=(4294967288&f)<<3|7&f;D=t}for(c=0;c<n;c++)for(h=i*(4294967288&(f=0|c*o))|(7&f)<<3,s=0;s<e;s++)g[p]=d[h+w[s]],p+=b}let x=this._decodeTransform;if(r||4!==b||x||(x=new Int32Array([-256,255,-256,255,-256,255,-256,255])),x)for(l=0;l<k;)for(f=0,u=0;f<b;f++,l++,u+=2)g[l]=(g[l]*x[u]>>8)+x[u+1];return g},get _isColorConversionNeeded(){return this.adobe?!!this.adobe.transformCode:3===this.numComponents?0!==this._colorTransform&&(82!==this.components[0].index||71!==this.components[1].index||66!==this.components[2].index):1===this._colorTransform},_convertYccToRgb:function(e){for(var n,r,a,t=0,o=e.length;t<o;t+=3)n=e[t],r=e[t+1],a=e[t+2],e[t]=n-179.456+1.402*a,e[t+1]=n+135.459-.344*r-.714*a,e[t+2]=n-226.816+1.772*r;return e},_convertYcckToRgb:function(e){for(var n,r,a,t,o=0,i=0,s=e.length;i<s;i+=4)n=e[i],r=e[i+1],a=e[i+2],t=e[i+3],e[o++]=r*(-660635669420364e-19*r+.000437130475926232*a-54080610064599e-18*n+.00048449797120281*t-.154362151871126)-122.67195406894+a*(-.000957964378445773*a+.000817076911346625*n-.00477271405408747*t+1.53380253221734)+n*(.000961250184130688*n-.00266257332283933*t+.48357088451265)+t*(-.000336197177618394*t+.484791561490776),e[o++]=107.268039397724+r*(219927104525741e-19*r-.000640992018297945*a+.000659397001245577*n+.000426105652938837*t-.176491792462875)+a*(-.000778269941513683*a+.00130872261408275*n+.000770482631801132*t-.151051492775562)+n*(.00126935368114843*n-.00265090189010898*t+.25802910206845)+t*(-.000318913117588328*t-.213742400323665),e[o++]=r*(-.000570115196973677*r-263409051004589e-19*a+.0020741088115012*n-.00288260236853442*t+.814272968359295)-20.810012546947+a*(-153496057440975e-19*a-.000132689043961446*n+.000560833691242812*t-.195152027534049)+n*(.00174418132927582*n-.00255243321439347*t+.116935020465145)+t*(-.000343531996510555*t+.24165260232407);return e.subarray(0,o)},_convertYcckToCmyk:function(e){for(var n,r,a,t=0,o=e.length;t<o;t+=4)n=e[t],r=e[t+1],a=e[t+2],e[t]=434.456-n-1.402*a,e[t+1]=119.541-n+.344*r+.714*a,e[t+2]=481.816-n-1.772*r;return e},_convertCmykToRgb:function(e){for(var n,r,a,t,o=0,i=0,s=e.length;i<s;i+=4)n=e[i],r=e[i+1],a=e[i+2],t=e[i+3],e[o++]=255+n*(-6747147073602441e-20*n+.0008379262121013727*r+.0002894718188643294*a+.003264231057537806*t-1.1185611867203937)+r*(26374107616089405e-21*r-8626949158638572e-20*a-.0002748769067499491*t-.02155688794978967)+a*(-3878099212869363e-20*a-.0003267808279485286*t+.0686742238595345)-t*(.0003361971776183937*t+.7430659151342254),e[o++]=255+n*(.00013596372813588848*n+.000924537132573585*r+.00010567359618683593*a+.0004791864687436512*t-.3109689587515875)+r*(-.00023545346108370344*r+.0002702845253534714*a+.0020200308977307156*t-.7488052167015494)+a*(6834815998235662e-20*a+.00015168452363460973*t-.09751927774728933)-t*(.0003189131175883281*t+.7364883807733168),e[o++]=255+n*(13598650411385307e-21*n+.00012423956175490851*r+.0004751985097583589*a-36729317476630422e-22*t-.05562186980264034)+r*(.00016141380598724676*r+.0009692239130725186*a+.0007782692450036253*t-.44015232367526463)+a*(5.068882914068769e-7*a+.0017778369011375071*t-.7591454649749609)-t*(.0003435319965105553*t+.7063770186160144);return e.subarray(0,o)},getData({width:e,height:n,forceRGB:r=!1,isSourcePDF:t=!1}){if(("undefined"==typeof PDFJSDev||PDFJSDev.test("!PRODUCTION || TESTING"))&&sutil.assert(!0===t,'JpegImage.getData: Unexpected "isSourcePDF" value for PDF files.'),this.numComponents>4)throw new a("Unsupported color mode");var o=this._getLinearizedBlockData(e,n,t);if(1===this.numComponents&&r){for(var i=o.length,s=new Uint8ClampedArray(3*i),c=0,l=0;l<i;l++){var f=o[l];s[c++]=f,s[c++]=f,s[c++]=f}return s}if(3===this.numComponents&&this._isColorConversionNeeded)return this._convertYccToRgb(o);if(4===this.numComponents){if(this._isColorConversionNeeded)return r?this._convertYcckToRgb(o):this._convertYcckToCmyk(o);if(r)return this._convertCmykToRgb(o)}return o}},r.JpegImage=v});
//# sourceMappingURL=sourcemaps/jpeg-image.js.map
