"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cookieSerialize = exports.request = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const zlib_1 = __importDefault(require("zlib"));
var RequestMethod;
(function (RequestMethod) {
    RequestMethod["GET"] = "GET";
    RequestMethod["POST"] = "POST";
    RequestMethod["PUT"] = "PUT";
    RequestMethod["DELETE"] = "DELETE";
})(RequestMethod || (RequestMethod = {}));
const request = (url, options, payload) => {
    options.method = options.method || 'GET';
    if (!options.headers) {
        options.headers = {};
    }
    const protocol = url.startsWith('https') ? https_1.default : http_1.default;
    const result = new Promise((resolve, reject) => {
        let data = '';
        const req = protocol.request(url, { headers: options.headers, method: options.method }, (res) => {
            if (options.gzip) {
                const gzip = zlib_1.default.createGunzip();
                res.pipe(gzip);
                gzip.on('data', (chunk) => {
                    data += chunk;
                });
                gzip.on('end', () => {
                    resolve({ data, headers: res.headers, statusCode: res.statusCode });
                });
            }
            else {
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({ data, headers: res.headers, statusCode: res.statusCode });
                });
                res.on('error', (e) => {
                    reject(e);
                });
            }
        });
        if (options.method === RequestMethod.POST) {
            if (Object.prototype.toString.call(payload) === '[object Object]')
                req.write(JSON.stringify(payload));
            else
                req.write(payload);
        }
        req.on('error', (e) => {
            reject(e);
        });
        req.end();
    });
    return result;
};
exports.request = request;
const cookieSerialize = ({ ...args }) => {
    return `fid=${args.fid}; uf=${args.uf}; _d=${args._d}; UID=${args._uid || args.UID}; vc3=${args.vc3};`;
};
exports.cookieSerialize = cookieSerialize;
