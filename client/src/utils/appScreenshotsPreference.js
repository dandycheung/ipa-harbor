import { useCallback, useEffect, useState } from 'react';

export const APP_SCREENSHOTS_STORAGE_KEY = 'loadAppScreenshotsEnabled';
export const APP_SCREENSHOTS_PREFERENCE_EVENT = 'appScreenshotsPreferenceChange';

function parseStoredValue(raw) {
    return raw === '1' || raw === 'true';
}

/** 是否自动加载截图；localStorage 不存在时表示关闭 */
export function isLoadAppScreenshotsEnabled() {
    if (typeof localStorage === 'undefined') {
        return false;
    }

    const stored = localStorage.getItem(APP_SCREENSHOTS_STORAGE_KEY);
    if (stored === null) {
        return false;
    }

    return parseStoredValue(stored);
}

export function setLoadAppScreenshotsEnabled(enabled) {
    if (enabled) {
        localStorage.setItem(APP_SCREENSHOTS_STORAGE_KEY, '1');
    } else {
        localStorage.removeItem(APP_SCREENSHOTS_STORAGE_KEY);
    }

    window.dispatchEvent(new CustomEvent(APP_SCREENSHOTS_PREFERENCE_EVENT, {
        detail: { enabled: Boolean(enabled) },
    }));
}

export function useLoadAppScreenshotsPreference() {
    const [enabled, setEnabledState] = useState(() => isLoadAppScreenshotsEnabled());

    useEffect(() => {
        const handleChange = (event) => {
            setEnabledState(event.detail?.enabled ?? isLoadAppScreenshotsEnabled());
        };

        window.addEventListener(APP_SCREENSHOTS_PREFERENCE_EVENT, handleChange);
        return () => window.removeEventListener(APP_SCREENSHOTS_PREFERENCE_EVENT, handleChange);
    }, []);

    const setEnabled = useCallback((value) => {
        setLoadAppScreenshotsEnabled(value);
        setEnabledState(Boolean(value));
    }, []);

    return [enabled, setEnabled];
}
