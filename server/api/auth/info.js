const { exec } = require('child_process');
const path = require('path');
const { enrichUserData } = require('../../utils/userRegion');
const { parseIpatoolOutput } = require('../../utils/ipatoolOutput');

const IPATOOL_PATH = path.join(__dirname, '../../bin/ipatool');
const { KEYCHAIN_PASSPHRASE } = require('../../config/keychain');

function executeIpatool(command) {
    return new Promise((resolve, reject) => {
        exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
            const parsed = parseIpatoolOutput(stdout, stderr);

            if (parsed.success && parsed.data?.email) {
                resolve({
                    success: true,
                    data: parsed.data,
                });
                return;
            }

            reject({
                success: false,
                error: parsed.error || error?.message || '执行命令失败',
                stderr,
                stdout,
                rawOutput: parsed.rawOutput,
            });
        });
    });
}

function isNotLoggedInError(execError) {
    const combined = `${execError.stdout || ''}\n${execError.stderr || ''}\n${execError.error || ''}\n${execError.rawOutput || ''}`;
    return (
        combined.includes('not logged in') ||
        combined.includes('未登录') ||
        combined.includes('The specified item could not be found in the keyring') ||
        combined.includes('failed to get account')
    );
}

async function infoHandler(req, res) {
    try {
        const command = `"${IPATOOL_PATH}" auth info --keychain-passphrase "${KEYCHAIN_PASSPHRASE}" --non-interactive --format "json"`;

        try {
            const result = await executeIpatool(command);

            if (result.success && result.data?.email) {
                const userData = await enrichUserData(result.data);

                return res.json({
                    success: true,
                    message: '获取认证信息成功',
                    data: userData
                });
            }

            return res.status(401).json({
                success: false,
                message: '用户未登录或认证信息已过期',
                error: '请先登录'
            });
        } catch (execError) {
            if (isNotLoggedInError(execError)) {
                return res.status(401).json({
                    success: false,
                    message: '用户未登录或认证信息已过期',
                    error: '请先登录'
                });
            }

            return res.status(500).json({
                success: false,
                message: '获取认证信息时发生错误',
                error: execError.error || execError.message || '执行命令失败'
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
}

module.exports = infoHandler;
