"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushplusSend = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const request_1 = require("./request");
function sendEmail(args) {
    const { uid, realname, aid, status, mailing } = args;
    const transporter = nodemailer_1.default.createTransport({
        host: mailing.host,
        port: mailing.port,
        secure: mailing.ssl,
        auth: {
            user: mailing.user,
            pass: mailing.pass,
        },
    });
    transporter.sendMail({
        from: `"CLI" <${mailing.user}>`,
        to: mailing.to,
        subject: '服务器签到反馈',
        html: `<table border="1"><thead><th>aid</th><th>uid</th><th>name</th><th>status</th></thead><tbody><td>${aid}</td><td>${uid}</td><td>${realname}</td><td>${status}</td></tbody></table>`,
    }, () => {
        transporter.close();
    });
}
exports.sendEmail = sendEmail;
const pushplusSend = (args) => {
    return (0, request_1.request)('http://www.pushplus.plus/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    }, args);
};
exports.pushplusSend = pushplusSend;
