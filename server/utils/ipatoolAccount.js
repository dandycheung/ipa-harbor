const { execFile } = require('child_process');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const { KEYCHAIN_PASSPHRASE } = require('../config/keychain');

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = 'ipatool-auth.service';
const ACCOUNT_KEY = 'account';
const CACHE_TTL_MS = 60 * 1000;

let accountCache = {
    data: null,
    expiresAt: 0,
};

function parseAccountPayload(payload) {
    if (!payload) {
        return null;
    }

    if (typeof payload === 'string') {
        return JSON.parse(payload);
    }

    if (Buffer.isBuffer(payload)) {
        return JSON.parse(payload.toString('utf8'));
    }

    return payload;
}

function normalizeKeyringItem(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    if (raw.email || raw.storeFront || raw.storefront) {
        return raw;
    }

    if (raw.Data !== undefined) {
        const data = raw.Data;
        if (typeof data === 'string') {
            return parseAccountPayload(Buffer.from(data, 'base64').toString('utf8'));
        }
        if (Buffer.isBuffer(data)) {
            return parseAccountPayload(data.toString('utf8'));
        }
        if (typeof data === 'object') {
            return normalizeKeyringItem(data);
        }
    }

    return null;
}

async function readAccountFromMacKeychain() {
    const { stdout } = await execFileAsync('security', [
        'find-generic-password',
        '-s', KEYCHAIN_SERVICE,
        '-a', ACCOUNT_KEY,
        '-w',
    ]);

    return normalizeKeyringItem(JSON.parse(stdout.trim()));
}

async function readAccountFromFileKeychain() {
    const accountPath = path.join(os.homedir(), '.ipatool', ACCOUNT_KEY);

    let encrypted;
    try {
        encrypted = await fs.readFile(accountPath, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }

    if (!KEYCHAIN_PASSPHRASE) {
        return null;
    }

    let compactDecrypt;
    try {
        ({ compactDecrypt } = require('jose'));
    } catch (error) {
        console.warn('读取 Linux keychain 需要 jose 依赖，请在 server 目录执行 npm install');
        return null;
    }

    const { plaintext } = await compactDecrypt(
        encrypted.trim(),
        new TextEncoder().encode(KEYCHAIN_PASSPHRASE)
    );
    const item = JSON.parse(new TextDecoder().decode(plaintext));

    return normalizeKeyringItem(item);
}

async function readIpatoolAccount() {
    if (process.platform === 'darwin') {
        try {
            return await readAccountFromMacKeychain();
        } catch (error) {
            return null;
        }
    }

    try {
        return await readAccountFromFileKeychain();
    } catch (error) {
        return null;
    }
}

async function getIpatoolAccount() {
    if (accountCache.data && Date.now() < accountCache.expiresAt) {
        return accountCache.data;
    }

    const account = await readIpatoolAccount();
    accountCache = {
        data: account,
        expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return account;
}

function clearIpatoolAccountCache() {
    accountCache = {
        data: null,
        expiresAt: 0,
    };
}

module.exports = {
    getIpatoolAccount,
    clearIpatoolAccountCache,
};
