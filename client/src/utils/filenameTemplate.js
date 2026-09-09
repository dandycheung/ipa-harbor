import dayjs from 'dayjs';

export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

export const DATE_FORMAT_PRESETS = [
    { value: 'YYYY-MM-DD', label: '2026-09-08', group: 'Numeric' },
    { value: 'YYYYMMDD', label: '20260908', group: 'Numeric' },
    { value: 'YYYY.MM.DD', label: '2026.09.08', group: 'Numeric' },
    { value: 'MM-DD-YYYY', label: '09-08-2026', group: 'Numeric' },
    { value: 'DD-MM-YYYY', label: '08-09-2026', group: 'Numeric' },
    { value: 'MMMM D YYYY', label: 'September 8 2026', group: 'Full month' },
    { value: 'MMMM DD YYYY', label: 'September 08 2026', group: 'Full month' },
    { value: 'D MMMM YYYY', label: '8 September 2026', group: 'Full month' },
    { value: 'DD MMMM YYYY', label: '08 September 2026', group: 'Full month' },
    { value: 'MMM D YYYY', label: 'Sep 8 2026', group: 'Short month' },
    { value: 'MMM DD YYYY', label: 'Sep 08 2026', group: 'Short month' },
    { value: 'D MMM YYYY', label: '8 Sep 2026', group: 'Short month' },
    { value: 'DD MMM YYYY', label: '08 Sep 2026', group: 'Short month' },
    { value: 'MMMM YYYY', label: 'September 2026', group: 'Month / Year' },
    { value: 'MMM YYYY', label: 'Sep 2026', group: 'Month / Year' },
    { value: 'YYYY-MM', label: '2026-09', group: 'Month / Year' },
    { value: 'YYYYMM', label: '202609', group: 'Month / Year' },
    { value: 'YYYY', label: '2026', group: 'Year' },
    { value: 'YYYY-MM-DD_HH-mm-ss', label: '2026-09-08_14-30-25', group: 'Date + Time' },
    { value: 'YYYYMMDD_HHmmss', label: '20260908_143025', group: 'Date + Time' },
    { value: 'YYYY-MM-DD_HH-mm', label: '2026-09-08_14-30', group: 'Date + Time' },
    { value: 'YYYYMMDD_HHmm', label: '20260908_1430', group: 'Date + Time' },
    { value: 'MMM D YYYY_HH-mm-ss', label: 'Sep 8 2026_14-30-25', group: 'Date + Time' },
    { value: 'D MMM YYYY_HH-mm-ss', label: '8 Sep 2026_14-30-25', group: 'Date + Time' },
    { value: 'MMMM D YYYY_HH-mm-ss', label: 'September 8 2026_14-30-25', group: 'Date + Time' },
    { value: 'D MMMM YYYY_HH-mm-ss', label: '8 September 2026_14-30-25', group: 'Date + Time' },
];

export const DATE_VARIABLE_KEYS = ['currentDateTime', 'releaseDateTime'];

export const FILENAME_VARIABLE_KEYS = [
    'bundleId',
    'id',
    'versionId',
    'buildVersion',
    'version',
    'appName',
    ...DATE_VARIABLE_KEYS,
];

/** 固定文本预设，后续可在此扩展 */
export const FILENAME_TEXT_PRESETS = [
    { key: 'underscore', value: '_' },
    { key: 'dash', value: '-' },
    { key: 'space', value: ' ' },
];

export const DEFAULT_DOWNLOAD_FILENAME_TEMPLATE = [
    { type: 'variable', key: 'appName' },
    { type: 'text', value: '_' },
    { type: 'variable', key: 'version' },
    { type: 'text', value: '-' },
    { type: 'variable', key: 'buildVersion' },
];

export const FILENAME_PREVIEW_SAMPLE = {
    bundleId: 'com.uuphy.GeekScan',
    appId: '6766042246',
    id: '6766042246',
    versionId: '887851211',
    bundleVersion: '1',
    bundleShortVersionString: '1.7.0',
    bundleDisplayName: 'GeekScan',
    appName: 'GeekScan',
    releaseDateTime: '2026-09-01T08:00:00.000Z',
    currentDateTime: '2026-09-08T14:30:25',
};

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

