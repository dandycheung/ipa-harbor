/**
 * 规范化 IPA sidecar 元数据：plist 中的 releaseDate 表示应用首发日，不是该 build 发布时间
 */
function normalizePlistMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
        return metadata;
    }

    const next = { ...metadata };

    if (Object.prototype.hasOwnProperty.call(next, 'releaseDate')) {
        if (next.firstReleaseDate == null) {
            next.firstReleaseDate = next.releaseDate;
        }
        delete next.releaseDate;
    }

    return next;
}

function normalizeStoredMetadata(metadata) {
    return normalizePlistMetadata(metadata);
}

function resolveExternalVersionId(task, fileName) {
    if (task?.actualVersionId && task.actualVersionId !== 'latest') {
        return String(task.actualVersionId);
    }

    if (task?.versionId && task.versionId !== 'latest') {
        return String(task.versionId);
    }

    const match = String(fileName || '').match(/^(\d+)_(.+)\.ipa$/);
    return match ? match[2] : null;
}

module.exports = {
    normalizePlistMetadata,
    normalizeStoredMetadata,
    resolveExternalVersionId,
};
