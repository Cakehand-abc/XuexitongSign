"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyFiles = void 0;
const fs_1 = __importDefault(require("fs"));
const promises_1 = require("fs/promises");
const copyFiles = async (targetToDestArray) => {
    for await (const item of targetToDestArray) {
        await (0, promises_1.copyFile)(item.from, item.to, fs_1.default.constants.COPYFILE_FICLONE);
    }
};
exports.copyFiles = copyFiles;
