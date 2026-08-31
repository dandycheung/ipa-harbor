const { exec } = require('child_process');
const path = require('path');

const IPATOOL_PATH = path.join(__dirname, '../../bin/ipatool');
const { KEYCHAIN_PASSPHRASE } = require('../../config/keychain');

function executeIpatool(command) {
    return new Promise((resolve, reject) => {
        exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
            if (error) {
                reject({
                    success: false,
                    error: error.message,
                    stderr: stderr,
                    stdout: stdout
                });
            } else {
                try {
                    const result = JSON.parse(stdout);
                    resolve({
                        success: true,
                        data: result
                    });
                } catch (parseError) {
                    resolve({
                        success: true,
                        rawOutput: stdout
                    });
                }
            }
        });
    });
}

/**
 * 获取已购项目列表
 */
async function listPurchasesHandler(req, res) {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const maxResults = Math.min(Math.max(parseInt(req.query.maxResults, 10) || 50, 1), 100);

        const command = `"${IPATOOL_PATH}" list-purchases --page ${page} --max-results ${maxResults} --keychain-passphrase "${KEYCHAIN_PASSPHRASE}" --non-interactive --format "json"`;

        try {
            const result = await executeIpatool(command);

            if (result.success) {
                const data = result.data || {};
                return res.json({
                    success: true,
                    message: '获取已购项目成功',
                    data: {
                        apps: data.apps || [],
                        count: data.count ?? (data.apps?.length || 0),
                        totalCount: data.totalCount ?? (data.apps?.length || 0),
                        page: data.page ?? page
                    }
                });
            }

            return res.status(500).json({
                success: false,
                message: '获取已购项目失败',
                error: result.error
            });
        } catch (execError) {
            if (execError.stdout && execError.stdout.includes('failed to get account')) {
                return res.status(401).json({
                    success: false,
                    message: '用户未登录或认证信息已过期',
                    error: '请先登录'
                });
            }

            if (execError.stderr && execError.stderr.includes('unknown command')) {
                return res.status(500).json({
                    success: false,
                    message: '当前 ipatool 不支持 list-purchases。该命令在 v2.4.0 之后才加入，请在本机执行 ./build_ipatool.sh 从源码编译，或等待官方新版本发布',
                    error: execError.stderr.trim() || execError.message
                });
            }

            return res.status(500).json({
                success: false,
                message: '获取已购项目时发生错误',
                error: execError.stderr?.trim() || execError.stdout?.trim() || execError.message || '执行命令失败'
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

module.exports = listPurchasesHandler;
