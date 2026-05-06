"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QrCodeScan = void 0;
const tencentcloud = require('tencentcloud-sdk-nodejs');
const OcrClient = tencentcloud.ocr.v20181119.Client;
const file_1 = require("../utils/file");
const ENVJSON = (0, file_1.getJsonObject)('env.json');
const QrCodeScan = async (source, type) => {
    let result;
    const payload = {};
    const client = new OcrClient({
        credential: {
            secretId: ENVJSON.tencent.secretId,
            secretKey: ENVJSON.tencent.secretKey,
        },
        region: 'ap-shanghai',
        profile: {
            httpProfile: {
                endpoint: 'ocr.tencentcloudapi.com',
            },
        },
    });
    type === 'base64' ? payload.ImageBase64 = source : payload.ImageUrl = source;
    try {
        result = await client.QrcodeOCR(payload);
    }
    catch (err) {
        result = '';
    }
    return result;
};
exports.QrCodeScan = QrCodeScan;
