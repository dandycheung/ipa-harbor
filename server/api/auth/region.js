/**
 * 设置用户地区（手动覆盖 Apple ID storefront 默认地区）
 */

const { exec } = require('child_process');
const path = require('path');
const {
    enrichUserData,
    setManualRegion,
} = require('../../utils/userRegion');

const IPATOOL_PATH = path.join(__dirname, '../../bin/ipatool');
const { KEYCHAIN_PASSPHRASE } = require('../../config/keychain');

function getUserInfo() {
    return new Promise((resolve, reject) => {
        const command = `"${IPATOOL_PATH}" auth info --keychain-passphrase "${KEYCHAIN_PASSPHRASE}" --non-interactive --format "json"`;

        exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error('Not authenticated'));
            } else {
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (parseError) {
                    reject(new Error('Failed to parse user info'));
                }
            }
        });
    });
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        let userInfo;
        try {
            userInfo = await getUserInfo();
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        if (!userInfo || !userInfo.email) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const { region } = req.body;

        if (!region) {
            setManualRegion(userInfo.email, null);
            const data = await enrichUserData(userInfo);
            return res.json({
                success: true,
                message: 'Region cleared',
                data
            });
        }

        if (!/^[a-z]{2}$/.test(region)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid region code format'
            });
        }

        setManualRegion(userInfo.email, region);
        const data = await enrichUserData(userInfo);

        return res.json({
            success: true,
            message: 'Region updated successfully',
            data
        });
    } catch (error) {
        console.error('设置用户地区失败:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to set user region'
        });
    }
}

module.exports = handler;
