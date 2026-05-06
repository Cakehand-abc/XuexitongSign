"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CQ {
    #ws_url;
    #ws_instance;
    #target_type;
    #target_id;
    #cache;
    constructor(arg1, arg2, arg3) {
        this.#ws_url = arg1;
        this.#target_type = arg2 || 'private';
        this.#target_id = arg3 || 1001;
        this.#cache = new Map();
    }
    static hasImage = (msg) => {
        return msg.includes('[CQ:image');
    };
    connect() {
        if (!this.#ws_instance)
            this.#ws_instance = new WebSocket(this.#ws_url);
        this.#ws_instance.onerror = function (e) {
            console.log('[连接异常]', e);
        };
        return this;
    }
    send(arg1, arg2, arg3, arg4) {
        if (arg3) {
            this.#ws_instance?.send(JSON.stringify({ action: arg3, params: arg4 }));
            return;
        }
        ;
        const payload = {
            action: arg3 || 'send_msg',
            params: {
                message_type: this.#target_type,
                message: arg1,
                auto_escape: true
            }
        };
        this.#target_type === 'private' ? payload.params.user_id = arg2 : payload.params.group_id = arg2;
        this.#ws_instance?.send(JSON.stringify(payload));
    }
    close() {
        this.#ws_instance?.close();
    }
    getTargetID() {
        return this.#target_id;
    }
    getCache(key) {
        return this.#cache.get(key);
    }
    setCache(key, object) {
        this.#cache.set(key, object);
    }
    clearCache() {
        this.#cache.clear();
    }
    onMessage(handler) {
        if (this.#ws_instance) {
            this.#ws_instance.onmessage = (e) => {
                const data = JSON.parse(e.data);
                const isTarget = !!(data.group_id === this.#target_id || data.user_id === this.#target_id);
                if (data.post_type === 'message' && isTarget) {
                    handler.call(this, data.raw_message);
                }
            };
        }
    }
}
exports.default = CQ;
