import filehandle from 'fs';
import path from 'path';

interface LocalData {
  users: Record<string, User>;
}

/**
 * 储存用户凭证
 */
export const storeUser = (phone: string, user: User): User[] => {
  const data: any = getJsonObject('configs/storage.json');
  user.phone = phone;

  // 兼容旧的数组格式并进行迁移
  if (Array.isArray(data.users)) {
    const usersObj: Record<string, User> = {};
    for (const u of data.users) {
      if (u.phone) usersObj[u.phone] = u;
    }
    data.users = usersObj;
  }

  data.users[phone] = user;

  filehandle.writeFileSync(path.join(__dirname, '../configs/storage.json'), JSON.stringify(data), 'utf8');
  return Object.values(data.users as Record<string, User>);
};

export const getStoredUser = (phone: string): User | null => {
  const users: any = getJsonObject('configs/storage.json').users;
  if (Array.isArray(users)) {
    for (let i = 0; i < users.length; i++) {
      if (users[i].phone === phone) {
        return JSON.parse(JSON.stringify(users[i]));
      }
    }
  } else if (users && typeof users === 'object') {
    if (users[phone]) {
      return JSON.parse(JSON.stringify(users[phone]));
    }
  }
  return null;
};

export const getJsonObject = (fileURL: string) => {
  return JSON.parse(filehandle.readFileSync(path.join(__dirname, '../' + fileURL), 'utf8'));
};
