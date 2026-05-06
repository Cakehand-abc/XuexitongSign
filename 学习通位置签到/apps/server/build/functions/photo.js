"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPhoto = exports.getObjectIdFromcxPan = exports.PhotoSign_2 = exports.PhotoSign = void 0;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const os_1 = require("os");
const path_1 = __importDefault(require("path"));
const api_1 = require("../configs/api");
const request_1 = require("../utils/request");
const PhotoSign = async (args) => {
    const { name, activeId, fid, objectId, ...cookies } = args;
    const url = `${api_1.PPTSIGN.URL}?activeId=${activeId}&uid=${cookies._uid}&clientip=&useragent=&latitude=-1&longitude=-1&appType=15&fid=${fid}&objectId=${objectId}&name=${encodeURIComponent(name)}`;
    const result = await (0, request_1.request)(url, {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    const msg = result.data === 'success' ? '[拍照]签到成功' : `[拍照]${result.data}`;
    console.log(msg);
    return msg;
};
exports.PhotoSign = PhotoSign;
const PhotoSign_2 = async (args) => {
    const { activeId, objectId, ...cookies } = args;
    const url = `${api_1.CHAT_GROUP.SIGN.URL}?activeId=${activeId}&uid=${cookies._uid}&clientip=&useragent=&latitude=-1&longitude=-1&fid=0&objectId=${objectId}`;
    const result = await (0, request_1.request)(url, {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    const msg = result.data === 'success' ? '[拍照]签到成功' : `[拍照]${result.data}`;
    console.log(msg);
    return msg;
};
exports.PhotoSign_2 = PhotoSign_2;
const getObjectIdFromcxPan = async (cookies) => {
    const result = await (0, request_1.request)(api_1.PANCHAOXING.URL, {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    const data = result.data;
    const start_of_enc = data.indexOf('enc ="') + 6;
    const enc = data.slice(start_of_enc, data.indexOf('"', start_of_enc));
    const start_of_rootdir = data.indexOf('_rootdir = "') + 12;
    const parentId = data.slice(start_of_rootdir, data.indexOf('"', start_of_rootdir));
    const result_panlist = await (0, request_1.request)(`${api_1.PANLIST.URL}?puid=0&shareid=0&parentId=${parentId}&page=1&size=50&enc=${enc}`, {
        method: api_1.PANLIST.METHOD,
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    }, `puid=0&shareid=0&parentId=${parentId}&page=1&size=50&enc=${enc}`);
    const objectList = JSON.parse(result_panlist.data).list;
    for (let i = 0; i < objectList.length; i++) {
        if (objectList[i].name === '0.jpg' || objectList[i].name === '0.png') {
            return objectList[i].objectId;
        }
    }
    console.log('未查询到符合要求的图片，请去网盘检查检查！');
    return null;
};
exports.getObjectIdFromcxPan = getObjectIdFromcxPan;
const uploadPhoto = async (args) => {
    const { token, buffer, ...cookies } = args;
    const FormData = (await Promise.resolve().then(() => __importStar(require('form-data')))).default;
    const form = new FormData();
    const tempFilePath = path_1.default.join((0, os_1.tmpdir)(), (0, crypto_1.randomBytes)(16).toString('hex') + '.jpg');
    fs_1.default.writeFileSync(tempFilePath, buffer);
    const file = fs_1.default.readFileSync(tempFilePath);
    form.append('file', file, { filename: '1.png' });
    form.append('puid', cookies._uid);
    const result = await (0, request_1.request)(`${api_1.PANUPLOAD.URL}?_from=mobilelearn&_token=${token}`, {
        method: api_1.PANUPLOAD.METHOD,
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
            'Content-Type': `multipart/form-data;boundary=${form.getBoundary()}`,
        },
    }, form.getBuffer());
    fs_1.default.unlink(tempFilePath, (err) => {
        err && console.error(err);
    });
    return result.data;
};
exports.uploadPhoto = uploadPhoto;
