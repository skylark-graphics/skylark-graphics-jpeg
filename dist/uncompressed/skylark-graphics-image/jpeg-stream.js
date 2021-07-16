define([
    'skylark-langx-objects/shadow',
    'skylark-io-streams/decode-stream',
    "./jpeg",
    './jpeg-image'
], function (shadow,DecodeStream, jpeg,JpegImage) {
    'use strict';

    function JpegStream(stream, maybeLength, dict, params) {
        let ch;
        while ((ch = stream.getByte()) !== -1) {
            if (ch === 255) {
                stream.skip(-1);
                break;
            }
        }
        this.stream = stream;
        this.maybeLength = maybeLength;
        this.dict = dict;
        this.params = params;
        DecodeStream.call(this, maybeLength);
    }

    JpegStream.prototype = Object.create(DecodeStream.prototype);

    Object.defineProperty(JpegStream.prototype, 'bytes', {
        get: function JpegStream_bytes() {
            return shadow(this, 'bytes', this.stream.getBytes(this.maybeLength));
        },
        configurable: true
    });

    JpegStream.prototype.ensureBuffer = function (requested) {
    };

    JpegStream.prototype.readBlock = function () {
        if (this.eof) {
            return;
        }
        const jpegOptions = {
            decodeTransform: undefined,
            colorTransform: undefined
        };
        const decodeArr = this.dict.getArray('Decode', 'D');
        if (this.forceRGB && Array.isArray(decodeArr)) {
            const bitsPerComponent = this.dict.get('BitsPerComponent') || 8;
            const decodeArrLength = decodeArr.length;
            const transform = new Int32Array(decodeArrLength);
            let transformNeeded = false;
            const maxValue = (1 << bitsPerComponent) - 1;
            for (let i = 0; i < decodeArrLength; i += 2) {
                transform[i] = (decodeArr[i + 1] - decodeArr[i]) * 256 | 0;
                transform[i + 1] = decodeArr[i] * maxValue | 0;
                if (transform[i] !== 256 || transform[i + 1] !== 0) {
                    transformNeeded = true;
                }
            }
            if (transformNeeded) {
                jpegOptions.decodeTransform = transform;
            }
        }

        //modified by lwf
        //ToDo 
        ///if (primitives.isDict(this.params)) {
        if (this.params && this.params.get) {
            const colorTransform = this.params.get('ColorTransform');
            if (Number.isInteger(colorTransform)) {
                jpegOptions.colorTransform = colorTransform;
            }
        }
        const jpegImage = new JpegImage(jpegOptions);
        jpegImage.parse(this.bytes);
        const data = jpegImage.getData({
            width: this.drawWidth,
            height: this.drawHeight,
            forceRGB: this.forceRGB,
            isSourcePDF: true
        });
        this.buffer = data;
        this.bufferLength = data.length;
        this.eof = true;
    };

    return jpeg.JpegStream = JpegStream;

});