const dayjs = require('dayjs');
const fs = require('fs');
const path = require('path');

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

const ALLOWED_DATE_FORMATS = [
    'YYYY-MM-DD',
    'YYYYMMDD',
    'YYYY.MM.DD',
    'MM-DD-YYYY',
    'DD-MM-YYYY',
    'MMMM D YYYY',
    'MMMM DD YYYY',
    'D MMMM YYYY',
    'DD MMMM YYYY',
    'MMM D YYYY',
    'MMM DD YYYY',
    'D MMM YYYY',
    'DD MMM YYYY',
    'MMMM YYYY',
    'MMM YYYY',
    'YYYY-MM',
    'YYYYMM',
    'YYYY',
    'YYYY-MM-DD_HH-mm-ss',
    'YYYYMMDD_HHmmss',
    'YYYY-MM-DD_HH-mm',
    'YYYYMMDD_HHmm',
    'MMM D YYYY_HH-mm-ss',
    'D MMM YYYY_HH-mm-ss',
    'MMMM D YYYY_HH-mm-ss',
    'D MMMM YYYY_HH-mm-ss',
];

const DATE_VARIABLE_KEYS = ['currentDateTime', 'releaseDateTime'];

const FILENAME_VARIABLE_KEYS = [
    'bundleId',
    'id',
    'versionId',
    'buildVersion',
    'version',
    'appName',
    ...DATE_VARIABLE_KEYS,
];

const DEFAULT_DOWNLOAD_FILENAME_TEMPLATE = [
    { type: 'variable', key: 'appName' },
    { type: 'text', value: '_' },
    { type: 'variable', key: 'version' },
    { type: 'text', value: '-' },
    { type: 'variable', key: 'buildVersion' },
];

function isDateVariableKey(key) {
    return DATE_VARIABLE_KEYS.includes(key);
}

function isValidDateFormat(format) {
    return ALLOWED_DATE_FORMATS.includes(format);
}

function getValidDateFormat(format) {
    return isValidDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
}

function normalizeVariableKey(key) {
    if (key === 'date') {
        return 'currentDateTime';
    }

    if (key === 'releaseDate') {
        return 'releaseDateTime';
    }

    return key;
}

function normalizeVariableSegment(segment) {
    const key = normalizeVariableKey(segment.key);
    const next = { type: 'variable', key };

    if (isDateVariableKey(key)) {
        next.options = {
            format: getValidDateFormat(segment.options?.format ?? segment.format),
        };
    }

    return next;
}

function countVariableSegments(segments) {
    if (!Array.isArray(segments)) {
        return 0;
    }

    return segments.filter((segment) => segment?.type === 'variable').length;
}

function isValidSegment(segment) {
    if (!segment || typeof segment !== 'object') {
        return false;
    }

    if (segment.type === 'text') {
        return typeof segment.value === 'string';
    }

    if (segment.type === 'variable') {
        const key = normalizeVariableKey(segment.key);
        if (!FILENAME_VARIABLE_KEYS.includes(key)) {
            return false;
        }

        if (isDateVariableKey(key)) {
            const format = segment.options?.format ?? segment.format;
            return format == null || isValidDateFormat(format);
        }

        return true;
    }

    return false;
}

function normalizeTemplate(template) {
    if (!Array.isArray(template)) {
        return [...DEFAULT_DOWNLOAD_FILENAME_TEMPLATE];
    }

    const normalized = template.filter(isValidSegment).map((segment) => {
        if (segment.type === 'text') {
            return { type: 'text', value: segment.value };
        }

        return normalizeVariableSegment(segment);
    });

    if (normalized.length === 0 || countVariableSegments(normalized) === 0) {
        return [...DEFAULT_DOWNLOAD_FILENAME_TEMPLATE];
    }

    return normalized;
}

function templateHasVariable(template) {
    if (!Array.isArray(template)) {
        return false;
    }

    return template.filter(isValidSegment).some((segment) => segment.type === 'variable');
}

