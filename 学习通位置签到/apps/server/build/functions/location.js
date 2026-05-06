"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presetAddressChoices = exports.LocationSign_2 = exports.LocationSign = void 0;
const kolorist_1 = require("kolorist");
const api_1 = require("../configs/api");
const helper_1 = require("../utils/helper");
const request_1 = require("../utils/request");
const FAKE_UA = encodeURIComponent('Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36');
const MAX_RETRIES = 3;
const RETRY_DELAY_SEC = 2;
async function attemptSign(url, cookie, label) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log((0, kolorist_1.blue)(`[位置签到] 第 ${attempt}/${MAX_RETRIES} 次尝试 | 地址: ${label}`));
        try {
            const result = await (0, request_1.request)(url, {
                headers: {
                    Cookie: cookie,
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
                },
            });
            const raw = result.data;
            console.log((0, kolorist_1.blue)(`[位置签到] 服务器响应: ${raw}`));
            if (raw === 'success') {
                console.log((0, kolorist_1.green)('[位置签到] ✅ 签到成功！'));
                return '[位置]签到成功';
            }
            if (raw.includes('已签到') || raw.includes('success')) {
                console.log((0, kolorist_1.green)(`[位置签到] ✅ ${raw}`));
                return `[位置]${raw}`;
            }
            console.log((0, kolorist_1.yellow)(`[位置签到] ⚠️  签到未成功，响应: ${raw}`));
            if (attempt < MAX_RETRIES) {
                console.log((0, kolorist_1.yellow)(`[位置签到] 等待 ${RETRY_DELAY_SEC} 秒后重试...`));
                await (0, helper_1.delay)(RETRY_DELAY_SEC);
            }
        }
        catch (e) {
            console.log((0, kolorist_1.red)(`[位置签到] ❌ 网络请求出错 (第${attempt}次): ${e.message}`));
            if (attempt < MAX_RETRIES) {
                console.log((0, kolorist_1.yellow)(`[位置签到] 等待 ${RETRY_DELAY_SEC} 秒后重试...`));
                await (0, helper_1.delay)(RETRY_DELAY_SEC);
            }
        }
    }
    const failMsg = '[位置]重试3次均失败，请检查坐标或网络';
    console.log((0, kolorist_1.red)(`[位置签到] ❌ ${failMsg}`));
    return failMsg;
}
async function attemptSignPost(formdata, cookie, label) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log((0, kolorist_1.blue)(`[位置签到(群聊)] 第 ${attempt}/${MAX_RETRIES} 次尝试 | 地址: ${label}`));
        try {
            const result = await (0, request_1.request)(api_1.CHAT_GROUP.SIGN.URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    Cookie: cookie,
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
                },
            }, formdata);
            const raw = result.data;
            console.log((0, kolorist_1.blue)(`[位置签到(群聊)] 服务器响应: ${raw}`));
            if (raw === 'success') {
                console.log((0, kolorist_1.green)('[位置签到(群聊)] ✅ 签到成功！'));
                return '[位置]签到成功';
            }
            if (raw.includes('已签到') || raw.includes('success')) {
                console.log((0, kolorist_1.green)(`[位置签到(群聊)] ✅ ${raw}`));
                return `[位置]${raw}`;
            }
            console.log((0, kolorist_1.yellow)(`[位置签到(群聊)] ⚠️  签到未成功，响应: ${raw}`));
            if (attempt < MAX_RETRIES) {
                console.log((0, kolorist_1.yellow)(`[位置签到(群聊)] 等待 ${RETRY_DELAY_SEC} 秒后重试...`));
                await (0, helper_1.delay)(RETRY_DELAY_SEC);
            }
        }
        catch (e) {
            console.log((0, kolorist_1.red)(`[位置签到(群聊)] ❌ 网络请求出错 (第${attempt}次): ${e.message}`));
            if (attempt < MAX_RETRIES) {
                console.log((0, kolorist_1.yellow)(`[位置签到(群聊)] 等待 ${RETRY_DELAY_SEC} 秒后重试...`));
                await (0, helper_1.delay)(RETRY_DELAY_SEC);
            }
        }
    }
    const failMsg = '[位置]重试3次均失败，请检查坐标或网络';
    console.log((0, kolorist_1.red)(`[位置签到(群聊)] ❌ ${failMsg}`));
    return failMsg;
}
const LocationSign = async (args) => {
    if ('address' in args) {
        const { name, address, activeId, lat, lon, fid, clientIp, ...cookies } = args;
        const ipToUse = clientIp || '1.1.1.1';
        const label = `${address} (${lon},${lat})`;
        const url = `${api_1.PPTSIGN.URL}?name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=${ipToUse}&useragent=${FAKE_UA}&latitude=${lat}&longitude=${lon}&fid=${fid}&appType=15&ifTiJiao=1&vpProbability=-1&vpStr=`;
        console.log((0, kolorist_1.blue)(`[位置签到] 开始签到 | activeId=${activeId} | IP: ${ipToUse} | 坐标: (${lon}, ${lat})`));
        return await attemptSign(url, (0, request_1.cookieSerialize)(cookies), label);
    }
    else {
        const { name, activeId, presetAddress, fid, clientIp, ...cookies } = args;
        const ipToUse = clientIp || '1.1.1.1';
        if (!presetAddress || presetAddress.length === 0) {
            const msg = '[位置]签到失败：未配置预设地址';
            console.log((0, kolorist_1.red)(`[位置签到] ❌ ${msg}`));
            return msg;
        }
        console.log((0, kolorist_1.blue)(`[位置签到] 共有 ${presetAddress.length} 个预设地址，IP: ${ipToUse}，将依次尝试`));
        for (let i = 0; i < presetAddress.length; i++) {
            const { address, lat, lon } = presetAddress[i];
            const label = `${address} (${lon},${lat})`;
            const url = `${api_1.PPTSIGN.URL}?name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=${ipToUse}&useragent=${FAKE_UA}&latitude=${lat}&longitude=${lon}&fid=${fid}&appType=15&ifTiJiao=1&vpProbability=-1&vpStr=`;
            console.log((0, kolorist_1.blue)(`[位置签到] ▶ 第 ${i + 1}/${presetAddress.length} 个预设地址: ${label}`));
            const result = await attemptSign(url, (0, request_1.cookieSerialize)(cookies), label);
            if (result === '[位置]签到成功')
                return result;
            if (result.includes('已签到'))
                return result;
            console.log((0, kolorist_1.yellow)(`[位置签到] 该地址签到失败，尝试下一个预设地址...`));
        }
        const msg = '[位置]所有预设地址均签到失败';
        console.log((0, kolorist_1.red)(`[位置签到] ❌ ${msg}`));
        return msg;
    }
};
exports.LocationSign = LocationSign;
const LocationSign_2 = async (args) => {
    if ('address' in args) {
        const { address, activeId, lat, lon, clientIp, ...cookies } = args;
        const ipToUse = clientIp || '1.1.1.1';
        const label = `${address} (${lon},${lat})`;
        const formdata = `address=${encodeURIComponent(address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=${ipToUse}&useragent=${FAKE_UA}&latitude=${lat}&longitude=${lon}&fid=&ifTiJiao=1&vpProbability=-1&vpStr=`;
        console.log((0, kolorist_1.blue)(`[位置签到(群聊)] 开始签到 | activeId=${activeId} | IP: ${ipToUse} | 坐标: (${lon}, ${lat})`));
        return await attemptSignPost(formdata, (0, request_1.cookieSerialize)(cookies), label);
    }
    else {
        const { activeId, presetAddress, clientIp, ...cookies } = args;
        const ipToUse = clientIp || '1.1.1.1';
        if (!presetAddress || presetAddress.length === 0) {
            const msg = '[位置]签到失败：未配置预设地址';
            console.log((0, kolorist_1.red)(`[位置签到(群聊)] ❌ ${msg}`));
            return msg;
        }
        console.log((0, kolorist_1.blue)(`[位置签到(群聊)] 共有 ${presetAddress.length} 个预设地址，IP: ${ipToUse}，将依次尝试`));
        for (let i = 0; i < presetAddress.length; i++) {
            const { address, lat, lon } = presetAddress[i];
            const label = `${address} (${lon},${lat})`;
            const formdata = `address=${encodeURIComponent(address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=${ipToUse}&useragent=${FAKE_UA}&latitude=${lat}&longitude=${lon}&fid=&ifTiJiao=1&vpProbability=-1&vpStr=`;
            console.log((0, kolorist_1.blue)(`[位置签到(群聊)] ▶ 第 ${i + 1}/${presetAddress.length} 个预设地址: ${label}`));
            const result = await attemptSignPost(formdata, (0, request_1.cookieSerialize)(cookies), label);
            if (result === '[位置]签到成功')
                return result;
            if (result.includes('已签到'))
                return result;
            console.log((0, kolorist_1.yellow)(`[位置签到(群聊)] 该地址签到失败，尝试下一个预设地址...`));
        }
        const msg = '[位置]所有预设地址均签到失败';
        console.log((0, kolorist_1.red)(`[位置签到(群聊)] ❌ ${msg}`));
        return msg;
    }
};
exports.LocationSign_2 = LocationSign_2;
const presetAddressChoices = (presetAddress = []) => {
    const arr = [];
    for (let i = 0; i < presetAddress.length; i++) {
        arr.push({
            title: `${presetAddress[i].lon},${presetAddress[i].lat}/${presetAddress[i].address}`,
            value: i,
        });
    }
    arr.push({ title: '手动添加', value: -1 });
    return [...arr];
};
exports.presetAddressChoices = presetAddressChoices;
