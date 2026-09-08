import { getAppDownloadPackageUrl } from './api';
import {
    buildFileNameFromTemplate,
    buildFileNameContextFromMetadata,
    parseStorageFileName,
} from './filenameTemplate';

/**
 * 从服务端拉取 IPA（存储名始终为 {appId}_{versionId}.ipa），
 * 保存到本地时使用设置页配置的文件名模板。
 */
export async function downloadIpaWithTemplate({
    storageFileName,
    template,
    metadata = {},
}) {
    const { appId, versionId } = parseStorageFileName(storageFileName);
    if (!appId || !versionId) {
        throw new Error('invalid storage file name');
    }

    const context = buildFileNameContextFromMetadata(metadata, appId, versionId);
    context.currentDateTime = new Date().toISOString();
    const displayName = buildFileNameFromTemplate(template, context, { withExtension: true });
    const url = getAppDownloadPackageUrl(appId, versionId);
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
        throw new Error(`download failed: ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = displayName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);

    return displayName;
}

export async function downloadIpaByIds({
    appId,
    versionId,
    template,
    metadata = {},
}) {
    return downloadIpaWithTemplate({
        storageFileName: `${appId}_${versionId}.ipa`,
        template,
        metadata,
    });
}
