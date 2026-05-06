import { blue, green, red, yellow } from 'kolorist';
import { CHAT_GROUP, PPTSIGN } from '../configs/api';
import { delay } from '../utils/helper';
import { cookieSerialize, request } from '../utils/request';

interface AddressItem {
  lon: string;
  lat: string;
  address: string;
}
type PresetAddress = AddressItem[];
type CookieWithAddressItemArgs = BasicCookie & AddressItem & { name: string; activeId: string; fid: string; clientIp?: string; };
type CookieWithPresetAddressArgs = BasicCookie & { presetAddress: PresetAddress; name: string; activeId: string; fid: string; clientIp?: string; };

type LocationSignType = {
  (arg1: CookieWithAddressItemArgs): Promise<string>;
  (arg1: CookieWithPresetAddressArgs): Promise<string>;
};

const FAKE_UA = encodeURIComponent('Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36');

/** 最大重试次数 */
const MAX_RETRIES = 3;
/** 重试间隔（秒） */
const RETRY_DELAY_SEC = 2;

/**
 * 对单个地址发起位置签到，内置重试机制
 */
async function attemptSign(url: string, cookie: string, label: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(blue(`[位置签到] 第 ${attempt}/${MAX_RETRIES} 次尝试 | 地址: ${label}`));
    try {
      const result = await request(url, {
        headers: {
          Cookie: cookie,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
        },
      });
      const raw = result.data as string;
      console.log(blue(`[位置签到] 服务器响应: ${raw}`));
      if (raw === 'success') {
        console.log(green('[位置签到] ✅ 签到成功！'));
        return '[位置]签到成功';
      }
      // 已签到等情况不需要重试
      if (raw.includes('已签到') || raw.includes('success')) {
        console.log(green(`[位置签到] ✅ ${raw}`));
        return `[位置]${raw}`;
      }
      console.log(yellow(`[位置签到] ⚠️  签到未成功，响应: ${raw}`));
      if (attempt < MAX_RETRIES) {
        console.log(yellow(`[位置签到] 等待 ${RETRY_DELAY_SEC} 秒后重试...`));
        await delay(RETRY_DELAY_SEC);
      }
    } catch (e: any) {
      console.log(red(`[位置签到] ❌ 网络请求出错 (第${attempt}次): ${e.message}`));
      if (attempt < MAX_RETRIES) {
        console.log(yellow(`[位置签到] 等待 ${RETRY_DELAY_SEC} 秒后重试...`));
        await delay(RETRY_DELAY_SEC);
      }
    }
  }
  const failMsg = '[位置]重试3次均失败，请检查坐标或网络';
  console.log(red(`[位置签到] ❌ ${failMsg}`));
  return failMsg;
}

/**
 * 对单个地址发起位置签到（群聊版），内置重试机制
 */
async function attemptSignPost(formdata: string, cookie: string, label: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(blue(`[位置签到(群聊)] 第 ${attempt}/${MAX_RETRIES} 次尝试 | 地址: ${label}`));
    try {
      const result = await request(
        CHAT_GROUP.SIGN.URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Cookie: cookie,
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
          },
        },
        formdata
      );
      const raw = result.data as string;
      console.log(blue(`[位置签到(群聊)] 服务器响应: ${raw}`));
      if (raw === 'success') {
        console.log(green('[位置签到(群聊)] ✅ 签到成功！'));
        return '[位置]签到成功';
      }
      if (raw.includes('已签到') || raw.includes('success')) {
        console.log(green(`[位置签到(群聊)] ✅ ${raw}`));
        return `[位置]${raw}`;
      }
      console.log(yellow(`[位置签到(群聊)] ⚠️  签到未成功，响应: ${raw}`));
      if (attempt < MAX_RETRIES) {
        console.log(yellow(`[位置签到(群聊)] 等待 ${RETRY_DELAY_SEC} 秒后重试...`));
        await delay(RETRY_DELAY_SEC);
      }
    } catch (e: any) {
      console.log(red(`[位置签到(群聊)] ❌ 网络请求出错 (第${attempt}次): ${e.message}`));
      if (attempt < MAX_RETRIES) {
        console.log(yellow(`[位置签到(群聊)] 等待 ${RETRY_DELAY_SEC} 秒后重试...`));
        await delay(RETRY_DELAY_SEC);
      }
    }
  }
  const failMsg = '[位置]重试3次均失败，请检查坐标或网络';
  console.log(red(`[位置签到(群聊)] ❌ ${failMsg}`));
  return failMsg;
}

