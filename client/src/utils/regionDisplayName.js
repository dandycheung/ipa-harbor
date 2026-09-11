const displayNamesCache = new Map();

function resolveIntlLocale(language) {
    const code = (language || 'en').split('-')[0];
    return code === 'zh' ? 'zh-CN' : 'en';
}

/**
 * 按当前语言返回 App Store 地区显示名（ISO 3166-1 alpha-2）
 */
export function getRegionDisplayName(code, language, fallbackName = '') {
    if (!code) {
        return fallbackName || '';
    }

    const locale = resolveIntlLocale(language);
    if (!displayNamesCache.has(locale)) {
        try {
            displayNamesCache.set(locale, new Intl.DisplayNames([locale], { type: 'region' }));
        } catch {
            displayNamesCache.set(locale, null);
        }
    }

    const displayNames = displayNamesCache.get(locale);
    const upperCode = code.toUpperCase();
    return displayNames?.of(upperCode) || fallbackName || upperCode;
}

const languageDefaultRegion = {
    zh: 'cn',
    en: 'us',
    ja: 'jp',
    ko: 'kr',
    fr: 'fr',
    de: 'de',
    es: 'es',
    pt: 'pt',
    it: 'it',
    ru: 'ru',
    ar: 'sa',
    hi: 'in',
};

/**
 * 从浏览器语言推断 App Store 地区代码
 */
export function getBrowserRegionCode(availableCodes) {
    if (typeof navigator === 'undefined') {
        return null;
    }

    const locale = navigator.language || '';
    const [lang, region] = locale.split('-');
    const regionCode = region?.toLowerCase();

    if (regionCode && availableCodes.has(regionCode)) {
        return regionCode;
    }

    const langCode = lang?.toLowerCase();
    const fallbackCode = languageDefaultRegion[langCode];
    if (fallbackCode && availableCodes.has(fallbackCode)) {
        return fallbackCode;
    }

    return null;
}

/**
 * 打开地区选择器时的滚动目标：当前地区 -> 浏览器语言地区 -> 不滚动
 */
export function resolveRegionScrollTarget(currentRegion, storeRegion, availableCodes) {
    const currentCode = currentRegion || storeRegion;
    if (currentCode && availableCodes.has(currentCode)) {
        return currentCode;
    }

    return getBrowserRegionCode(availableCodes);
}
