import fs from 'fs';
import jsdom from 'jsdom';
import { blue, green, red, yellow } from 'kolorist';
import path from 'path';
import WebSocket from 'ws';
import { getPPTActiveInfo, getSignType, preSign, preSign2, speculateType } from './functions/activity';
import { GeneralSign, GeneralSign_2 } from './functions/general';
import { LocationSign, LocationSign_2 } from './functions/location';
import { getIMParams, getLocalUsers, userLogin } from './functions/user';
import { getJsonObject, getStoredUser, storeUser } from './utils/file';
import { delay } from './utils/helper';
import { sendEmail } from './utils/mailer';

const JSDOM = new jsdom.JSDOM('', { url: 'https://im.chaoxing.com/webim/me' });
(globalThis.window as any) = JSDOM.window;
(globalThis.WebSocket as any) = WebSocket;
Object.defineProperty(globalThis, 'navigator', {
  value: JSDOM.window.navigator,
  writable: true,
  configurable: true
});
globalThis.location = JSDOM.window.location;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const webIM = require('./utils/websdk3.1.4.js').default;

/** 带时间戳的日志辅助函数 */
function ts() {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}
function logInfo(msg: string) { console.log(blue(`[${ts()}] ${msg}`)); }
function logOK(msg: string) { console.log(green(`[${ts()}] ✅ ${msg}`)); }
function logWarn(msg: string) { console.log(yellow(`[${ts()}] ⚠️  ${msg}`)); }
function logErr(msg: string) { console.log(red(`[${ts()}] ❌ ${msg}`)); }

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
  autoReconnectNumMax: 20,      // 最大重连次数（提高至20，支持长时间运行）
  autoReconnectInterval: 5,     // 重连间隔（秒）
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