function sanitizeFileNamePart(value) {
    if (value == null || value === '') {
        return '';
    }

    return String(value)
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 固定文本片段：保留空格等字面量，不做 trim */
function sanitizeLiteralText(value) {
    if (value == null || value === '') {
        return '';
    }

    return String(value).replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
}

function getSegmentFormat(segment) {
    if (!segment || segment.type !== 'variable') {
        return undefined;
    }

    if (isDateVariableKey(segment.key)) {
        return getValidDateFormat(segment.options?.format ?? segment.format);
    }

    return segment.options?.format ?? segment.format;
}

function resolveVariable(key, format, context = {}) {
    const normalizedKey = normalizeVariableKey(key);
    const dateFormat = getValidDateFormat(format);

    switch (normalizedKey) {
        case 'bundleId':
            return context.bundleId || context.softwareVersionBundleId || '';
        case 'id':
            return context.appId || context.id || context.itemId || '';
        case 'versionId':
            return context.versionId || context.softwareVersionExternalIdentifier || '';
        case 'buildVersion':
            return context.bundleVersion || '';
        case 'version':
            return context.bundleShortVersionString || '';
        case 'appName':
            return context.bundleDisplayName || context.appName || '';
        case 'currentDateTime':
            return dayjs(context.currentDateTime || undefined).format(dateFormat);
        case 'releaseDateTime':
            return context.releaseDateTime
                ? dayjs(context.releaseDateTime).format(dateFormat)
                : '';
        default:
            return context[key] != null ? String(context[key]) : '';
    }
}

function buildFileNameFromTemplate(template, context = {}, { withExtension = false } = {}) {
    const segments = normalizeTemplate(template);
    const body = segments
        .map((segment) => {
            if (segment.type === 'text') {
                return sanitizeLiteralText(segment.value);
            }

            return sanitizeFileNamePart(
                resolveVariable(segment.key, getSegmentFormat(segment), context)
            );
        })
        .join('');

    const fallback = `${context.appId || context.id || 'app'}_${context.versionId || 'latest'}`;
    const meaningfulBody = body.replace(/[_\-\s.]+/g, '');
    let fileName = meaningfulBody ? body : fallback;
    fileName = fileName.replace(/[<>:"/\\|?*]+/g, '');

    if (!fileName.trim()) {
        fileName = fallback;
    }

    return withExtension ? `${fileName}.ipa` : fileName;
}

function parseStorageFileName(fileName) {
    const match = String(fileName || '').match(/^(\d+)_(.+)\.ipa$/);
    if (!match) {
        return { appId: null, versionId: null };
    }

    return { appId: match[1], versionId: match[2] };
}

function buildFileNameContextFromMetadata(metadata = {}, appId, versionId) {
    return {
        appId,
        id: metadata.itemId || appId,
        itemId: metadata.itemId || appId,
        versionId: metadata.softwareVersionExternalIdentifier || versionId,
        bundleId: metadata.softwareVersionBundleId,
        bundleVersion: metadata.bundleVersion,
        bundleShortVersionString: metadata.bundleShortVersionString,
        bundleDisplayName: metadata.bundleDisplayName,
        appName: metadata.bundleDisplayName,
        releaseDateTime: metadata.releaseDate,
        currentDateTime: new Date().toISOString(),
    };
}

function buildContentDisposition(fileName) {
    const safeName = fileName || 'download.ipa';
    const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, '_') || 'download.ipa';
    const encoded = encodeURIComponent(safeName);
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

async function resolveDownloadFileName(storageFileName, userId) {
    const { appId, versionId } = parseStorageFileName(storageFileName);
    if (!appId || !versionId) {
        throw new Error('invalid storage file name');
    }

    const jsonPath = path.join(__dirname, '../data', storageFileName.replace(/\.ipa$/, '.json'));
    let metadata = {};

    if (fs.existsSync(jsonPath)) {
        try {
            metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch (error) {
            console.warn('读取 IPA 元数据失败，使用默认文件名:', error.message);
        }
    }

    const { readAppSettings } = require('./appSettings');
    const settings = await readAppSettings(userId);
    const context = buildFileNameContextFromMetadata(metadata, appId, versionId);

    return buildFileNameFromTemplate(
        settings.downloadFileNameTemplate,
        context,
        { withExtension: true }
    );
}

module.exports = {
    DEFAULT_DOWNLOAD_FILENAME_TEMPLATE,
    normalizeTemplate,
    templateHasVariable,
    buildContentDisposition,
    resolveDownloadFileName,
};
