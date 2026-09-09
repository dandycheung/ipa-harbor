const { writeAppSettings, mergeSettings } = require('../../utils/appSettings');
const { templateHasVariable } = require('../../utils/filenameTemplate');

/**
 * 更新应用设置（下载文件名模板持久化）
 */
async function updateSettingsHandler(req, res) {
    try {
        const { downloadFileNameTemplate, showVersionMetadataRefresh } = req.body || {};

        if (downloadFileNameTemplate !== undefined && !templateHasVariable(downloadFileNameTemplate)) {
            return res.status(400).json({
                success: false,
                message: '文件名至少保留一个变量',
            });
        }

        if (showVersionMetadataRefresh !== undefined && typeof showVersionMetadataRefresh !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'showVersionMetadataRefresh 必须是布尔值',
            });
        }

        const nextSettings = mergeSettings({
            ...(downloadFileNameTemplate !== undefined ? { downloadFileNameTemplate } : {}),
            ...(showVersionMetadataRefresh !== undefined ? { showVersionMetadataRefresh } : {}),
        });

        const saved = await writeAppSettings(req.user.id, nextSettings);

        return res.json({
            success: true,
            message: '设置已保存',
            data: {
                settings: saved,
            },
        });
    } catch (error) {
        console.error('保存应用设置失败:', error);
        return res.status(500).json({
            success: false,
            message: '保存设置失败',
            error: error.message,
        });
    }
}

module.exports = updateSettingsHandler;