export function isDateVariableKey(key) {
    return DATE_VARIABLE_KEYS.includes(key);
}

export function isValidDateFormat(format) {
    return DATE_FORMAT_PRESETS.some((preset) => preset.value === format);
}

export function getValidDateFormat(format) {
    return isValidDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
}

export function getDateFormatPreset(format) {
    return DATE_FORMAT_PRESETS.find((preset) => preset.value === getValidDateFormat(format)) ?? null;
}

export function getSegmentFormat(segment) {
    if (!segment || segment.type !== 'variable') {
        return undefined;
    }

    if (isDateVariableKey(segment.key)) {
        return getValidDateFormat(segment.options?.format ?? segment.format);
    }

    return segment.options?.format ?? segment.format;
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

export function resolveVariable(key, format, context = {}) {
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

export function countVariableSegments(segments) {
    if (!Array.isArray(segments)) {
        return 0;
    }

    return segments.filter((segment) => segment?.type === 'variable').length;
}

export function templateHasVariable(template) {
    if (!Array.isArray(template)) {
        return false;
    }

    return template.filter(isValidSegment).some((segment) => segment.type === 'variable');
}

export function isValidSegment(segment) {
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

export function normalizeTemplate(template) {
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

export function buildFileNameFromTemplate(template, context = {}, { withExtension = false } = {}) {
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

export function cloneTemplate(template) {
    return normalizeTemplate(template).map((segment) => {
        if (segment.type === 'variable' && segment.options) {
            return {
                ...segment,
                options: { ...segment.options },
            };
        }

        return { ...segment };
    });
}

export function moveTemplateSegment(template, fromIndex, toIndex) {
    const next = cloneTemplate(template);
    if (fromIndex < 0 || fromIndex >= next.length || toIndex < 0 || toIndex >= next.length) {
        return next;
    }

    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
}

export function createVariableSegment(key) {
    const normalizedKey = normalizeVariableKey(key);

    if (isDateVariableKey(normalizedKey)) {
        return {
            type: 'variable',
            key: normalizedKey,
            options: { format: DEFAULT_DATE_FORMAT },
        };
    }

    return { type: 'variable', key: normalizedKey };
}

export function createTextSegment(value) {
    return { type: 'text', value: value ?? '' };
}

export function paletteVariableId(key) {
    return `palette-var-${key}`;
}

export function isPaletteVariableId(id) {
    return String(id).startsWith('palette-var-');
}

export function getVariableKeyFromPaletteId(paletteId) {
    if (!isPaletteVariableId(paletteId)) {
        return null;
    }

    return String(paletteId).slice('palette-var-'.length);
}

export function paletteTextId(presetKey) {
    return `palette-text-${presetKey}`;
}

export function isPaletteTextId(id) {
    return String(id).startsWith('palette-text-');
}

export function getTextPresetByKey(presetKey) {
    return FILENAME_TEXT_PRESETS.find((preset) => preset.key === presetKey) ?? null;
}

export function getTextPresetByValue(value) {
    return FILENAME_TEXT_PRESETS.find((preset) => preset.value === value) ?? null;
}

export function getTextPresetKeyFromPaletteId(paletteId) {
    if (!isPaletteTextId(paletteId)) {
        return null;
    }

    return String(paletteId).slice('palette-text-'.length);
}

export function getVariableLabelKey(key) {
    return `ui.filenameVar_${normalizeVariableKey(key)}`;
}

export function getTextPresetLabelKey(presetKey) {
    return `ui.filenameText_${presetKey}`;
}

export function parseStorageFileName(fileName) {
    const match = String(fileName || '').match(/^(\d+)_(.+)\.ipa$/);
    if (!match) {
        return { appId: null, versionId: null };
    }

    return { appId: match[1], versionId: match[2] };
}

export function buildFileNameContextFromMetadata(metadata = {}, appId, versionId) {
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
        releaseDateTime: metadata.appleVersionMetadata?.releaseDate || '',
    };
}
