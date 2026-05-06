"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignResult = exports.getSignType = exports.speculateType = exports.preSign2 = exports.preSign = exports.getPPTActiveInfo = exports.getActivity = exports.traverseCourseActivity = void 0;
const api_1 = require("../configs/api");
const request_1 = require("../utils/request");
const traverseCourseActivity = async (args) => {
    console.log('正在查询有效签到活动，等待时间视网络情况而定...');
    const { courses, ...cookies } = args;
    let i = 0;
    let tasks = [];
    if (courses.length === 1) {
        try {
            return await (0, exports.getActivity)({ course: courses[0], ...cookies });
        }
        catch (err) {
            console.log('未检测到有效签到活动！');
            return 'NoActivity';
        }
    }
    tasks.push((0, exports.getActivity)({ course: courses[0], ...cookies }));
    for (i = 1; i < courses.length; i++) {
        tasks.push((0, exports.getActivity)({ course: courses[i], ...cookies }));
        if (i % 5 === 0 || i === courses.length - 1) {
            try {
                return await Promise.any(tasks);
            }
            catch (error) { }
            tasks = [];
        }
    }
    console.log('未检测到有效签到活动！');
    return 'NoActivity';
};
exports.traverseCourseActivity = traverseCourseActivity;
const getActivity = async (args) => {
    const { course, ...cookies } = args;
    const result = await (0, request_1.request)(`${api_1.ACTIVELIST.URL}?fid=0&courseId=${course.courseId}&classId=${course.classId}&_=${new Date().getTime()}`, {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    const data = JSON.parse(result.data);
    if (data.data !== null) {
        if (data.data.activeList.length !== 0) {
            const otherId = Number(data.data.activeList[0].otherId);
            if (otherId >= 0 && otherId <= 5 && data.data.activeList[0].status === 1) {
                if ((new Date().getTime() - data.data.activeList[0].startTime) / 1000 < 7200) {
                    console.log(`检测到活动：${data.data.activeList[0].nameOne}`);
                    return {
                        activeId: data.data.activeList[0].id,
                        name: data.data.activeList[0].nameOne,
                        courseId: course.courseId,
                        classId: course.classId,
                        otherId,
                    };
                }
            }
        }
    }
    else {
        console.log('请求似乎有些频繁，获取数据为空!');
        return 'Too Frequent';
    }
    throw 'Not Available';
};
exports.getActivity = getActivity;
const getPPTActiveInfo = async ({ activeId, ...cookies }) => {
    const result = await (0, request_1.request)(`${api_1.PPTACTIVEINFO.URL}?activeId=${activeId}`, {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    return JSON.parse(result.data).data;
};
exports.getPPTActiveInfo = getPPTActiveInfo;
const preSign = async (args) => {
    const { activeId, classId, courseId, ...cookies } = args;
    await (0, request_1.request)(`${api_1.PRESIGN.URL}?courseId=${courseId}&classId=${classId}&activePrimaryId=${activeId}&general=1&sys=1&ls=1&appType=15&&tid=&uid=${args._uid}&ut=s`, {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    console.log('[预签]已请求');
    const analysisResult = await (0, request_1.request)(`${api_1.ANALYSIS.URL}?vs=1&DB_STRATEGY=RANDOM&aid=${activeId}`, {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    let code = analysisResult.data;
    const code_start = code.indexOf('code=\'+\'') + 8;
    code = code.substring(code_start, code.length);
    const code_end = code.indexOf('\'');
    code = code.substring(0, code_end);
    const analysis2Result = await (0, request_1.request)(`${api_1.ANALYSIS2.URL}?DB_STRATEGY=RANDOM&code=${code}`, {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    console.log(`analysis 请求结果：${analysis2Result.data}`);
    await new Promise(resolve => setTimeout(async () => {
        resolve();
    }, 500));
};
exports.preSign = preSign;
const preSign2 = async (args) => {
    const { activeId, chatId, tuid, ...cookies } = args;
    const result = await (0, request_1.request)(`${api_1.CHAT_GROUP.PRESTUSIGN.URL}?activeId=${activeId}&code=&uid=${cookies._uid}&courseId=null&classId=0&general=0&chatId=${chatId}&appType=0&tid=${tuid}&atype=null&sys=0`, {
        headers: {
            Cookie: (0, request_1.cookieSerialize)(cookies),
        },
    });
    console.log('[预签]已请求');
    return result.data;
};
exports.preSign2 = preSign2;
const speculateType = (text) => {
    if (text.includes('拍照')) {
        return 'photo';
    }
    else if (text.includes('位置')) {
        return 'location';
    }
    else if (text.includes('二维码')) {
        return 'qr';
    }
    return 'general';
};
exports.speculateType = speculateType;
const getSignType = (iptPPTActiveInfo) => {
    switch (iptPPTActiveInfo.otherId) {
        case 0:
            if (iptPPTActiveInfo.ifphoto === 1) {
                return '拍照签到';
            }
            else {
                return '普通签到';
            }
        case 2: return '二维码签到';
        case 3: return '手势签到';
        case 4: return '位置签到';
        case 5: return '签到码签到';
        default: return '未知';
    }
};
exports.getSignType = getSignType;
const getSignResult = (iptResult) => {
    switch (iptResult) {
        case 'success': return '成功';
        case 'fail': return '失败';
        case 'fail-need-qrcode': return '请发送二维码';
        default: return iptResult;
    }
};
exports.getSignResult = getSignResult;
