const { refreshVersionMetadata } = require('../../utils/versionMetadata');

/**
 * 手动拉取并缓存单个版本的 Apple 元数据
 */
async function versionMetadataHandler(req, res) {
    try {
        const { appId, versionId } = req.params;

        if (!appId || !versionId) {
            return res.status(400).json({
                success: false,
                message: 'App ID 和 Version ID 是必需的参数',
            });
        }

        const result = await refreshVersionMetadata(appId, versionId, { updateSidecar: true });

        return res.json({
            success: true,
            message: '版本元数据获取成功',
            data: {
                versionId: result.versionId,
                bundleVersion: result.bundleVersion,
                releaseDate: result.releaseDate,
            },
        });
    } catch (error) {
        console.error('获取版本元数据失败:', error);

        if (error.errorType === 'TOKEN_EXPIRED') {
            return res.status(401).json({
                success: false,
                message: error.message,
                errorType: 'TOKEN_EXPIRED',
            });
        }

        if (error.errorType === 'RATE_LIMITED') {
            return res.status(429).json({
                success: false,
                message: error.message,
                errorType: 'RATE_LIMITED',
            });
        }

        return res.status(500).json({
            success: false,
            message: '获取版本元数据失败',
            error: error.message,
        });
    }
}

module.exports = versionMetadataHandler;
