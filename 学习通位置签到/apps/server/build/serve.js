"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main_handler = exports.handler = exports.main = void 0;
const router_1 = __importDefault(require("@koa/router"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const koa_1 = __importDefault(require("koa"));
const koa_bodyparser_1 = __importDefault(require("koa-bodyparser"));
const serverless_http_1 = __importDefault(require("serverless-http"));
const activity_1 = require("./functions/activity");
const general_1 = require("./functions/general");
const location_1 = require("./functions/location");
const user_1 = require("./functions/user");
const file_1 = require("./utils/file");
const ENVJSON = (0, file_1.getJsonObject)('env.json');
const app = new koa_1.default();
const router = new router_1.default();
const processMap = new Map();
router.get('/', async (ctx) => {
    ctx.body = '<h1 style="text-align: center">Welcome, chaoxing-sign-cli API service is running.</h1>';
});
router.post('/login', async (ctx) => {
    const { phone, password } = ctx.request.body;
    const params = await (0, user_1.userLogin)(phone, password);
    if (typeof params === 'string') {
        ctx.body = params;
        return;
    }
    params.name = (await (0, user_1.getAccountInfo)(params)) || '获取失败';
    ctx.body = params;
});
router.post('/activity', async (ctx) => {
    const { uid, _d, vc3, uf } = ctx.request.body;
    const courses = await (0, user_1.getCourses)(uid, _d, vc3);
    if (typeof courses === 'string') {
        ctx.body = courses;
        return;
    }
    const activity = await (0, activity_1.traverseCourseActivity)({
        courses,
        uf: uf,
        _d: _d,
        _uid: uid,
        vc3: vc3,
    });
    if (typeof activity === 'string') {
        ctx.body = activity;
        return;
    }
    await (0, activity_1.preSign)({
        uf,
        _d,
        vc3,
        _uid: uid,
        ...activity,
    });
    console.log(uid);
    ctx.body = activity;
});
router.post('/location', async (ctx) => {
    const { uf, _d, vc3, name, uid, lat, lon, fid, address, activeId } = ctx.request.body;
    const res = await (0, location_1.LocationSign)({
        uf,
        _d,
        vc3,
        name,
        address,
        activeId,
        _uid: uid,
        lat,
        lon,
        fid,
    });
    console.log(name, uid);
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/general', async (ctx) => {
    const { uf, _d, vc3, name, activeId, uid, fid } = ctx.request.body;
    const res = await (0, general_1.GeneralSign)({
        uf,
        _d,
        vc3,
        name,
        activeId,
        _uid: uid,
        fid,
    });
    console.log(name, uid);
    if (res === 'success') {
        ctx.body = 'success';
        return;
    }
    else {
        ctx.body = res;
    }
});
router.post('/uvtoken', async (ctx) => {
    const { uf, _d, uid, vc3 } = ctx.request.body;
    const res = await (0, user_1.getPanToken)({
        uf,
        _d,
        _uid: uid,
        vc3,
    });
    ctx.body = JSON.parse(res);
});
router.get('/monitor/status/:phone', (ctx) => {
    if (processMap.get(ctx.params.phone)) {
        ctx.body = { code: 200, msg: 'Monitoring' };
    }
    else {
        ctx.body = { code: 201, msg: 'Suspended' };
    }
});
router.post('/monitor/stop/:phone', (ctx) => {
    const phone = ctx.params.phone;
    const process_monitor = processMap.get(phone);
    if (process_monitor !== undefined) {
        process_monitor.kill('SIGKILL');
        processMap.delete(phone);
    }
    ctx.body = { code: 201, msg: 'Suspended' };
});
router.post('/monitor/start/:phone', async (ctx) => {
    const phone = ctx.params.phone;
    if (processMap.get(phone) !== undefined) {
        ctx.body = { code: 200, msg: 'Already started' };
        return;
    }
    const monitorTsPath = path_1.default.join(__dirname, 'monitor.ts');
    const monitorJsPath = path_1.default.join(__dirname, 'monitor.js');
    const isDev = fs_1.default.existsSync(monitorTsPath);
    const targetFile = isDev ? monitorTsPath : monitorJsPath;
    try {
        const process_monitor = (0, child_process_1.fork)(targetFile, ['--auth', phone, ctx.request.rawBody], {
            cwd: __dirname,
            stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
            execArgv: isDev ? ['-r', 'ts-node/register'] : []
        });
        const response = await new Promise((resolve) => {
            let isResolved = false;
            const timeoutId = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    resolve({ code: 500, msg: '启动超时：子进程未在 20 秒内响应，请检查网络或凭证是否有效' });
                }
            }, 20000);
            process_monitor.on('message', (msg) => {
                if (isResolved)
                    return;
                clearTimeout(timeoutId);
                isResolved = true;
                switch (msg) {
                    case 'success':
                        processMap.set(phone, process_monitor);
                        resolve({ code: 200, msg: 'Started Successfully' });
                        break;
                    case 'authfail':
                        resolve({ code: 202, msg: 'Authencation Failed' });
                        break;
                    case 'notconfigured':
                        resolve({ code: 203, msg: 'Not Configured' });
                        break;
                    default:
                        resolve({ code: 500, msg: `未知返回状态: ${msg}` });
                }
            });
            process_monitor.on('error', (err) => {
                if (isResolved)
                    return;
                clearTimeout(timeoutId);
                isResolved = true;
                resolve({ code: 500, msg: `进程启动异常: ${err.message}` });
            });
            process_monitor.on('exit', (code, signal) => {
                if (isResolved)
                    return;
                clearTimeout(timeoutId);
                isResolved = true;
                resolve({ code: 500, msg: `进程意外崩溃 (退出码: ${code})。请确认已安装 ts-node 且配置正确。` });
            });
        });
        ctx.body = response;
    }
    catch (error) {
        ctx.body = { code: 500, msg: `Fork 执行失败: ${error.message}` };
    }
});
app.use((0, koa_bodyparser_1.default)({ enableTypes: ['json', 'form', 'text'] }));
app.use(async (ctx, next) => {
    await next();
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type');
    if (ctx.method === 'OPTIONS') {
        ctx.set('Access-Control-Max-Age', '300');
        ctx.body = '';
    }
});
app.use(router.routes());
process.on('SIGINT', () => {
    processMap.forEach((pcs) => {
        pcs.kill('SIGINT');
    });
    process.exit();
});
if (!ENVJSON.env.SERVERLESS)
    app.listen(5000, () => {
        console.log('API Server: http://localhost:5000');
    });
exports.main = (0, serverless_http_1.default)(app);
exports.handler = exports.main;
exports.main_handler = exports.main;
