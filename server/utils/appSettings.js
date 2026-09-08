const database = require('./database');
const {
    DEFAULT_DOWNLOAD_FILENAME_TEMPLATE,
    normalizeTemplate,
} = require('./filenameTemplate');

const DEFAULT_SETTINGS = {
    downloadFileNameTemplate: DEFAULT_DOWNLOAD_FILENAME_TEMPLATE,
};

function mergeSettings(raw = {}) {
    return {
        downloadFileNameTemplate: normalizeTemplate(
            raw.downloadFileNameTemplate || DEFAULT_SETTINGS.downloadFileNameTemplate
        ),
    };
}

async function readAppSettings(userId) {
    try {
        if (userId == null) {
            return mergeSettings();
        }

        const raw = await database.getUserSettings(userId);
        return mergeSettings(raw || {});
    } catch (error) {
        console.error('读取用户设置失败，使用默认值:', error.message);
        return mergeSettings();
    }
}

async function writeAppSettings(userId, nextSettings) {
    if (userId == null) {
        throw new Error('未指定用户');
    }

    const current = await database.getUserSettings(userId);
    const merged = mergeSettings({
        ...(current || {}),
        ...nextSettings,
    });

    await database.setUserSettings(userId, merged);
    return merged;
}

module.exports = {
    DEFAULT_SETTINGS,
    readAppSettings,
    writeAppSettings,
    mergeSettings,
};
