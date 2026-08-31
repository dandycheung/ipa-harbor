/**
 * 从 IPA 文件名（appId_versionId.ipa）提取 App Store 应用 ID
 */
function extractAppIdFromFileName(fileName) {
    if (!fileName) {
        return null;
    }

    const match = String(fileName).match(/^(\d+)_/);
    return match ? match[1] : null;
}

/**
 * 解析 metadata 中的 itemId；优先使用文件名中的完整 ID
 */
function resolveItemId(metadata, fileName) {
    const appIdFromFileName = extractAppIdFromFileName(fileName);
    if (appIdFromFileName) {
        return appIdFromFileName;
    }

    const itemId = metadata?.itemId;
    if (itemId == null || itemId === '') {
        return null;
    }

    const numericItemId = Number(itemId);
    if (Number.isFinite(numericItemId) && numericItemId < 0) {
        return String(numericItemId >>> 0);
    }

    return String(itemId);
}

module.exports = {
    extractAppIdFromFileName,
    resolveItemId,
};
