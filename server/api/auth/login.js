const { exec } = require('child_process');
const path = require('path');
const { enrichUserData } = require('../../utils/userRegion');
const { parseIpatoolOutput } = require('../../utils/ipatoolOutput');
const { clearIpatoolAccountCache } = require('../../utils/ipatoolAccount');

const IPATOOL_PATH = path.join(__dirname, '../../bin/ipatool');
const { KEYCHAIN_PASSPHRASE } = require('../../config/keychain');

/** 首次登录可能较慢（SAP 初始化），适当延长超时 */
const LOGIN_TIMEOUT_MS = 600000;
const INFO_TIMEOUT_MS = 60000;

const IPATOOL_EXEC_ENV = {
    ...process.env,
    // Linux Docker 无 GUI keyring 时避免 dbus 阻塞
    DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS || 'unix:path=/nonexistent',
};

/**
 * 执行 ipatool 命令并解析 JSON 输出
 * @param {string} command - 要执行的命令
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @returns {Promise} 返回Promise对象
 */
function executeIpatool(command, timeoutMs = INFO_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        exec(command, { timeout: timeoutMs, env: IPATOOL_EXEC_ENV }, (error, stdout, stderr) => {
            const parsed = parseIpatoolOutput(stdout, stderr);

            if (parsed.needsTwoFactor) {
                resolve({
                    success: false,
                    needsTwoFactor: true,
                    message: parsed.message || '需要二次验证码',
                    rawOutput: parsed.rawOutput,
                });
                return;
            }

            if (parsed.success && parsed.data) {
                resolve({
                    success: true,
                    data: parsed.data,
                });
                return;
            }

            if (error || !parsed.success) {
                reject({
                    success: false,
                    error: parsed.error || error?.message || '执行命令失败',
                    stderr,
                    stdout,
                    rawOutput: parsed.rawOutput,
                });
                return;
            }

            reject({
                success: false,
                error: '未能解析 ipatool 响应',
                stderr,
                stdout,
            });
        });
    });
}

/**
 * 登录
 */
async function loginHandler(req, res) {
    try {
        const { email, password, twoFactor } = req.body;

        // 参数验证
        if (!email || !password) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '邮箱和密码是必需的参数'
            });
        }

        // 构建ipatool命令
        let command = `"${IPATOOL_PATH}" auth login -e "${email}" -p "${password}" --keychain-passphrase "${KEYCHAIN_PASSPHRASE}" --non-interactive --format "json"`;

        // 如果提供了二次验证码，添加到命令中
        if (twoFactor) {
            command += ` --auth-code "${twoFactor}"`;
        }

        console.log(`执行登录命令: ${command.replace(password, '***').replace(twoFactor || '', '***')}`);

        try {
            const result = await executeIpatool(command, LOGIN_TIMEOUT_MS);

            if (result.needsTwoFactor) {
                return res.status(200).json({
                    success: false,
                    needsTwoFactor: true,
                    message: '请求错误 / 请输入二次验证码'
                });
            }

            if (!result.success || !result.data?.email) {
                return res.status(401).json({
                    success: false,
                    message: '登录失败',
                    error: result.error || '未能获取账号信息'
                });
            }

            clearIpatoolAccountCache();

            const infoCommand = `"${IPATOOL_PATH}" auth info --keychain-passphrase "${KEYCHAIN_PASSPHRASE}" --non-interactive --format "json"`;

            try {
                const infoResult = await executeIpatool(infoCommand, INFO_TIMEOUT_MS);

                if (infoResult.success && infoResult.data?.email) {
                    const userData = await enrichUserData(infoResult.data);
                    return res.json({
                        success: true,
                        message: '登录成功',
                        data: userData
                    });
                }
            } catch (infoError) {
                console.error('登录后获取用户信息失败:', infoError?.error || infoError?.message);
            }

            // ipatool 已登录但 info 暂时不可用，使用 login 输出中的账号信息
            const userData = await enrichUserData(result.data);
            if (userData.email) {
                return res.json({
                    success: true,
                    message: '登录成功',
                    data: userData
                });
            }

            return res.status(401).json({
                success: false,
                message: '登录失败，未能获取用户信息'
            });
        } catch (execError) {
            console.error(
                '执行ipatool命令时出错:',
                execError?.stderr || execError?.stdout || execError?.error
            );

            const combinedOutput = `${execError.stdout || ''}\n${execError.stderr || ''}`;
            if (combinedOutput.includes('Could not allocate dynamic translator buffer')) {
                return res.status(500).json({
                    success: false,
                    message: '服务器内存不足，无法完成 Apple ID 首次认证。请为宿主机增加内存或配置至少 2GB swap 后重试',
                    error: execError.error || 'ipatool 认证引擎初始化失败',
                });
            }
            if (combinedOutput.includes('2FA code is required')) {
                return res.status(200).json({
                    success: false,
                    needsTwoFactor: true,
                    message: '请求错误 / 请输入二次验证码'
                });
            }

            return res.status(500).json({
                success: false,
                message: execError?.error || execError?.stdout || 'APPLE ID 登录过程中发生错误',
                error: execError.error || '执行命令失败'
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

module.exports = loginHandler;
