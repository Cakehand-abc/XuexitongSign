import { describe, it, expect } from 'vitest';
import { getSignResult } from '../activity';

describe('getSignResult', () => {
  it('should return "成功" for "success"', () => {
    expect(getSignResult('success')).toBe('成功');
  });

  it('should return "失败" for "fail"', () => {
    expect(getSignResult('fail')).toBe('失败');
  });

  it('should return "请发送二维码" for "fail-need-qrcode"', () => {
    expect(getSignResult('fail-need-qrcode')).toBe('请发送二维码');
  });

  it('should return the input string for any other input', () => {
    expect(getSignResult('unknown-error')).toBe('unknown-error');
    expect(getSignResult('something else')).toBe('something else');
    expect(getSignResult('')).toBe('');
  });
});
