import Router from '@koa/router';
import fs from 'fs';
import path from 'path';
import { ChildProcess, fork } from 'child_process';
import Koa from 'koa';
import bodyparser from 'koa-bodyparser';
import multiparty from 'multiparty';
import serverless from 'serverless-http';
import { preSign, traverseCourseActivity } from './functions/activity';
import { GeneralSign } from './functions/general';
import { LocationSign } from './functions/location';
import { getAccountInfo, getCourses, getPanToken, userLogin } from './functions/user';
import { getJsonObject } from './utils/file';
const ENVJSON = getJsonObject('env.json');

const app = new Koa();
const router = new Router();
const processMap = new Map<string, ChildProcess>();

router.get('/', async (ctx) => {
  ctx.body = '<h1 style="text-align: center">Welcome, chaoxing-sign-cli API service is running.</h1>';
});

router.post('/login', async (ctx) => {
  const { phone, password } = ctx.request.body as any;
  const params = await userLogin(phone, password);
  // 登陆失败
  if (typeof params === 'string') {
    ctx.body = params;
    return;
  }
  params.name = (await getAccountInfo(params)) || '获取失败';
  ctx.body = params;
});

router.post('/activity', async (ctx) => {
  const { uid, _d, vc3, uf } = ctx.request.body as any;
  const courses = await getCourses(uid, _d, vc3);
  // 身份凭证过期
  if (typeof courses === 'string') {
    ctx.body = courses;
    return;
  }
  const activity = await traverseCourseActivity({
    courses,
    uf: uf,
    _d: _d,
    _uid: uid,
    vc3: vc3,
  });
  // 无活动
  if (typeof activity === 'string') {
    ctx.body = activity;
    return;
  }
  // 对活动进行预签
  await preSign({
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
  const { uf, _d, vc3, name, uid, lat, lon, fid, address, activeId } = ctx.request.body as any;
  const res = await LocationSign({
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
  } else {
    ctx.body = res;
  }
});

router.post('/general', async (ctx) => {
  const { uf, _d, vc3, name, activeId, uid, fid } = ctx.request.body as any;
  const res = await GeneralSign({
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
  } else {
    ctx.body = res;
  }
});

router.post('/uvtoken', async (ctx) => {
  const { uf, _d, uid, vc3 } = ctx.request.body as any;
  const res = await getPanToken({
    uf,
    _d,
    _uid: uid,
    vc3,
  });
  ctx.body = JSON.parse(res); // 获得的是个JSON字符串，需转换
});


// 200:监听中，201:未监听，202:登录失败
router.get('/monitor/status/:phone', (ctx) => {
  // 状态为正在监听
  if (processMap.get(ctx.params.phone)) {
    ctx.body = { code: 200, msg: 'Monitoring' };
  } else {
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

// base64字串需包含 credentials, monitor, mailing, cqserver 内容
router.post('/monitor/start/:phone', async (ctx) => {
  const phone = ctx.params.phone;

  // 1. 拦截重复启动
  if (processMap.get(phone) !== undefined) {
    ctx.body = { code: 200, msg: 'Already started' };
    return;
  }

  // 2. 绝对路径扫描，精准判断当前是 Dev(TS) 还是 Prod(JS) 环境
  const monitorTsPath = path.join(__dirname, 'monitor.ts');
  const monitorJsPath = path.join(__dirname, 'monitor.js');
  const isDev = fs.existsSync(monitorTsPath);
  const targetFile = isDev ? monitorTsPath : monitorJsPath;

  try {
    // 3. 启动子进程，并在 Dev 环境下强行注入 ts-node 解释器
    const process_monitor = fork(targetFile, ['--auth', phone, ctx.request.rawBody], {
      cwd: __dirname,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      execArgv: isDev ? ['-r', 'ts-node/register'] : []
    });

    const response = await new Promise((resolve) => {
      let isResolved = false;

      // 4. 终极兜底：20秒超时（IM连接通常需要5~10秒）
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve({ code: 500, msg: '启动超时：子进程未在 20 秒内响应，请检查网络或凭证是否有效' });
        }
      }, 20000);

      // 监听正常业务消息
      process_monitor.on('message', (msg) => {
        if (isResolved) return;
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

      // 监听子进程运行时错误
      process_monitor.on('error', (err) => {
        if (isResolved) return;
        clearTimeout(timeoutId);
        isResolved = true;
        resolve({ code: 500, msg: `进程启动异常: ${err.message}` });
      });

      // 监听子进程意外崩溃退出
      process_monitor.on('exit', (code, signal) => {
        if (isResolved) return;
        clearTimeout(timeoutId);
        isResolved = true;
        resolve({ code: 500, msg: `进程意外崩溃 (退出码: ${code})。请确认已安装 ts-node 且配置正确。` });
      });
    });

    ctx.body = response;
  } catch (error: any) {
    ctx.body = { code: 500, msg: `Fork 执行失败: ${error.message}` };
  }
});

app.use(bodyparser({ enableTypes: ['json', 'form', 'text'] }));
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

// Ctrl + C 终止程序
process.on('SIGINT', () => {
  processMap.forEach((pcs) => {
    pcs.kill('SIGINT');
  });
  process.exit();
});

// 若在服务器，直接运行
if (!ENVJSON.env.SERVERLESS)
  app.listen(5000, () => {
    console.log('API Server: http://localhost:5000');
  });

// 导出云函数
export const main = serverless(app);
export const handler = main;
export const main_handler = main;
