declare module '*.module.css';

declare module '@nuintun/qrcode';

interface UserParamsType {
  phone: string;
  password: string;
  name: string;
  fid: string;
  lv: string;
  uf: string;
  vc3: string;
  _d: string;
  _uid: string;
  date: Date;
  monitor: boolean;
  config: UserConfig;
}

interface UserConfig {
  monitor: MonitorConfig;
  mailing: MailingConfig;
}

interface AddressItem {
  lon: string;
  lat: string;
  address: string;
}

type PresetAddress = AddressItem[];

interface MonitorConfig {
  delay: number;
  presetAddress: PresetAddress;
  clientIp?: string;  // 模拟的客户端 IP，留空则不发送 clientip 参数
}

interface MailingConfig {
  enabled: boolean;
  host: string;
  ssl: boolean;
  port: number;
  user: string;
  pass: string;
  to: string;
}