async function Sign(realname: string, params: UserCookieType & { tuid: string; }, config: any, activity: Activity) {
  let result: string | null = null;

  // 群聊签到，无课程
  if (!activity.courseId) {
    logInfo(`[群聊签到] 检测到活动 activeId=${activity.activeId}，正在获取签到类型...`);
    let page: string;
    try {
      page = await preSign2({ ...activity, ...params, chatId: activity.chatId as string });
    } catch (e: any) {
      logErr(`[群聊签到] 预签失败: ${e.message}`);
      return '[群聊]预签失败，请检查网络';
    }
    const activityType = speculateType(page);
    logInfo(`[群聊签到] 签到类型: ${activityType}`);
    switch (activityType) {
      case 'general': {
        logInfo('[普通签到] 开始执行普通签到...');
        try {
          result = await GeneralSign_2({ activeId: activity.activeId, ...params });
          logOK(`[普通签到] 结果: ${result}`);
        } catch (e: any) {
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
          result = await LocationSign_2({
            name: realname,
            presetAddress: config.presetAddress,
            clientIp: config.clientIp,
            activeId: activity.activeId,
            ...params,
          });
          logOK(`[位置签到] 最终结果: ${result}`);
        } catch (e: any) {
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

  // 课程签到
  logInfo(`[课程签到] 正在预签 | courseId=${activity.courseId} | classId=${activity.classId} | activeId=${activity.activeId}`);
  try {
    await preSign({ ...activity, ...params });
  } catch (e: any) {
    logErr(`[课程签到] 预签请求失败: ${e.message}`);
  }

  const signTypeName = getSignType({ otherId: activity.otherId, ifphoto: activity.ifphoto });
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
        result = await LocationSign({
          name: realname,
          presetAddress: config.presetAddress,
          clientIp: config.clientIp,
          activeId: activity.activeId,
          ...params,
        });
        logOK(`[位置签到] 最终结果: ${result}`);
      } catch (e: any) {
        result = `[位置签到]出错: ${e.message}`;
        logErr(result);
      }
      break;
    }
    case 3: {
      logInfo('[手势签到] 开始执行手势签到...');
      try {
        result = await GeneralSign({ name: realname, activeId: activity.activeId, ...params });
        logOK(`[手势签到] 结果: ${result}`);
      } catch (e: any) {
        result = `[手势签到]出错: ${e.message}`;
        logErr(result);
      }
      break;
    }
    case 5: {
      logInfo('[签到码签到] 开始执行签到码签到...');
      try {
        result = await GeneralSign({ name: realname, activeId: activity.activeId, ...params });
        logOK(`[签到码签到] 结果: ${result}`);
      } catch (e: any) {
        result = `[签到码签到]出错: ${e.message}`;
        logErr(result);
      }
      break;
    }
    case 0: {
      if (activity.ifphoto === 0) {
        logInfo('[普通签到] 开始执行普通签到...');
        try {
          result = await GeneralSign({ name: realname, activeId: activity.activeId, ...params });
          logOK(`[普通签到] 结果: ${result}`);
        } catch (e: any) {
          result = `[普通签到]出错: ${e.message}`;
          logErr(result);
        }
      } else {
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

// 全局兜底：防止任何未捕获的异常/拒绝直接崩溃进程（Node.js v22+ 默认会崩溃）
process.on('uncaughtException', (err: Error) => {
  logErr(`[未捕获异常] ${err.message}`);
  // 仅记录，不退出，让监听继续运行
});
process.on('unhandledRejection', (reason: any) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  logErr(`[未捕获的 Promise 拒绝] ${msg}`);
  // 仅记录，不退出
});

// 开始运行
(async () => {
  let params: any = {};
  let config: any = {};

  logInfo('==================================================');
  logInfo('     超星学习通 自动位置签到监听程序 启动中...');
  logInfo('==================================================');

  // 解析从 Serve 传入的 Base64 凭证
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
    // 打印配置摘要
    const presetCount = config.monitor?.presetAddress?.length ?? 0;
    logInfo(`签到配置 | 延时: ${config.monitor?.delay ?? 0}s | 预设地址数: ${presetCount} | 邮件推送: ${config.mailing?.enabled ? '开启' : '关闭'}`);
    if (presetCount === 0) {
      logWarn('⚠️  未配置预设地址！位置签到将无法自动完成，请在 Web 面板中配置。');
    } else {
      config.monitor.presetAddress.forEach((addr: any, i: number) => {
        logInfo(`  预设地址 [${i + 1}]: ${addr.address} (lon=${addr.lon}, lat=${addr.lat})`);
      });
    }
  } catch (e: any) {
    logErr(`凭证解析失败: ${e.message}`);
    if (process.send) process.send('authfail');
    process.exit(1);
  }

  // 获取IM参数（含重试机制，防止 ECONNRESET 等偶发性网络错误导致启动失败）
  logInfo('正在获取 IM (即时消息) 参数...');
  let IM_Params: IMParamsType | 'AuthFailed' = 'AuthFailed';
  const IM_MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= IM_MAX_RETRIES; attempt++) {
    try {
      IM_Params = await getIMParams(params as UserCookieType);
      break; // 成功则跳出重试循环
    } catch (e: any) {
      logWarn(`获取 IM 参数失败 (第 ${attempt}/${IM_MAX_RETRIES} 次): ${e.message}`);
      if (attempt < IM_MAX_RETRIES) {
        logInfo(`等待 3 秒后重试...`);
        await delay(3);
      } else {
        logErr('获取 IM 参数失败，已达最大重试次数，程序退出。');
        if (process.send) process.send('authfail');
        process.exit(1);
      }
    }
  }
  if (IM_Params === 'AuthFailed') {
    logErr('获取 IM 参数失败：身份验证失败，凭证可能已过期。请重新登录获取新凭证。');
    if (process.send) process.send('authfail');
    process.exit(1);
  }
  // 类型确认：此处 IM_Params 已确保是 IMParamsType
  const imParams = IM_Params as IMParamsType;
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

  // 监听状态追踪变量
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let cookieCheckTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectCount = 0;
  const monitorStartTime = Date.now();
  const processedAids = new Set<string>();

  conn.listen({
    onOpened: () => {
      reconnectCount = 0; // 连接成功后重置重连计数
      if (process.send) process.send('success');
      logOK('IM 连接成功！正在监听签到活动消息...');
      logInfo(`[监听中] 用户: ${imParams.myName} | 邮件推送: ${config.mailing?.enabled ? '开启' : '关闭'}`);
      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logInfo('  程序将在后台持续运行，等待老师发起签到活动...');
      logInfo('  收到签到消息时将自动处理并在此处显示结果。');
      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // ❤️ 每 10 分钟打印心跳日志，确认监听在继续运行
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        const elapsedMin = Math.floor((Date.now() - monitorStartTime) / 60000);
        logInfo(`监听心跳 | 已运行 ${elapsedMin} 分钟 | IM 连接正常 | 等待签到消息...`);
      }, 10 * 60 * 1000); // 10 分钟

      // 🔑 每 30 分钟验证 Cookie 是否仍有效（防止长时间运行后 cookie 失效导致静默失败）
      if (cookieCheckTimer) clearInterval(cookieCheckTimer);
      cookieCheckTimer = setInterval(async () => {
        try {
          const check = await getIMParams(params as UserCookieType);
          if (check === 'AuthFailed') {
            logErr('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            logErr('⚠️  Cookie 已失效！签到将无法成功！');
            logErr('   请重新登录账号，并重新开启监听。');
            logErr('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          } else {
            const elapsedMin = Math.floor((Date.now() - monitorStartTime) / 60000);
            logOK(`Cookie 验证通过 | 已运行 ${elapsedMin} 分钟 | 凭证仍有效`);
          }
        } catch (e: any) {
          logWarn(`Cookie 验证请求失败 (网络问题，非 Cookie 失效): ${e.message}`);
        }
      }, 30 * 60 * 1000); // 30 分钟
    },
    onClosed: () => {
      reconnectCount++;
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      if (reconnectCount >= WebIMConfig.autoReconnectNumMax) {
        logErr('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logErr(`🚨 IM 连接已断开，已达最大重连次数 (${reconnectCount}/${WebIMConfig.autoReconnectNumMax})！`);
        logErr('   监听已停止！请重新运行程序并开启监听。');
        logErr('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (cookieCheckTimer) clearInterval(cookieCheckTimer);
      } else {
        logWarn(`IM 连接已断开 (第 ${reconnectCount}/${WebIMConfig.autoReconnectNumMax} 次)，SDK 正在自动重连…`);
      }
    },
    onTextMessage: async (message: any) => {
      // 先检查是否为签到消息
      const url = message?.ext?.attachment?.att_chat_course?.url;
      if (!url || !url.includes('sign')) {
        return; // 不是签到消息，静默忽略
      }

      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logInfo('📢 检测到签到活动消息！');

      const IM_CourseInfo = {
        aid: message.ext.attachment.att_chat_course.aid,
        classId: message.ext.attachment.att_chat_course?.courseInfo?.classid,
        courseId: message.ext.attachment.att_chat_course?.courseInfo?.courseid,
      };

      if (processedAids.has(IM_CourseInfo.aid)) {
        return; // 防止重复处理同一个签到
      }
      processedAids.add(IM_CourseInfo.aid);

      logInfo(`课程信息 | aid=${IM_CourseInfo.aid} | courseId=${IM_CourseInfo.courseId} | classId=${IM_CourseInfo.classId}`);

      // 获取签到详细信息
      logInfo('正在获取签到活动详细信息...');
      let PPTActiveInfo: any;
      try {
        PPTActiveInfo = await getPPTActiveInfo({ activeId: IM_CourseInfo.aid, ...(params as UserCookieType) });
      } catch (e: any) {
        logErr(`获取签到活动详情失败: ${e.message}`);
        return;
      }

      // 检查活动是否已经结束 (status: 1=进行中, 2=已结束)
      if (PPTActiveInfo.status === 2) {
        logWarn(`检测到该签到活动已结束 (可能是历史消息)，已自动跳过。`);
        return;
      }

      const signTypeName = getSignType(PPTActiveInfo);
      logInfo(`签到类型: ${signTypeName}`);

      // 延迟后签到
      if (config.monitor.delay > 0) {
        logInfo(`等待 ${config.monitor.delay} 秒后开始签到（防检测延时）...`);
        await delay(config.monitor.delay);
      }

      logInfo('开始执行签到...');
      let result: string | null;
      try {
        result = await Sign(imParams.myName, params, config.monitor, {
          classId: IM_CourseInfo.classId,
          courseId: IM_CourseInfo.courseId,
          activeId: IM_CourseInfo.aid,
          otherId: PPTActiveInfo.otherId,
          ifphoto: PPTActiveInfo.ifphoto,
          chatId: message?.to,
        });
      } catch (e: any) {
        result = `签到执行异常: ${e.message}`;
        logErr(result);
      }

      if (result === null || result === undefined) {
        logErr('签到函数返回 null/undefined，可能存在未处理的情况。');
        result = '[签到]未知状态，请检查日志';
      }

      logInfo(`签到最终结果: ${result}`);
      logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // 邮件推送
      if (config.mailing?.enabled) {
        logInfo('正在发送邮件通知...');
        try {
          sendEmail({
            aid: IM_CourseInfo.aid,
            uid: params._uid,
            realname: imParams.myName,
            status: result,
            mailing: config.mailing,
          });
          logOK('邮件通知已发送');
        } catch (e: any) {
          logErr(`邮件发送失败: ${e.message}`);
        }
      }
    },
    onError: (msg: any) => {
      // 避免直接 exit，让 SDK 的 autoReconnect 有机会重连
      const errStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
      logErr(`IM 连接发生错误: ${errStr}`);
      logWarn('等待 SDK 自动重连 (最多重连 10 次，每次间隔 5 秒)...');
      // 仅当错误代码明确表示无法恢复时才退出
      if (errStr.includes('UNAUTHORIZED') || errStr.includes('auth') || errStr.includes('401')) {
        logErr('身份验证失败，无法重连，程序退出。请重新登录获取新凭证。');
        if (process.send) process.send('authfail');
        process.exit(1);
      }
    },
  });

  logInfo(`[监听中] ${config.mailing?.enabled ? '邮件推送已开启' : '邮件推送未开启'} | 自动重连次数上限: ${WebIMConfig.autoReconnectNumMax}`);
})();
