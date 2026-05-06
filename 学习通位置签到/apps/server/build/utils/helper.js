"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promiseAny = exports.delay = void 0;
const promiseAny = (tasks) => {
    let length = tasks.length;
    return new Promise((resolve, reject) => {
        if (length === 0) {
            reject(new Error('All promises were rejected'));
            return;
        }
        tasks.forEach((promise) => {
            promise.then((res) => {
                resolve(res);
                return;
            }, () => {
                length--;
                if (length === 0) {
                    reject(new Error('All promises were rejected'));
                    return;
                }
            });
        });
    });
};
exports.promiseAny = promiseAny;
const delay = async (timeout = 0) => {
    await new Promise((res) => setTimeout(() => res(), timeout * 1000));
};
exports.delay = delay;
