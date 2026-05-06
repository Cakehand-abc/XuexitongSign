"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = __importDefault(require("jsdom"));
const kolorist_1 = require("kolorist");
const ws_1 = __importDefault(require("ws"));
const activity_1 = require("./functions/activity");
const general_1 = require("./functions/general");
const location_1 = require("./functions/location");
const user_1 = require("./functions/user");
const helper_1 = require("./utils/helper");
const mailer_1 = require("./utils/mailer");
const JSDOM = new jsdom_1.default.JSDOM('', { url: 'https://im.chaoxing.com/webim/me' });
globalThis.window = JSDOM.window;
globalThis.WebSocket = ws_1.default;
Object.defineProperty(globalThis, 'navigator', {
    value: JSDOM.window.navigator,
    writable: true,
    configurable: true
});
globalThis.location = JSDOM.window.location;
const webIM = require('./utils/websdk3.1.4.js').default;
function ts() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
}
function logInfo(msg) { console.log((0, kolorist_1.blue)(`[${ts()}] ${msg}`)); }
function logOK(msg) { console.log((0, kolorist_1.green)(`[${ts()}] ✅ ${msg}`)); }
function logWarn(msg) { console.log((0, kolorist_1.yellow)(`[${ts()}] ⚠️  ${msg}`)); }
function logErr(msg) { console.log((0, kolorist_1.red)(`[${ts()}] ❌ ${msg}`)); }
const WebIMConfig = {
    xmppURL: 'https://im-api-vip6-v2.easecdn.com/ws',
    apiURL: 'https://a1-vip6.easecdn.com',
    appkey: 'cx-dev#cxstudy',
    Host: 'easemob.com',
    https: true,
    isHttpDNS: false,
    isMultiLoginSessions: true,
    isAutoLogin: true,
    isWindowSDK: false,
    isSandBox: false,
    isDebug: false,
    autoReconnectNumMax: 20,
    autoReconnectInterval: 5,
    isWebRTC: false,
    heartBeatWait: 4500,
    delivery: false,
};
const conn = new webIM.connection({
    isMultiLoginSessions: WebIMConfig.isMultiLoginSessions,
    https: WebIMConfig.https,
    url: WebIMConfig.xmppURL,
    apiUrl: WebIMConfig.apiURL,
    isAutoLogin: WebIMConfig.isAutoLogin,
    heartBeatWait: WebIMConfig.heartBeatWait,
    autoReconnectNumMax: WebIMConfig.autoReconnectNumMax,
    autoReconnectInterval: WebIMConfig.autoReconnectInterval,
    appKey: WebIMConfig.appkey,
    isHttpDNS: WebIMConfig.isHttpDNS,
});
async function Sign(realname, params, config, activity) {
    let result = null;
    if (!activity.courseId) {
        logInfo(`[群聊签到] 检测到活动 activeId=${activity.activeId}，正在获取签到类型...`);
        let page;
        try {
            page = await (0, activity_1.preSign2)({ ...activity, ...params, chatId: activity.chatId });
        }
        catch (e) {
            logErr(`[群聊签到] 预签失败: ${e.message}`);
            return '[群聊]预签失败，请检查网络';
        }
        const activityType = (0, activity_1.speculateType)(page);
        logInfo(`[群聊签到] 签到类型: ${activityType}`);
        switch (activityType) {
            case 'general': {
                logInfo('[普通签到] 开始执行普通签到...');
                try {
                    result = await (0, general_1.GeneralSign_2)({ activeId: activity.activeId, ...params });
                    logOK(`[普通签到] 结果: ${result}`);
                }
                catch (e) {
                    result = `[普通签到]出错: ${e.message}`;
                    logErr(result);
                }
                break;
            }
            case 'photo': {
                result = '[拍照]签到已禁用';
                logWarn('检测到拍照签到，已禁用，跳过。');
                break;
            }
            case 'location': {
                logInfo('[位置签到] 开始执行位置签到...');
                try {
                    result = await (0, location_1.LocationSign_2)({
                        name: realname,
                        presetAddress: config.presetAddress,
                        clientIp: config.clientIp,
                        activeId: activity.activeId,
                        ...params,
                    });
                    logOK(`[位置签到] 最终结果: ${result}`);
                }
                catch (e) {
                    result = `[位置签到]出错: ${e.message}`;
                    logErr(result);
                }
                break;
            }
            case 'qr': {
                result = '[二维码]签到已禁用';
                logWarn('检测到二维码签到，已禁用，跳过。');
                break;
            }
            default: {
                result = `[未知类型]无法处理的签到类型: ${activityType}`;
                logErr(result);
            }
        }
        return result;
    }
    logInfo(`[课程签到] 正在预签 | courseId=${activity.courseId} | classId=${activity.classId} | activeId=${activity.activeId}`);
    try {
        await (0, activity_1.preSign)({ ...activity, ...params });
    }
    catch (e) {
        logErr(`[课程签到] 预签请求失败: ${e.message}`);
    }
    const signTypeName = (0, activity_1.getSignType)({ otherId: activity.otherId, ifphoto: activity.ifphoto });
    logInfo(`[课程签到] 签到类型: ${signTypeName} (otherId=${activity.otherId})`);
    switch (activity.otherId) {
        case 2: {
            result = '[二维码]签到已禁用';
            logWarn('检测到二维码签到，已禁用，跳过。');
            break;
        }
        case 4: {
            logInfo('[位置签到] 开始执行位置签到...');
            if (!config.presetAddress || config.presetAddress.length === 0) {
                result = '[位置]签到失败：未配置预设地址，请在 Web 面板中配置';
                logErr(result);
                break;
            }
            logInfo(`[位置签到] 预设地址数量: ${config.presetAddress.length}`);
            try {
                result = await (0, location_1.LocationSign)({
                    name: realname,
                    presetAddress: config.presetAddress,
                    clientIp: config.clientIp,
                    activeId: activity.activeId,
                    ...params,
                });
                logOK(`[位置签到] 最终结果: ${result}`);
            }
            catch (e) {
                result = `[位置签到]出错: ${e.message}`;
                logErr(result);
            }
            break;
        }
        case 3: {
            logInfo('[手势签到] 开始执行手势签到...');
            try {
                result = await (0, general_1.GeneralSign)({ name: realname, activeId: activity.activeId, ...params });
                logOK(`[手势签到] 结果: ${result}`);
            }
            catch (e) {
                result = `[手势签到]出错: ${e.message}`;
                logErr(result);
            }
            break;
        }
        case 5: {
            logInfo('[签到码签到] 开始执行签到码签到...');
            try {
                result = await (0, general_1.GeneralSign)({ name: realname, activeId: activity.activeId, ...params });
                logOK(`[签到码签到] 结果: ${result}`);
            }
            catch (e) {
                result = `[签到码签到]出错: ${e.message}`;
                logErr(result);
            }
            break;
        }
        case 0: {
            if (activity.ifphoto === 0) {
                logInfo('[普通签到] 开始执行普通签到...');
                try {
                    result = await (0, general_1.GeneralSign)({ name: realname, activeId: activity.activeId, ...params });
                    logOK(`[普通签到] 结果: ${result}`);
                }
                catch (e) {
                    result = `[普通签到]出错: ${e.message}`;
                    logErr(result);
                }
            }
            else {
                result = '[拍照]签到已禁用';
                logWarn('检测到拍照签到，已禁用，跳过。');
            }
            break;
        }
        default: {
            result = `[未知类型] otherId=${activity.otherId}，无法处理`;
            logErr(result);
        }
    }
    return result;
}
process.on('SIGINT', () => {
    logWarn('收到中断信号，正在退出...');
    process.exit(0);
});
process.on('uncaughtException', (err) => {
    logErr(`[未捕获异常] ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    logErr(`[未捕获的 Promise 拒绝] ${msg}`);
});
(async () => {
    let params = {};
    let config = {};
    logInfo('==================================================');
    logInfo('     超星学习通 自动位置签到监听程序 启动中...');
    logInfo('==================================================');
    logInfo('解析 Web 服务传入的凭证...');
    try {
        const auth_config = JSON.parse(Buffer.from(process.argv[4], 'base64').toString('utf8'));
        params.phone = auth_config.credentials.phone;
        params.uf = auth_config.credentials.uf;
        params._d = auth_config.credentials._d;
        params.vc3 = auth_config.credentials.vc3;
        params._uid = auth_config.credentials.uid;
        params.lv = auth_config.credentials.lv;
        params.fid = auth_config.credentials.fid;
        config.monitor = { ...auth_config.config.monitor };
        config.mailing = { ...auth_config.config.mailing };
        logOK(`凭证解析成功 | 手机号: ${params.phone}`);
        const presetCount = config.monitor?.presetAddress?.length ?? 0;
        logInfo(`签到配置 | 延时: ${config.monitor?.delay ?? 0}s | 预设地址数: ${presetCount} | 邮件推送: ${config.mailing?.enabled ? '开启' : '关闭'}`);
        if (presetCount === 0) {
            logWarn('⚠️  未配置预设地址！位置签到将无法自动完成，请在 Web 面板中配置。');
        }
        else {
            config.monitor.presetAddress.forEach((addr, i) => {
                logInfo(`  预设地址 [${i + 1}]: ${addr.address} (lon=${addr.lon}, lat=${addr.lat})`);
            });
        }
    }
    catch (e) {
        logErr(`凭证解析失败: ${e.message}`);
        if (process.send)
            process.send('authfail');
        process.exit(1);
    }
    logInfo('正在获取 IM (即时消息) 参数...');
    let IM_Params = 'AuthFailed';
    const IM_MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= IM_MAX_RETRIES; attempt++) {
        try {
            IM_Params = await (0, user_1.getIMParams)(params);
            break;
        }
        catch (e) {
            logWarn(`获取 IM 参数失败 (第 ${attempt}/${IM_MAX_RETRIES} 次): ${e.message}`);
            if (attempt < IM_MAX_RETRIES) {
                logInfo(`等待 3 秒后重试...`);
                await (0, helper_1.delay)(3);
            }
            else {
                logErr('获取 IM 参数失败，已达最大重试次数，程序退出。');
                if (process.send)
                    process.send('authfail');
                process.exit(1);
            }
        }
    }
    if (IM_Params === 'AuthFailed') {
        logErr('获取 IM 参数失败：身份验证失败，凭证可能已过期。请重新登录获取新凭证。');
        if (process.send)
            process.send('authfail');
        process.exit(1);
    }
    const imParams = IM_Params;
    params.tuid = imParams.myTuid;
    params.name = imParams.myName;
    logOK(`IM 参数获取成功 | 姓名: ${imParams.myName} | tuid: ${imParams.myTuid}`);
    logInfo('正在连接超星 IM 服务器...');
    conn.open({
        apiUrl: WebIMConfig.apiURL,
        user: imParams.myTuid,
        accessToken: imParams.myToken,
        appKey: WebIMConfig.appkey,
    });
    let heartbeatTimer = null;
    let cookieCheckTimer = null;
    let reconnectCount = 0;
    const monitorStartTime = Date.now();
    const processedAids = new Set();
    conn.listen({
        onOpened: () => {
            reconnectCount = 0;
            if (process.send)
                process.send('success');
            logOK('IM 连接成功！正在监听签到活动消息...');
            logInfo(`[监听中] 用户: ${imParams.myName} | 邮件推送: ${config.mailing?.enabled ? '开启' : '关闭'}`);
            logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            logInfo('  程序将在后台持续运行，等待老师发起签到活动...');
            logInfo('  收到签到消息时将自动处理并在此处显示结果。');
            logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            if (heartbeatTimer)
                clearInterval(heartbeatTimer);
            heartbeatTimer = setInterval(() => {
                const elapsedMin = Math.floor((Date.now() - monitorStartTime) / 60000);
                logInfo(`监听心跳 | 已运行 ${elapsedMin} 分钟 | IM 连接正常 | 等待签到消息...`);
            }, 10 * 60 * 1000);
            if (cookieCheckTimer)
                clearInterval(cookieCheckTimer);
            cookieCheckTimer = setInterval(async () => {
                try {
                    const check = await (0, user_1.getIMParams)(params);
                    if (check === 'AuthFailed') {
                        logErr('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        logErr('⚠️  Cookie 已失效！签到将无法成功！');
                        logErr('   请重新登录账号，并重新开启监听。');
                        logErr('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    }
                    else {
                        const elapsedMin = Math.floor((Date.now() - monitorStartTime) / 60000);
                        logOK(`Cookie 验证通过 | 已运行 ${elapsedMin} 分钟 | 凭证仍有效`);
                    }
                }
                catch (e) {
                    logWarn(`Cookie 验证请求失败 (网络问题，非 Cookie 失效): ${e.message}`);
                }
            }, 30 * 60 * 1000);
        },
        onClosed: () => {
            reconnectCount++;
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
            if (reconnectCount >= WebIMConfig.autoReconnectNumMax) {
                logErr('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                logErr(`🚨 IM 连接已断开，已达最大重连次数 (${reconnectCount}/${WebIMConfig.autoReconnectNumMax})！`);
                logErr('   监听已停止！请重新运行程序并开启监听。');
                logErr('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                if (cookieCheckTimer)
                    clearInterval(cookieCheckTimer);
            }
            else {
                logWarn(`IM 连接已断开 (第 ${reconnectCount}/${WebIMConfig.autoReconnectNumMax} 次)，SDK 正在自动重连…`);
            }
        },
        onTextMessage: async (message) => {
            const url = message?.ext?.attachment?.att_chat_course?.url;
            if (!url || !url.includes('sign')) {
                return;
            }
            logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            logInfo('📢 检测到签到活动消息！');
            const IM_CourseInfo = {
                aid: message.ext.attachment.att_chat_course.aid,
                classId: message.ext.attachment.att_chat_course?.courseInfo?.classid,
                courseId: message.ext.attachment.att_chat_course?.courseInfo?.courseid,
            };
            if (processedAids.has(IM_CourseInfo.aid)) {
                return;
            }
            processedAids.add(IM_CourseInfo.aid);
            logInfo(`课程信息 | aid=${IM_CourseInfo.aid} | courseId=${IM_CourseInfo.courseId} | classId=${IM_CourseInfo.classId}`);
            logInfo('正在获取签到活动详细信息...');
            let PPTActiveInfo;
            try {
                PPTActiveInfo = await (0, activity_1.getPPTActiveInfo)({ activeId: IM_CourseInfo.aid, ...params });
            }
            catch (e) {
                logErr(`获取签到活动详情失败: ${e.message}`);
                return;
            }
            if (PPTActiveInfo.status === 2) {
                logWarn(`检测到该签到活动已结束 (可能是历史消息)，已自动跳过。`);
                return;
            }
            const signTypeName = (0, activity_1.getSignType)(PPTActiveInfo);
            logInfo(`签到类型: ${signTypeName}`);
            if (config.monitor.delay > 0) {
                logInfo(`等待 ${config.monitor.delay} 秒后开始签到（防检测延时）...`);
                await (0, helper_1.delay)(config.monitor.delay);
            }
            logInfo('开始执行签到...');
            let result;
            try {
                result = await Sign(imParams.myName, params, config.monitor, {
                    classId: IM_CourseInfo.classId,
                    courseId: IM_CourseInfo.courseId,
                    activeId: IM_CourseInfo.aid,
                    otherId: PPTActiveInfo.otherId,
                    ifphoto: PPTActiveInfo.ifphoto,
                    chatId: message?.to,
                });
            }
            catch (e) {
                result = `签到执行异常: ${e.message}`;
                logErr(result);
            }
            if (result === null || result === undefined) {
                logErr('签到函数返回 null/undefined，可能存在未处理的情况。');
                result = '[签到]未知状态，请检查日志';
            }
            logInfo(`签到最终结果: ${result}`);
            logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            if (config.mailing?.enabled) {
                logInfo('正在发送邮件通知...');
                try {
                    (0, mailer_1.sendEmail)({
                        aid: IM_CourseInfo.aid,
                        uid: params._uid,
                        realname: imParams.myName,
                        status: result,
                        mailing: config.mailing,
                    });
                    logOK('邮件通知已发送');
                }
                catch (e) {
                    logErr(`邮件发送失败: ${e.message}`);
                }
            }
        },
        onError: (msg) => {
            const errStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
            logErr(`IM 连接发生错误: ${errStr}`);
            logWarn('等待 SDK 自动重连 (最多重连 10 次，每次间隔 5 秒)...');
            if (errStr.includes('UNAUTHORIZED') || errStr.includes('auth') || errStr.includes('401')) {
                logErr('身份验证失败，无法重连，程序退出。请重新登录获取新凭证。');
                if (process.send)
                    process.send('authfail');
                process.exit(1);
            }
        },
    });
    logInfo(`[监听中] ${config.mailing?.enabled ? '邮件推送已开启' : '邮件推送未开启'} | 自动重连次数上限: ${WebIMConfig.autoReconnectNumMax}`);
})();