export const LocationSign: LocationSignType = async (args): Promise<string> => {
  if ('address' in args) {
    // 单个位置直接签
    const { name, address, activeId, lat, lon, fid, clientIp, ...cookies } = args;
    const ipToUse = clientIp || '1.1.1.1';
    const label = `${address} (${lon},${lat})`;
    // 对中文地址和姓名进行 URL 编码，防止中文字符导致请求失败
    const url = `${PPTSIGN.URL}?name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=${ipToUse}&useragent=${FAKE_UA}&latitude=${lat}&longitude=${lon}&fid=${fid}&appType=15&ifTiJiao=1&vpProbability=-1&vpStr=`;
    console.log(blue(`[位置签到] 开始签到 | activeId=${activeId} | IP: ${ipToUse} | 坐标: (${lon}, ${lat})`));
    return await attemptSign(url, cookieSerialize(cookies), label);
  } else {
    // 多个位置尝试，每个都走重试逻辑
    const { name, activeId, presetAddress, fid, clientIp, ...cookies } = args;
    const ipToUse = clientIp || '1.1.1.1';
    if (!presetAddress || presetAddress.length === 0) {
      const msg = '[位置]签到失败：未配置预设地址';
      console.log(red(`[位置签到] ❌ ${msg}`));
      return msg;
    }
    console.log(blue(`[位置签到] 共有 ${presetAddress.length} 个预设地址，IP: ${ipToUse}，将依次尝试`));
    for (let i = 0; i < presetAddress.length; i++) {
      const { address, lat, lon } = presetAddress[i];
      const label = `${address} (${lon},${lat})`;
      const url = `${PPTSIGN.URL}?name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=${ipToUse}&useragent=${FAKE_UA}&latitude=${lat}&longitude=${lon}&fid=${fid}&appType=15&ifTiJiao=1&vpProbability=-1&vpStr=`;
      console.log(blue(`[位置签到] ▶ 第 ${i + 1}/${presetAddress.length} 个预设地址: ${label}`));
      const result = await attemptSign(url, cookieSerialize(cookies), label);
      if (result === '[位置]签到成功') return result;
      // 非"已签到"类失败才继续尝试下一个
      if (result.includes('已签到')) return result;
      console.log(yellow(`[位置签到] 该地址签到失败，尝试下一个预设地址...`));
    }
    const msg = '[位置]所有预设地址均签到失败';
    console.log(red(`[位置签到] ❌ ${msg}`));
    return msg;
  }
};

/**
 * 位置签到，无课程群聊版本
 */
export const LocationSign_2: LocationSignType = async (args): Promise<string> => {
  if ('address' in args) {
    const { address, activeId, lat, lon, clientIp, ...cookies } = args;
    const ipToUse = clientIp || '1.1.1.1';
    const label = `${address} (${lon},${lat})`;
    const formdata = `address=${encodeURIComponent(address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=${ipToUse}&useragent=${FAKE_UA}&latitude=${lat}&longitude=${lon}&fid=&ifTiJiao=1&vpProbability=-1&vpStr=`;
    console.log(blue(`[位置签到(群聊)] 开始签到 | activeId=${activeId} | IP: ${ipToUse} | 坐标: (${lon}, ${lat})`));
    return await attemptSignPost(formdata, cookieSerialize(cookies), label);
  } else {
    const { activeId, presetAddress, clientIp, ...cookies } = args;
    const ipToUse = clientIp || '1.1.1.1';
    if (!presetAddress || presetAddress.length === 0) {
      const msg = '[位置]签到失败：未配置预设地址';
      console.log(red(`[位置签到(群聊)] ❌ ${msg}`));
      return msg;
    }
    console.log(blue(`[位置签到(群聊)] 共有 ${presetAddress.length} 个预设地址，IP: ${ipToUse}，将依次尝试`));
    for (let i = 0; i < presetAddress.length; i++) {
      const { address, lat, lon } = presetAddress[i];
      const label = `${address} (${lon},${lat})`;
      const formdata = `address=${encodeURIComponent(address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=${ipToUse}&useragent=${FAKE_UA}&latitude=${lat}&longitude=${lon}&fid=&ifTiJiao=1&vpProbability=-1&vpStr=`;
      console.log(blue(`[位置签到(群聊)] ▶ 第 ${i + 1}/${presetAddress.length} 个预设地址: ${label}`));
      const result = await attemptSignPost(formdata, cookieSerialize(cookies), label);
      if (result === '[位置]签到成功') return result;
      if (result.includes('已签到')) return result;
      console.log(yellow(`[位置签到(群聊)] 该地址签到失败，尝试下一个预设地址...`));
    }
    const msg = '[位置]所有预设地址均签到失败';
    console.log(red(`[位置签到(群聊)] ❌ ${msg}`));
    return msg;
  }
};

export const presetAddressChoices = (presetAddress: any[] = []) => {
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
