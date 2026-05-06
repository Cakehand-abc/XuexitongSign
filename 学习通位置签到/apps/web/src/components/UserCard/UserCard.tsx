import React, { useState } from 'react';
import { fetch as Fetch } from '../../utils/request';
import enc from 'crypto-js/enc';
import Delete from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useNavigate } from 'react-router-dom';
import { useLongPress } from '../../hooks/useLongPress';
import { DialogChoice } from '../../pages/Start/Start';
import { login_api, monitor_stop_api, monitor_start_api } from '../../config/api';
import styles from './UserCard.module.css';

interface UserCardProps {
  indb: IDBDatabase;
  user: UserParamsType;
  setAlert: (msg: any) => void;
  setCurrent: (target: UserParamsType) => void;
  setUser: (value: React.SetStateAction<any>) => void;
  emitDialog: (choice: DialogChoice, open: boolean) => void;
}

function UserCard(props: UserCardProps) {
  const phoneStr = `${props.user.phone.substring(0, 3)} **** **${props.user.phone.substring(9)}`;
  const navigate = useNavigate();
  // once/setOnce removed - replaced with isRequestingRef for proper concurrency control
  const [ref] = useLongPress((pos) => {
    handleSafariContextMenu(pos);
  }, 500);
  const [loading, setLoading] = useState(false);
  const isRequestingRef = React.useRef(false);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);

  // 移除用户
  const removeUser = () => {
    const request = props.indb.transaction('user', 'readwrite').objectStore('user').delete(props.user.phone);
    request.onsuccess = () => {
      console.log('用户已被移除');
      contextMenuClose();
      window.location.reload();
    };
  };

  // 弹出监听配置窗口
  const configureMonitor = () => {
    contextMenuClose();
    props.setCurrent(props.user);
    props.emitDialog(DialogChoice.CONFIG, true);
  };

  // 刷新凭证：用已存密码重新登录，保留已配置的坐标地址
  const refreshCredentials = async () => {
    contextMenuClose();
    if (!props.user.password) {
      props.setAlert({ open: true, message: '密码未保存，请删除此账号后重新添加' });
      return;
    }
    try {
      const newUser = await Fetch(login_api, {
        method: 'POST',
        body: { phone: props.user.phone, password: props.user.password }
      });
      if (newUser === 'AuthFailed') {
        props.setAlert({ open: true, message: '凭证刷新失败：账号或密码错误' });
        return;
      }
      // 写入新凭证，但保留 config（已配置的地址）和 monitor 状态
      const request = props.indb.transaction('user', 'readwrite').objectStore('user').put({
        phone: props.user.phone,
        password: props.user.password,
        name: newUser.name || props.user.name,
        _uid: newUser._uid,
        uf: newUser.uf,
        vc3: newUser.vc3,
        _d: newUser._d,
        fid: newUser.fid,
        lv: newUser.lv,
        date: new Date(),
        monitor: props.user.monitor,
        config: props.user.config  // 保留已配置的坐标地址！
      });
      request.onsuccess = () => {
        window.location.reload(); // 刷新页面显示新凭证日期
      };
      request.onerror = () => {
        props.setAlert({ open: true, message: '凭证写入失败' });
      };
    } catch (e: any) {
      props.setAlert({ open: true, message: `刷新失败: ${e.message}` });
    }
  };

  // 菜单处理
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
          mouseX: event.clientX - 2,
          mouseY: event.clientY - 4,
        }
        : null,
    );
  };

  // Safari 浏览器，长按弹出菜单需要模拟
  const handleSafariContextMenu = (position: { x: number, y: number; }) => {
    setContextMenu(
      contextMenu === null
        ? {
          mouseX: position.x - 2,
          mouseY: position.y - 4,
        }
        : null,
    );
  };

  const contextMenuClose = () => {
    setContextMenu(null);
  };

  // 设置用户监听状态
  const setMonitorState = (target: UserParamsType, value: boolean) => {
    // 更新列表用户的监听状态
    props.setUser((prev: any) => {
      return prev.map((user: UserParamsType) => {
        if (user.phone === target.phone) {  // 用 phone 匹配，避免引用失效
          return { ...user, monitor: value };
        }
        return user;
      });
    });
    // 同时要将状态写入数据库
    const request = props.indb!.transaction(['user'], 'readwrite')
      .objectStore('user')
      .put({
        phone: target.phone,
        fid: target.fid,
        vc3: target.vc3,
        password: target.password,
        _uid: target._uid,
        _d: target._d,
        uf: target.uf,
        name: target.name,
        date: new Date(),
        monitor: value,
        lv: target.lv,
        config: { ...target.config }
      });
    request.onerror = () => { console.log('写入失败'); };
    request.onsuccess = () => { console.log('写入成功'); };
  };

  // 开<=>关
  const toggleMonitor = async () => {
    // 防止重复点击：使用 ref 而不是 state，避免异步闭包问题
    if (isRequestingRef.current) return;
    isRequestingRef.current = true;
    setLoading(true);
    let reqData: any, reqAPI: string;
    if (props.user.monitor) {
      reqAPI = monitor_stop_api;
    } else {
      reqAPI = monitor_start_api;
      const payload = JSON.stringify({
        credentials: {
          phone: props.user.phone,
          uf: props.user.uf,
          _d: props.user._d,
          vc3: props.user.vc3,
          uid: props.user._uid,
          lv: props.user.lv,
          fid: props.user.fid
        },
        config: { ...props.user.config }
      });
      reqData = enc.Utf8.parse(payload).toString(enc.Base64);
    }

    const result = await Fetch(`${reqAPI}/${props.user.phone}`, { method: 'POST', body: reqData });
    switch (result.code) {
      case 200: {
        setMonitorState(props.user, true); break;
      }
      case 201: {
        setMonitorState(props.user, false); break;
      }
      case 202: {
        setMonitorState(props.user, false);
        props.setAlert({ open: true, message: '身份过期' });
        break;
      }
      default: {
        // 500 or other errors - 不改变状态，仅提示
        props.setAlert({ open: true, message: result.msg || '启动失败，请查看终端日志' });
        break;
      }
    }
    setLoading(false);
    isRequestingRef.current = false;
  };

  const handleMonitorChange = (e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
    e.stopPropagation();
    toggleMonitor();
  };

  return (
    <Card
      sx={{
        display: 'inline-block',
        maxWidth: 345,
        minWidth: 300,
        backgroundColor: '#ecf0f3',
        marginBottom: 3.5,
        marginRight: 3.5,
        verticalAlign: 'bottom',
        minHeight: 165,
      }}
      ref={ref}
      onContextMenu={handleContextMenu}
      className={styles.neumCard}
    >
      <CardActionArea onClick={() => { navigate('/dash/' + props.user.phone); }} sx={{ height: '100%', minHeight: 165 }}>
        <CardContent sx={{ position: 'relative' }}>
          <Typography variant="h5" align='left' component="div">
            <span className={styles.name}>{props.user.name}</span>
            <span style={{ display: 'block', fontSize: '1rem', color: 'inherit' }}>{phoneStr}</span>
          </Typography>
          <Typography sx={{ color: 'rgb(73, 85, 105)' }} variant="body2" align='right'>
            凭证日期：{new Date(props.user.date).toLocaleString()}
          </Typography>
          <span className={styles.monitorBtn + ' ' + (props.user.monitor === true ? styles.active : styles.inactive)}
            onClick={handleMonitorChange}
          >
            {loading ? '加载中' : props.user.monitor === true ? '自动位置签到中' : '未开启自动签到'}
          </span>
        </CardContent>
      </CardActionArea>
      <Menu
        open={contextMenu !== null}
        onClose={contextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        <MenuItem onClick={removeUser}>
          <ListItemIcon>
            <Delete />
          </ListItemIcon>
          <ListItemText>移除</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={refreshCredentials}>
          <ListItemIcon>
            <RefreshIcon />
          </ListItemIcon>
          <ListItemText>刷新凭证（Cookie 失效时用）</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={configureMonitor}>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText>监听配置</ListItemText>
        </MenuItem>
      </Menu>
    </Card >
  );
}

export default UserCard;