import { AlertColor } from '@mui/material';
import Alert from '@mui/material/Alert';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import { fetch as Fetch } from '../../utils/request';
import Box from '@mui/material/Box';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { activity_api, login_api } from '../../config/api';
import './DashBoard.css';
import { generalSign, locationSign, showResultWithTransition } from './Helper';

interface SignInfo {
  activity: Activity;
  status: string;
}
interface Activity {
  name: string;
  activeId?: number;
  courseId?: string | number;
  classId?: string | number;
  otherId?: string | number;
}
interface AlertInfo {
  msg: string;
  show: boolean;
  severity: AlertColor;
}

function DashBoard() {
  const params = useParams();
  const [userParams, setUserParams] = useState<UserParamsType>({} as UserParamsType);
  const [sign, setSign] = useState<SignInfo>({
    activity: {
      name: ''
    },
    status: ''
  });
  const [progress, setProgress] = useState(false);

  const [values, setValues] = useState<{ [index: string]: string | File; }>({});
  const [alert, setAlert] = useState<AlertInfo>({ msg: '', show: false, severity: 'info' });

  const [control, setControl] = useState({
    start: {
      show: true
    }
  });

  const start = async () => {
    // eslint-disable-next-line prefer-const
    let activity: any;
    document.getElementById('start-btn')?.classList.add('hidden');
    setTimeout(() => {
      setControl({ start: { show: false } });
      if (!activity) {
        setProgress(true);
      }
    }, 350);

    activity = await Fetch(activity_api, {
      method: 'POST',
      body: {
        uf: userParams.uf,
        _d: userParams._d,
        vc3: userParams.vc3,
        uid: userParams._uid
      }
    });
    // console.log(activity)
    setProgress(false);
    switch (activity) {
      case 'NoActivity': setSign({ activity: { name: '无签到活动' }, status: '' }); break;
      case 'AuthRequired': setSign({ activity: { name: '需重新登录' }, status: '' }); break;
      case 'NoCourse': setSign({ activity: { name: '无课程' }, status: '' }); break;
      default: setSign({ activity: (activity as Activity), status: '' });
    }
  };


  const updateValue = (name: string, value: string | File) => {
    setValues((prev) => {
      const object = { ...prev };
      object[name] = value;
      return object;
    });
  };
  const setStatus = (res: string) => {
    if (res === 'success') {
      setSign((prev) => {
        return {
          activity: prev.activity,
          status: '签到成功'
        };
      });
    } else {
      setSign((prev) => {
        return {
          activity: prev.activity,
          status: res
        };
      });
    }
  };
  const onSign_0 = async () => {
    const res = await generalSign(userParams, sign.activity.activeId);
    showResultWithTransition(setStatus, res);
  };

  const onSign_4 = async () => {
    // 优先使用预设地址
    if (userParams.config?.monitor?.presetAddress && userParams.config.monitor.presetAddress.length > 0) {
      const presetAddress = userParams.config.monitor.presetAddress[0];
      const res = await locationSign(userParams, sign.activity.activeId, presetAddress.lat, presetAddress.lon, presetAddress.address);
      showResultWithTransition(setStatus, res);
    } else {
      // 如果没有预设地址，使用手动输入的地址
      const latlon = values['latlon'] as string, address = values['address'] as string;
      const res = await locationSign(userParams, sign.activity.activeId, latlon.substring(latlon.indexOf(',') + 1, latlon.length),
        latlon.substring(0, latlon.indexOf(',')), address);
      showResultWithTransition(setStatus, res);
    }
  };
  const onSign_35 = async () => {
    const res = await generalSign(userParams, sign.activity.activeId);
    showResultWithTransition(setStatus, res);
  };

  useEffect(() => {
    const request = indexedDB.open('ui');
    request.onsuccess = () => {
      const db = request.result;
      // 获取用户登录时间
      const request_IDBGET = db.transaction('user', 'readwrite')
        .objectStore('user')
        .get(params.phone as string);
      request_IDBGET.onsuccess = async () => {
        // 数据读取成功
        setUserParams(request_IDBGET.result);
        // 身份过期自动重新登陆
        if (Date.now() - request_IDBGET.result.date > 432000000) {
          const user = await Fetch(login_api, {
            method: 'POST',
            body: {
              phone: request_IDBGET.result.phone,
              password: request_IDBGET.result.password
            }
          });
          if (user === 'AuthFailed') {
            setAlert({ msg: '重新登录失败', show: true, severity: 'error' });
          } else {
            const userParam: UserParamsType = {
              phone: request_IDBGET.result.phone,
              fid: user.fid,
              vc3: user.vc3,
              password: request_IDBGET.result.password,
              _uid: user._uid,
              _d: user._d,
              uf: user.uf,
              name: user.name,
              date: new Date(),
              lv: user.lv,
              monitor: false,
              config: user.config
            };
            setUserParams(userParam);
            // 登陆成功将新信息写入数据库
            db.transaction('user', 'readwrite')
              .objectStore('user').put(userParam)
              .onsuccess = () => {
                setAlert({ msg: '凭证已自动更新', show: true, severity: 'success' });
              };
          }
        }
      };
    };
  }, []);

  return (
    <div>
      {
        control.start.show &&
        <ButtonBase
          id='start-btn'
          onClick={start}
          sx={{ borderRadius: 50 }}
          className='neum-button'
          disableRipple
        >
          <span>开始</span>
        </ButtonBase>
      }
      {
        progress &&
        <CircularProgress size='5rem' />
      }
      <h1>{sign.activity.name}</h1>
      {
        sign.activity.otherId === 0 &&
        <Box
          component='div'
          id='neum-form'
          className='neum-form'
        >
          <h3>{sign.status}</h3>
          <div id='neum-form-content' className='form-content'>
            <p className='form-title'>点击签到</p><br />
            <ButtonBase
              id='sign-btn'
              onClick={onSign_0}
              className='neum-form-button'
              disableRipple>
              签到
            </ButtonBase>
          </div>
        </Box>
      }

      {
        sign.activity.otherId === 4 &&
        <Box
          component='div'
          id='neum-form'
          className='neum-form'
        >
          <h3>{sign.status}</h3>
          <div id='neum-form-content' className='form-content'>
            <p className='form-title'>经纬度和地址 (百度坐标系)</p><br />
            {userParams.config?.monitor?.presetAddress && userParams.config.monitor.presetAddress.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <p className='form-title' style={{ fontSize: '1.2rem' }}>预设地址</p>
                {userParams.config.monitor.presetAddress.map((addr, index) => (
                  <ButtonBase
                    key={index}
                    sx={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem',
                      marginBottom: '0.5rem',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      '&:hover': {
                        backgroundColor: '#e0e0e0'
                      }
                    }}
                    onClick={() => {
                      updateValue('latlon', `${addr.lon},${addr.lat}`);
                      updateValue('address', addr.address);
                      // 更新输入框显示
                      document.getElementById('input-latlon')?.setAttribute('value', `${addr.lon},${addr.lat}`);
                      document.getElementById('input-address')?.setAttribute('value', addr.address);
                    }}
                  >
                    {addr.address} ({addr.lon}, {addr.lat})
                  </ButtonBase>
                ))}
              </div>
            )}
            <input id='input-latlon' className='input-area' placeholder='例: 116.417492,39.920912' type='text'
              onChange={(e) => {
                updateValue('latlon', e.target.value);
                console.log(values);
              }} />
            <input id='input-address' className='input-area' placeholder='如: 河南省郑州市x区x大学' type='text'
              onChange={(e) => {
                updateValue('address', e.target.value);
                console.log(values);
              }} />
            <br />
            <ButtonBase
              id='sign-btn'
              onClick={onSign_4}
              className='neum-form-button'
              disableRipple
            >签到</ButtonBase>
          </div>
        </Box>
      }
      {
        (sign.activity.otherId === 3 || sign.activity.otherId === 5) &&
        <Box
          component='div'
          id='neum-form'
          className='neum-form'
        >
          <h3>{sign.status}</h3>
          <div id='neum-form-content' className='form-content'>
            <p className='form-title'>点击签到</p>
            <br />
            <ButtonBase
              id='sign-btn'
              onClick={onSign_35}
              className='neum-form-button'
              disableRipple
            >签到</ButtonBase>
          </div>
        </Box>
      }

      <Snackbar
        open={alert.show}
        autoHideDuration={3000}
        onClose={() => { setAlert({ show: false, severity: 'info', msg: '' }); }}
      >
        <Alert onClose={() => { setAlert({ show: false, severity: 'info', msg: '' }); }} severity={alert.severity} sx={{ width: '100%' }}>
          {alert.msg}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default DashBoard;