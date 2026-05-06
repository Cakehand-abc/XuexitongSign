"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRCodeSign = void 0;
const api_1 = require("../configs/api");
const request_1 = require("../utils/request");
const QRCodeSign = async (args) => {
    const { enc, name, fid, activeId, lat, lon, address, altitude, ...cookies } = args;
    const urlParams = `${api_1.PPTSIGN.URL}?enc=${enc}&name=${name}&activeId=${activeId}&uid=${cookies._uid}&clientip=&location={"result":"1","address":"${address}","latitude":${lat},"longitude":${lon},"altitude":${altitude}}&latitude=-1&longitude=-1&fid=${fid}&appType=15`;
    const result = await (0, request_1.request)(encodeURI(urlParams), {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    const msg = result.data === 'success' ? '[二维码]签到成功' : `[二维码]${result.data}`;
    console.log(msg);
    return msg;
};
exports.QRCodeSign = QRCodeSign;
