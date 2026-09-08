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

module.exports = {
    DEFAULT_DOWNLOAD_FILENAME_TEMPLATE,
    normalizeTemplate,
    templateHasVariable,
};
