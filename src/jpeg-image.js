define([
    "skylark-langx-exceptions/base-exception",
    'skylark-langx-binary',
    "skylark-langx-logging",
    "skylark-langx-debugs",
    "./jpeg"
], function (BaseException, binary,sutil,debugs,jpeg) {
    'use strict';
    class JpegError extends BaseException {
        constructor(msg) {
            super(`JPEG error: ${ msg }`);
        }
    }
    class DNLMarkerError extends BaseException {
        constructor(message, scanLines) {
            super(message);
            this.scanLines = scanLines;
        }
    }
    class EOIMarkerError extends BaseException {
    }

    var dctZigZag = new Uint8Array([
        0,
        1,
        8,
        16,
        9,
        2,
        3,
        10,
        17,
        24,
        32,
        25,
        18,
        11,
        4,
        5,
        12,
        19,
        26,
        33,
        40,
        48,
        41,
        34,
        27,
        20,
        13,
        6,
        7,
        14,
        21,
        28,
        35,
        42,
        49,
        56,
        57,
        50,
        43,
        36,
        29,
        22,
        15,
        23,
        30,
        37,
        44,
        51,
        58,
        59,
        52,
        45,
        38,
        31,
        39,
        46,
        53,
        60,
        61,
        54,
        47,
        55,
        62,
        63
    ]);
    var dctCos1 = 4017;
    var dctSin1 = 799;
    var dctCos3 = 3406;
    var dctSin3 = 2276;
    var dctCos6 = 1567;
    var dctSin6 = 3784;
    var dctSqrt2 = 5793;
    var dctSqrt1d2 = 2896;
    function JpegImage({decodeTransform = null, colorTransform = -1} = {}) {
        this._decodeTransform = decodeTransform;
        this._colorTransform = colorTransform;
    }
    function buildHuffmanTable(codeLengths, values) {
        var k = 0, code = [], i, j, length = 16;
        while (length > 0 && !codeLengths[length - 1]) {
            length--;
        }
        code.push({
            children: [],
            index: 0
        });
        var p = code[0], q;
        for (i = 0; i < length; i++) {
            for (j = 0; j < codeLengths[i]; j++) {
                p = code.pop();
                p.children[p.index] = values[k];
                while (p.index > 0) {
                    p = code.pop();
                }
                p.index++;
                code.push(p);
                while (code.length <= i) {
                    code.push(q = {
                        children: [],
                        index: 0
                    });
                    p.children[p.index] = q.children;
                    p = q;
                }
                k++;
            }
            if (i + 1 < length) {
                code.push(q = {
                    children: [],
                    index: 0
                });
                p.children[p.index] = q.children;
                p = q;
            }
        }
        return code[0].children;
    }
    function getBlockBufferOffset(component, row, col) {
        return 64 * ((component.blocksPerLine + 1) * row + col);
    }
    function decodeScan(data, offset, frame, components, resetInterval, spectralStart, spectralEnd, successivePrev, successive, parseDNLMarker = false) {
        var mcusPerLine = frame.mcusPerLine;
        var progressive = frame.progressive;
        const startOffset = offset;
        let bitsData = 0, bitsCount = 0;
        function readBit() {
            if (bitsCount > 0) {
                bitsCount--;
                return bitsData >> bitsCount & 1;
            }
            bitsData = data[offset++];
            if (bitsData === 255) {
                var nextByte = data[offset++];
                if (nextByte) {
                    if (nextByte === 220 && parseDNLMarker) {
                        offset += 2;
                        const scanLines = binary.readUint16(data, offset);
                        offset += 2;
                        if (scanLines > 0 && scanLines !== frame.scanLines) {
                            throw new DNLMarkerError('Found DNL marker (0xFFDC) while parsing scan data', scanLines);
                        }
                    } else if (nextByte === 217) {
                        if (parseDNLMarker) {
                            const maybeScanLines = blockRow * (frame.precision === 8 ? 8 : 0);
                            if (maybeScanLines > 0 && Math.round(frame.scanLines / maybeScanLines) >= 10) {
                                throw new DNLMarkerError('Found EOI marker (0xFFD9) while parsing scan data, ' + 'possibly caused by incorrect `scanLines` parameter', maybeScanLines);
                            }
                        }
                        throw new EOIMarkerError('Found EOI marker (0xFFD9) while parsing scan data');
                    }
                    throw new JpegError(`unexpected marker ${ (bitsData << 8 | nextByte).toString(16) }`);
                }
            }
            bitsCount = 7;
            return bitsData >>> 7;
        }
        function decodeHuffman(tree) {
            var node = tree;
            while (true) {
                node = node[readBit()];
                switch (typeof node) {
                case 'number':
                    return node;
                case 'object':
                    continue;
                }
                throw new JpegError('invalid huffman sequence');
            }
        }
        function receive(length) {
            var n = 0;
            while (length > 0) {
                n = n << 1 | readBit();
                length--;
            }
            return n;
        }
        function receiveAndExtend(length) {
            if (length === 1) {
                return readBit() === 1 ? 1 : -1;
            }
            var n = receive(length);
            if (n >= 1 << length - 1) {
                return n;
            }
            return n + (-1 << length) + 1;
        }
        function decodeBaseline(component, blockOffset) {
            var t = decodeHuffman(component.huffmanTableDC);
            var diff = t === 0 ? 0 : receiveAndExtend(t);
            component.blockData[blockOffset] = component.pred += diff;
            var k = 1;
            while (k < 64) {
                var rs = decodeHuffman(component.huffmanTableAC);
                var s = rs & 15, r = rs >> 4;
                if (s === 0) {
                    if (r < 15) {
                        break;
                    }
                    k += 16;
                    continue;
                }
                k += r;
                var z = dctZigZag[k];
                component.blockData[blockOffset + z] = receiveAndExtend(s);
                k++;
            }
        }
        function decodeDCFirst(component, blockOffset) {
            var t = decodeHuffman(component.huffmanTableDC);
            var diff = t === 0 ? 0 : receiveAndExtend(t) << successive;
            component.blockData[blockOffset] = component.pred += diff;
        }
        function decodeDCSuccessive(component, blockOffset) {
            component.blockData[blockOffset] |= readBit() << successive;
        }
        var eobrun = 0;
        function decodeACFirst(component, blockOffset) {
            if (eobrun > 0) {
                eobrun--;
                return;
            }
            var k = spectralStart, e = spectralEnd;
            while (k <= e) {
                var rs = decodeHuffman(component.huffmanTableAC);
                var s = rs & 15, r = rs >> 4;
                if (s === 0) {
                    if (r < 15) {
                        eobrun = receive(r) + (1 << r) - 1;
                        break;
                    }
                    k += 16;
                    continue;
                }
                k += r;
                var z = dctZigZag[k];
                component.blockData[blockOffset + z] = receiveAndExtend(s) * (1 << successive);
                k++;
            }
        }
        var successiveACState = 0, successiveACNextValue;
        function decodeACSuccessive(component, blockOffset) {
            var k = spectralStart;
            var e = spectralEnd;
            var r = 0;
            var s;
            var rs;
            while (k <= e) {
                const offsetZ = blockOffset + dctZigZag[k];
                const sign = component.blockData[offsetZ] < 0 ? -1 : 1;
                switch (successiveACState) {
                case 0:
                    rs = decodeHuffman(component.huffmanTableAC);
                    s = rs & 15;
                    r = rs >> 4;
                    if (s === 0) {
                        if (r < 15) {
                            eobrun = receive(r) + (1 << r);
                            successiveACState = 4;
                        } else {
                            r = 16;
                            successiveACState = 1;
                        }
                    } else {
                        if (s !== 1) {
                            throw new JpegError('invalid ACn encoding');
                        }
                        successiveACNextValue = receiveAndExtend(s);
                        successiveACState = r ? 2 : 3;
                    }
                    continue;
                case 1:
                case 2:
                    if (component.blockData[offsetZ]) {
                        component.blockData[offsetZ] += sign * (readBit() << successive);
                    } else {
                        r--;
                        if (r === 0) {
                            successiveACState = successiveACState === 2 ? 3 : 0;
                        }
                    }
                    break;
                case 3:
                    if (component.blockData[offsetZ]) {
                        component.blockData[offsetZ] += sign * (readBit() << successive);
                    } else {
                        component.blockData[offsetZ] = successiveACNextValue << successive;
                        successiveACState = 0;
                    }
                    break;
                case 4:
                    if (component.blockData[offsetZ]) {
                        component.blockData[offsetZ] += sign * (readBit() << successive);
                    }
                    break;
                }
                k++;
            }
            if (successiveACState === 4) {
                eobrun--;
                if (eobrun === 0) {
                    successiveACState = 0;
                }
            }
        }
        let blockRow = 0;
        function decodeMcu(component, decode, mcu, row, col) {
            var mcuRow = mcu / mcusPerLine | 0;
            var mcuCol = mcu % mcusPerLine;
            blockRow = mcuRow * component.v + row;
            var blockCol = mcuCol * component.h + col;
            const blockOffset = getBlockBufferOffset(component, blockRow, blockCol);
            decode(component, blockOffset);
        }
        function decodeBlock(component, decode, mcu) {
            blockRow = mcu / component.blocksPerLine | 0;
            var blockCol = mcu % component.blocksPerLine;
            const blockOffset = getBlockBufferOffset(component, blockRow, blockCol);
            decode(component, blockOffset);
        }
        var componentsLength = components.length;
        var component, i, j, k, n;
        var decodeFn;
        if (progressive) {
            if (spectralStart === 0) {
                decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
            } else {
                decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
            }
        } else {
            decodeFn = decodeBaseline;
        }
        var mcu = 0, fileMarker;
        var mcuExpected;
        if (componentsLength === 1) {
            mcuExpected = components[0].blocksPerLine * components[0].blocksPerColumn;
        } else {
            mcuExpected = mcusPerLine * frame.mcusPerColumn;
        }
        var h, v;
        while (mcu <= mcuExpected) {
            var mcuToRead = resetInterval ? Math.min(mcuExpected - mcu, resetInterval) : mcuExpected;
            if (mcuToRead > 0) {
                for (i = 0; i < componentsLength; i++) {
                    components[i].pred = 0;
                }
                eobrun = 0;
                if (componentsLength === 1) {
                    component = components[0];
                    for (n = 0; n < mcuToRead; n++) {
                        decodeBlock(component, decodeFn, mcu);
                        mcu++;
                    }
                } else {
                    for (n = 0; n < mcuToRead; n++) {
                        for (i = 0; i < componentsLength; i++) {
                            component = components[i];
                            h = component.h;
                            v = component.v;
                            for (j = 0; j < v; j++) {
                                for (k = 0; k < h; k++) {
                                    decodeMcu(component, decodeFn, mcu, j, k);
                                }
                            }
                        }
                        mcu++;
                    }
                }
            }
            bitsCount = 0;
            fileMarker = findNextFileMarker(data, offset);
            if (!fileMarker) {
                break;
            }
            if (fileMarker.invalid) {
                const partialMsg = mcuToRead > 0 ? 'unexpected' : 'excessive';
                sutil.warn(`decodeScan - ${ partialMsg } MCU data, current marker is: ${ fileMarker.invalid }`);
                offset = fileMarker.offset;
            }
            if (fileMarker.marker >= 65488 && fileMarker.marker <= 65495) {
                offset += 2;
            } else {
                break;
            }
        }
        return offset - startOffset;
    }
    function quantizeAndInverse(component, blockBufferOffset, p) {
        var qt = component.quantizationTable, blockData = component.blockData;
        var v0, v1, v2, v3, v4, v5, v6, v7;
        var p0, p1, p2, p3, p4, p5, p6, p7;
        var t;
        if (!qt) {
            throw new JpegError('missing required Quantization Table.');
        }
        for (var row = 0; row < 64; row += 8) {
            p0 = blockData[blockBufferOffset + row];
            p1 = blockData[blockBufferOffset + row + 1];
            p2 = blockData[blockBufferOffset + row + 2];
            p3 = blockData[blockBufferOffset + row + 3];
            p4 = blockData[blockBufferOffset + row + 4];
            p5 = blockData[blockBufferOffset + row + 5];
            p6 = blockData[blockBufferOffset + row + 6];
            p7 = blockData[blockBufferOffset + row + 7];
            p0 *= qt[row];
            if ((p1 | p2 | p3 | p4 | p5 | p6 | p7) === 0) {
                t = dctSqrt2 * p0 + 512 >> 10;
                p[row] = t;
                p[row + 1] = t;
                p[row + 2] = t;
                p[row + 3] = t;
                p[row + 4] = t;
                p[row + 5] = t;
                p[row + 6] = t;
                p[row + 7] = t;
                continue;
            }
            p1 *= qt[row + 1];
            p2 *= qt[row + 2];
            p3 *= qt[row + 3];
            p4 *= qt[row + 4];
            p5 *= qt[row + 5];
            p6 *= qt[row + 6];
            p7 *= qt[row + 7];
            v0 = dctSqrt2 * p0 + 128 >> 8;
            v1 = dctSqrt2 * p4 + 128 >> 8;
            v2 = p2;
            v3 = p6;
            v4 = dctSqrt1d2 * (p1 - p7) + 128 >> 8;
            v7 = dctSqrt1d2 * (p1 + p7) + 128 >> 8;
            v5 = p3 << 4;
            v6 = p5 << 4;
            v0 = v0 + v1 + 1 >> 1;
            v1 = v0 - v1;
            t = v2 * dctSin6 + v3 * dctCos6 + 128 >> 8;
            v2 = v2 * dctCos6 - v3 * dctSin6 + 128 >> 8;
            v3 = t;
            v4 = v4 + v6 + 1 >> 1;
            v6 = v4 - v6;
            v7 = v7 + v5 + 1 >> 1;
            v5 = v7 - v5;
            v0 = v0 + v3 + 1 >> 1;
            v3 = v0 - v3;
            v1 = v1 + v2 + 1 >> 1;
            v2 = v1 - v2;
            t = v4 * dctSin3 + v7 * dctCos3 + 2048 >> 12;
            v4 = v4 * dctCos3 - v7 * dctSin3 + 2048 >> 12;
            v7 = t;
            t = v5 * dctSin1 + v6 * dctCos1 + 2048 >> 12;
            v5 = v5 * dctCos1 - v6 * dctSin1 + 2048 >> 12;
            v6 = t;
            p[row] = v0 + v7;
            p[row + 7] = v0 - v7;
            p[row + 1] = v1 + v6;
            p[row + 6] = v1 - v6;
            p[row + 2] = v2 + v5;
            p[row + 5] = v2 - v5;
            p[row + 3] = v3 + v4;
            p[row + 4] = v3 - v4;
        }
        for (var col = 0; col < 8; ++col) {
            p0 = p[col];
            p1 = p[col + 8];
            p2 = p[col + 16];
            p3 = p[col + 24];
            p4 = p[col + 32];
            p5 = p[col + 40];
            p6 = p[col + 48];
            p7 = p[col + 56];
            if ((p1 | p2 | p3 | p4 | p5 | p6 | p7) === 0) {
                t = dctSqrt2 * p0 + 8192 >> 14;
                if (t < -2040) {
                    t = 0;
                } else if (t >= 2024) {
                    t = 255;
                } else {
                    t = t + 2056 >> 4;
                }
                blockData[blockBufferOffset + col] = t;
                blockData[blockBufferOffset + col + 8] = t;
                blockData[blockBufferOffset + col + 16] = t;
                blockData[blockBufferOffset + col + 24] = t;
                blockData[blockBufferOffset + col + 32] = t;
                blockData[blockBufferOffset + col + 40] = t;
                blockData[blockBufferOffset + col + 48] = t;
                blockData[blockBufferOffset + col + 56] = t;
                continue;
            }
            v0 = dctSqrt2 * p0 + 2048 >> 12;
            v1 = dctSqrt2 * p4 + 2048 >> 12;
            v2 = p2;
            v3 = p6;
            v4 = dctSqrt1d2 * (p1 - p7) + 2048 >> 12;
            v7 = dctSqrt1d2 * (p1 + p7) + 2048 >> 12;
            v5 = p3;
            v6 = p5;
            v0 = (v0 + v1 + 1 >> 1) + 4112;
            v1 = v0 - v1;
            t = v2 * dctSin6 + v3 * dctCos6 + 2048 >> 12;
            v2 = v2 * dctCos6 - v3 * dctSin6 + 2048 >> 12;
            v3 = t;
            v4 = v4 + v6 + 1 >> 1;
            v6 = v4 - v6;
            v7 = v7 + v5 + 1 >> 1;
            v5 = v7 - v5;
            v0 = v0 + v3 + 1 >> 1;
            v3 = v0 - v3;
            v1 = v1 + v2 + 1 >> 1;
            v2 = v1 - v2;
            t = v4 * dctSin3 + v7 * dctCos3 + 2048 >> 12;
            v4 = v4 * dctCos3 - v7 * dctSin3 + 2048 >> 12;
            v7 = t;
            t = v5 * dctSin1 + v6 * dctCos1 + 2048 >> 12;
            v5 = v5 * dctCos1 - v6 * dctSin1 + 2048 >> 12;
            v6 = t;
            p0 = v0 + v7;
            p7 = v0 - v7;
            p1 = v1 + v6;
            p6 = v1 - v6;
            p2 = v2 + v5;
            p5 = v2 - v5;
            p3 = v3 + v4;
            p4 = v3 - v4;
            if (p0 < 16) {
                p0 = 0;
            } else if (p0 >= 4080) {
                p0 = 255;
            } else {
                p0 >>= 4;
            }
            if (p1 < 16) {
                p1 = 0;
            } else if (p1 >= 4080) {
                p1 = 255;
            } else {
                p1 >>= 4;
            }
            if (p2 < 16) {
                p2 = 0;
            } else if (p2 >= 4080) {
                p2 = 255;
            } else {
                p2 >>= 4;
            }
            if (p3 < 16) {
                p3 = 0;
            } else if (p3 >= 4080) {
                p3 = 255;
            } else {
                p3 >>= 4;
            }
            if (p4 < 16) {
                p4 = 0;
            } else if (p4 >= 4080) {
                p4 = 255;
            } else {
                p4 >>= 4;
            }
            if (p5 < 16) {
                p5 = 0;
            } else if (p5 >= 4080) {
                p5 = 255;
            } else {
                p5 >>= 4;
            }
            if (p6 < 16) {
                p6 = 0;
            } else if (p6 >= 4080) {
                p6 = 255;
            } else {
                p6 >>= 4;
            }
            if (p7 < 16) {
                p7 = 0;
            } else if (p7 >= 4080) {
                p7 = 255;
            } else {
                p7 >>= 4;
            }
            blockData[blockBufferOffset + col] = p0;
            blockData[blockBufferOffset + col + 8] = p1;
            blockData[blockBufferOffset + col + 16] = p2;
            blockData[blockBufferOffset + col + 24] = p3;
            blockData[blockBufferOffset + col + 32] = p4;
            blockData[blockBufferOffset + col + 40] = p5;
            blockData[blockBufferOffset + col + 48] = p6;
            blockData[blockBufferOffset + col + 56] = p7;
        }
    }
    function buildComponentData(frame, component) {
        var blocksPerLine = component.blocksPerLine;
        var blocksPerColumn = component.blocksPerColumn;
        var computationBuffer = new Int16Array(64);
        for (var blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
            for (var blockCol = 0; blockCol < blocksPerLine; blockCol++) {
                var offset = getBlockBufferOffset(component, blockRow, blockCol);
                quantizeAndInverse(component, offset, computationBuffer);
            }
        }
        return component.blockData;
    }
    function findNextFileMarker(data, currentPos, startPos = currentPos) {
        const maxPos = data.length - 1;
        var newPos = startPos < currentPos ? startPos : currentPos;
        if (currentPos >= maxPos) {
            return null;
        }
        var currentMarker = binary.readUint16(data, currentPos);
        if (currentMarker >= 65472 && currentMarker <= 65534) {
            return {
                invalid: null,
                marker: currentMarker,
                offset: currentPos
            };
        }
        var newMarker = binary.readUint16(data, newPos);
        while (!(newMarker >= 65472 && newMarker <= 65534)) {
            if (++newPos >= maxPos) {
                return null;
            }
            newMarker = binary.readUint16(data, newPos);
        }
        return {
            invalid: currentMarker.toString(16),
            marker: newMarker,
            offset: newPos
        };
    }
    JpegImage.prototype = {
        parse(data, {
            dnlScanLines = null
        } = {}) {
            function readDataBlock() {
                const length = binary.readUint16(data, offset);
                offset += 2;
                let endOffset = offset + length - 2;
                var fileMarker = findNextFileMarker(data, endOffset, offset);
                if (fileMarker && fileMarker.invalid) {
                    sutil.warn('readDataBlock - incorrect length, current marker is: ' + fileMarker.invalid);
                    endOffset = fileMarker.offset;
                }
                var array = data.subarray(offset, endOffset);
                offset += array.length;
                return array;
            }
            function prepareComponents(frame) {
                var mcusPerLine = Math.ceil(frame.samplesPerLine / 8 / frame.maxH);
                var mcusPerColumn = Math.ceil(frame.scanLines / 8 / frame.maxV);
                for (var i = 0; i < frame.components.length; i++) {
                    component = frame.components[i];
                    var blocksPerLine = Math.ceil(Math.ceil(frame.samplesPerLine / 8) * component.h / frame.maxH);
                    var blocksPerColumn = Math.ceil(Math.ceil(frame.scanLines / 8) * component.v / frame.maxV);
                    var blocksPerLineForMcu = mcusPerLine * component.h;
                    var blocksPerColumnForMcu = mcusPerColumn * component.v;
                    var blocksBufferSize = 64 * blocksPerColumnForMcu * (blocksPerLineForMcu + 1);
                    component.blockData = new Int16Array(blocksBufferSize);
                    component.blocksPerLine = blocksPerLine;
                    component.blocksPerColumn = blocksPerColumn;
                }
                frame.mcusPerLine = mcusPerLine;
                frame.mcusPerColumn = mcusPerColumn;
            }
            var offset = 0;
            var jfif = null;
            var adobe = null;
            var frame, resetInterval;
            let numSOSMarkers = 0;
            var quantizationTables = [];
            var huffmanTablesAC = [], huffmanTablesDC = [];
            let fileMarker = binary.readUint16(data, offset);
            offset += 2;
            if (fileMarker !== 65496) {
                throw new JpegError('SOI not found');
            }
            fileMarker = binary.readUint16(data, offset);
            offset += 2;
            markerLoop:
                while (fileMarker !== 65497) {
                    var i, j, l;
                    switch (fileMarker) {
                    case 65504:
                    case 65505:
                    case 65506:
                    case 65507:
                    case 65508:
                    case 65509:
                    case 65510:
                    case 65511:
                    case 65512:
                    case 65513:
                    case 65514:
                    case 65515:
                    case 65516:
                    case 65517:
                    case 65518:
                    case 65519:
                    case 65534:
                        var appData = readDataBlock();
                        if (fileMarker === 65504) {
                            if (appData[0] === 74 && appData[1] === 70 && appData[2] === 73 && appData[3] === 70 && appData[4] === 0) {
                                jfif = {
                                    version: {
                                        major: appData[5],
                                        minor: appData[6]
                                    },
                                    densityUnits: appData[7],
                                    xDensity: appData[8] << 8 | appData[9],
                                    yDensity: appData[10] << 8 | appData[11],
                                    thumbWidth: appData[12],
                                    thumbHeight: appData[13],
                                    thumbData: appData.subarray(14, 14 + 3 * appData[12] * appData[13])
                                };
                            }
                        }
                        if (fileMarker === 65518) {
                            if (appData[0] === 65 && appData[1] === 100 && appData[2] === 111 && appData[3] === 98 && appData[4] === 101) {
                                adobe = {
                                    version: appData[5] << 8 | appData[6],
                                    flags0: appData[7] << 8 | appData[8],
                                    flags1: appData[9] << 8 | appData[10],
                                    transformCode: appData[11]
                                };
                            }
                        }
                        break;
                    case 65499:
                        const quantizationTablesLength = binary.readUint16(data, offset);
                        offset += 2;
                        var quantizationTablesEnd = quantizationTablesLength + offset - 2;
                        var z;
                        while (offset < quantizationTablesEnd) {
                            var quantizationTableSpec = data[offset++];
                            var tableData = new Uint16Array(64);
                            if (quantizationTableSpec >> 4 === 0) {
                                for (j = 0; j < 64; j++) {
                                    z = dctZigZag[j];
                                    tableData[z] = data[offset++];
                                }
                            } else if (quantizationTableSpec >> 4 === 1) {
                                for (j = 0; j < 64; j++) {
                                    z = dctZigZag[j];
                                    tableData[z] = binary.readUint16(data, offset);
                                    offset += 2;
                                }
                            } else {
                                throw new JpegError('DQT - invalid table spec');
                            }
                            quantizationTables[quantizationTableSpec & 15] = tableData;
                        }
                        break;
                    case 65472:
                    case 65473:
                    case 65474:
                        if (frame) {
                            throw new JpegError('Only single frame JPEGs supported');
                        }
                        offset += 2;
                        frame = {};
                        frame.extended = fileMarker === 65473;
                        frame.progressive = fileMarker === 65474;
                        frame.precision = data[offset++];
                        const sofScanLines = binary.readUint16(data, offset);
                        offset += 2;
                        frame.scanLines = dnlScanLines || sofScanLines;
                        frame.samplesPerLine = binary.readUint16(data, offset);
                        offset += 2;
                        frame.components = [];
                        frame.componentIds = {};
                        var componentsCount = data[offset++], componentId;
                        var maxH = 0, maxV = 0;
                        for (i = 0; i < componentsCount; i++) {
                            componentId = data[offset];
                            var h = data[offset + 1] >> 4;
                            var v = data[offset + 1] & 15;
                            if (maxH < h) {
                                maxH = h;
                            }
                            if (maxV < v) {
                                maxV = v;
                            }
                            var qId = data[offset + 2];
                            l = frame.components.push({
                                h,
                                v,
                                quantizationId: qId,
                                quantizationTable: null
                            });
                            frame.componentIds[componentId] = l - 1;
                            offset += 3;
                        }
                        frame.maxH = maxH;
                        frame.maxV = maxV;
                        prepareComponents(frame);
                        break;
                    case 65476:
                        const huffmanLength = binary.readUint16(data, offset);
                        offset += 2;
                        for (i = 2; i < huffmanLength;) {
                            var huffmanTableSpec = data[offset++];
                            var codeLengths = new Uint8Array(16);
                            var codeLengthSum = 0;
                            for (j = 0; j < 16; j++, offset++) {
                                codeLengthSum += codeLengths[j] = data[offset];
                            }
                            var huffmanValues = new Uint8Array(codeLengthSum);
                            for (j = 0; j < codeLengthSum; j++, offset++) {
                                huffmanValues[j] = data[offset];
                            }
                            i += 17 + codeLengthSum;
                            (huffmanTableSpec >> 4 === 0 ? huffmanTablesDC : huffmanTablesAC)[huffmanTableSpec & 15] = buildHuffmanTable(codeLengths, huffmanValues);
                        }
                        break;
                    case 65501:
                        offset += 2;
                        resetInterval = binary.readUint16(data, offset);
                        offset += 2;
                        break;
                    case 65498:
                        const parseDNLMarker = ++numSOSMarkers === 1 && !dnlScanLines;
                        offset += 2;
                        var selectorsCount = data[offset++];
                        var components = [], component;
                        for (i = 0; i < selectorsCount; i++) {
                            const index = data[offset++];
                            var componentIndex = frame.componentIds[index];
                            component = frame.components[componentIndex];
                            component.index = index;
                            var tableSpec = data[offset++];
                            component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
                            component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
                            components.push(component);
                        }
                        var spectralStart = data[offset++];
                        var spectralEnd = data[offset++];
                        var successiveApproximation = data[offset++];
                        try {
                            var processed = decodeScan(data, offset, frame, components, resetInterval, spectralStart, spectralEnd, successiveApproximation >> 4, successiveApproximation & 15, parseDNLMarker);
                            offset += processed;
                        } catch (ex) {
                            if (ex instanceof DNLMarkerError) {
                                sutil.warn(`${ ex.message } -- attempting to re-parse the JPEG image.`);
                                return this.parse(data, { dnlScanLines: ex.scanLines });
                            } else if (ex instanceof EOIMarkerError) {
                                sutil.warn(`${ ex.message } -- ignoring the rest of the image data.`);
                                break markerLoop;
                            }
                            throw ex;
                        }
                        break;
                    case 65500:
                        offset += 4;
                        break;
                    case 65535:
                        if (data[offset] !== 255) {
                            offset--;
                        }
                        break;
                    default:
                        const nextFileMarker = findNextFileMarker(data, offset - 2, offset - 3);
                        if (nextFileMarker && nextFileMarker.invalid) {
                            sutil.warn('JpegImage.parse - unexpected data, current marker is: ' + nextFileMarker.invalid);
                            offset = nextFileMarker.offset;
                            break;
                        }
                        if (!nextFileMarker || offset >= data.length - 1) {
                            sutil.warn('JpegImage.parse - reached the end of the image data ' + 'without finding an EOI marker (0xFFD9).');
                            break markerLoop;
                        }
                        throw new JpegError('JpegImage.parse - unknown marker: ' + fileMarker.toString(16));
                    }
                    fileMarker = binary.readUint16(data, offset);
                    offset += 2;
                }
            this.width = frame.samplesPerLine;
            this.height = frame.scanLines;
            this.jfif = jfif;
            this.adobe = adobe;
            this.components = [];
            for (i = 0; i < frame.components.length; i++) {
                component = frame.components[i];
                var quantizationTable = quantizationTables[component.quantizationId];
                if (quantizationTable) {
                    component.quantizationTable = quantizationTable;
                }
                this.components.push({
                    index: component.index,
                    output: buildComponentData(frame, component),
                    scaleX: component.h / frame.maxH,
                    scaleY: component.v / frame.maxV,
                    blocksPerLine: component.blocksPerLine,
                    blocksPerColumn: component.blocksPerColumn
                });
            }
            this.numComponents = this.components.length;
            return undefined;
        },
        _getLinearizedBlockData(width, height, isSourcePDF = false) {
            var scaleX = this.width / width, scaleY = this.height / height;
            var component, componentScaleX, componentScaleY, blocksPerScanline;
            var x, y, i, j, k;
            var index;
            var offset = 0;
            var output;
            var numComponents = this.components.length;
            var dataLength = width * height * numComponents;
            var data = new Uint8ClampedArray(dataLength);
            var xScaleBlockOffset = new Uint32Array(width);
            var mask3LSB = 4294967288;
            let lastComponentScaleX;
            for (i = 0; i < numComponents; i++) {
                component = this.components[i];
                componentScaleX = component.scaleX * scaleX;
                componentScaleY = component.scaleY * scaleY;
                offset = i;
                output = component.output;
                blocksPerScanline = component.blocksPerLine + 1 << 3;
                if (componentScaleX !== lastComponentScaleX) {
                    for (x = 0; x < width; x++) {
                        j = 0 | x * componentScaleX;
                        xScaleBlockOffset[x] = (j & mask3LSB) << 3 | j & 7;
                    }
                    lastComponentScaleX = componentScaleX;
                }
                for (y = 0; y < height; y++) {
                    j = 0 | y * componentScaleY;
                    index = blocksPerScanline * (j & mask3LSB) | (j & 7) << 3;
                    for (x = 0; x < width; x++) {
                        data[offset] = output[index + xScaleBlockOffset[x]];
                        offset += numComponents;
                    }
                }
            }
            let transform = this._decodeTransform;
            if (!isSourcePDF && numComponents === 4 && !transform) {
                transform = new Int32Array([
                    -256,
                    255,
                    -256,
                    255,
                    -256,
                    255,
                    -256,
                    255
                ]);
            }
            if (transform) {
                for (i = 0; i < dataLength;) {
                    for (j = 0, k = 0; j < numComponents; j++, i++, k += 2) {
                        data[i] = (data[i] * transform[k] >> 8) + transform[k + 1];
                    }
                }
            }
            return data;
        },
        get _isColorConversionNeeded() {
            if (this.adobe) {
                return !!this.adobe.transformCode;
            }
            if (this.numComponents === 3) {
                if (this._colorTransform === 0) {
                    return false;
                } else if (this.components[0].index === 82 && this.components[1].index === 71 && this.components[2].index === 66) {
                    return false;
                }
                return true;
            }
            if (this._colorTransform === 1) {
                return true;
            }
            return false;
        },
        _convertYccToRgb: function convertYccToRgb(data) {
            var Y, Cb, Cr;
            for (var i = 0, length = data.length; i < length; i += 3) {
                Y = data[i];
                Cb = data[i + 1];
                Cr = data[i + 2];
                data[i] = Y - 179.456 + 1.402 * Cr;
                data[i + 1] = Y + 135.459 - 0.344 * Cb - 0.714 * Cr;
                data[i + 2] = Y - 226.816 + 1.772 * Cb;
            }
            return data;
        },
        _convertYcckToRgb: function convertYcckToRgb(data) {
            var Y, Cb, Cr, k;
            var offset = 0;
            for (var i = 0, length = data.length; i < length; i += 4) {
                Y = data[i];
                Cb = data[i + 1];
                Cr = data[i + 2];
                k = data[i + 3];
                data[offset++] = -122.67195406894 + Cb * (-0.0000660635669420364 * Cb + 0.000437130475926232 * Cr - 0.000054080610064599 * Y + 0.00048449797120281 * k - 0.154362151871126) + Cr * (-0.000957964378445773 * Cr + 0.000817076911346625 * Y - 0.00477271405408747 * k + 1.53380253221734) + Y * (0.000961250184130688 * Y - 0.00266257332283933 * k + 0.48357088451265) + k * (-0.000336197177618394 * k + 0.484791561490776);
                data[offset++] = 107.268039397724 + Cb * (0.0000219927104525741 * Cb - 0.000640992018297945 * Cr + 0.000659397001245577 * Y + 0.000426105652938837 * k - 0.176491792462875) + Cr * (-0.000778269941513683 * Cr + 0.00130872261408275 * Y + 0.000770482631801132 * k - 0.151051492775562) + Y * (0.00126935368114843 * Y - 0.00265090189010898 * k + 0.25802910206845) + k * (-0.000318913117588328 * k - 0.213742400323665);
                data[offset++] = -20.810012546947 + Cb * (-0.000570115196973677 * Cb - 0.0000263409051004589 * Cr + 0.0020741088115012 * Y - 0.00288260236853442 * k + 0.814272968359295) + Cr * (-0.0000153496057440975 * Cr - 0.000132689043961446 * Y + 0.000560833691242812 * k - 0.195152027534049) + Y * (0.00174418132927582 * Y - 0.00255243321439347 * k + 0.116935020465145) + k * (-0.000343531996510555 * k + 0.24165260232407);
            }
            return data.subarray(0, offset);
        },
        _convertYcckToCmyk: function convertYcckToCmyk(data) {
            var Y, Cb, Cr;
            for (var i = 0, length = data.length; i < length; i += 4) {
                Y = data[i];
                Cb = data[i + 1];
                Cr = data[i + 2];
                data[i] = 434.456 - Y - 1.402 * Cr;
                data[i + 1] = 119.541 - Y + 0.344 * Cb + 0.714 * Cr;
                data[i + 2] = 481.816 - Y - 1.772 * Cb;
            }
            return data;
        },
        _convertCmykToRgb: function convertCmykToRgb(data) {
            var c, m, y, k;
            var offset = 0;
            for (var i = 0, length = data.length; i < length; i += 4) {
                c = data[i];
                m = data[i + 1];
                y = data[i + 2];
                k = data[i + 3];
                data[offset++] = 255 + c * (-0.00006747147073602441 * c + 0.0008379262121013727 * m + 0.0002894718188643294 * y + 0.003264231057537806 * k - 1.1185611867203937) + m * (0.000026374107616089405 * m - 0.00008626949158638572 * y - 0.0002748769067499491 * k - 0.02155688794978967) + y * (-0.00003878099212869363 * y - 0.0003267808279485286 * k + 0.0686742238595345) - k * (0.0003361971776183937 * k + 0.7430659151342254);
                data[offset++] = 255 + c * (0.00013596372813588848 * c + 0.000924537132573585 * m + 0.00010567359618683593 * y + 0.0004791864687436512 * k - 0.3109689587515875) + m * (-0.00023545346108370344 * m + 0.0002702845253534714 * y + 0.0020200308977307156 * k - 0.7488052167015494) + y * (0.00006834815998235662 * y + 0.00015168452363460973 * k - 0.09751927774728933) - k * (0.0003189131175883281 * k + 0.7364883807733168);
                data[offset++] = 255 + c * (0.000013598650411385307 * c + 0.00012423956175490851 * m + 0.0004751985097583589 * y - 0.0000036729317476630422 * k - 0.05562186980264034) + m * (0.00016141380598724676 * m + 0.0009692239130725186 * y + 0.0007782692450036253 * k - 0.44015232367526463) + y * (5.068882914068769e-7 * y + 0.0017778369011375071 * k - 0.7591454649749609) - k * (0.0003435319965105553 * k + 0.7063770186160144);
            }
            return data.subarray(0, offset);
        },
        getData({width, height, forceRGB = false, isSourcePDF = false}) {
            if (typeof PDFJSDev === 'undefined' || PDFJSDev.test('!PRODUCTION || TESTING')) {
                debugs.assert(isSourcePDF === true, 'JpegImage.getData: Unexpected "isSourcePDF" value for PDF files.');
            }
            if (this.numComponents > 4) {
                throw new JpegError('Unsupported color mode');
            }
            var data = this._getLinearizedBlockData(width, height, isSourcePDF);
            if (this.numComponents === 1 && forceRGB) {
                var dataLength = data.length;
                var rgbData = new Uint8ClampedArray(dataLength * 3);
                var offset = 0;
                for (var i = 0; i < dataLength; i++) {
                    var grayColor = data[i];
                    rgbData[offset++] = grayColor;
                    rgbData[offset++] = grayColor;
                    rgbData[offset++] = grayColor;
                }
                return rgbData;
            } else if (this.numComponents === 3 && this._isColorConversionNeeded) {
                return this._convertYccToRgb(data);
            } else if (this.numComponents === 4) {
                if (this._isColorConversionNeeded) {
                    if (forceRGB) {
                        return this._convertYcckToRgb(data);
                    }
                    return this._convertYcckToCmyk(data);
                } else if (forceRGB) {
                    return this._convertCmykToRgb(data);
                }
            }
            return data;
        }
    };

    return jpeg.JpegImage = JpegImage;

});