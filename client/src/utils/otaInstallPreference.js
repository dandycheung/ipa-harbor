import { useCallback, useEffect, useState } from 'react';

export const OTA_INSTALL_STORAGE_KEY = 'otaInstallEnabled';
export const OTA_INSTALL_PREFERENCE_EVENT = 'otaInstallPreferenceChange';

/** 是否为 iPhone / iPad / iPod（含 iPadOS 桌面模式） */
export function isAppleMobileDevice() {
    if (typeof navigator === 'undefined') {
        return false;
    }

    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
        return true;
    }

    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/** 是否为 macOS（不含 iOS/iPadOS） */
export function isMacOS() {
    if (typeof navigator === 'undefined') {
        return false;
    }

    const ua = navigator.userAgent || '';
    return /Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
}

/** 是否支持 OTA 安装的 Apple 设备（iOS / iPadOS / macOS） */
export function isAppleOtaCapableDevice() {
    return isAppleMobileDevice() || isMacOS();
}

export function getDefaultOtaInstallEnabled() {
    return isAppleOtaCapableDevice();
}

function parseStoredValue(raw) {
    return raw === '1' || raw === 'true';
}

/** 读取 OTA 安装开关；未设置时按 Apple 设备写入默认值 */
export function isOtaInstallEnabled() {
    if (typeof localStorage === 'undefined') {
        return getDefaultOtaInstallEnabled();
    }

    const stored = localStorage.getItem(OTA_INSTALL_STORAGE_KEY);
    if (stored === null) {
        const defaultValue = getDefaultOtaInstallEnabled();
        localStorage.setItem(OTA_INSTALL_STORAGE_KEY, defaultValue ? '1' : '0');
        return defaultValue;
    }

    return parseStoredValue(stored);
}

export function setOtaInstallEnabled(enabled) {
    localStorage.setItem(OTA_INSTALL_STORAGE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new CustomEvent(OTA_INSTALL_PREFERENCE_EVENT, {
        detail: { enabled: Boolean(enabled) },
    }));
}

export function useOtaInstallPreference() {
    const [enabled, setEnabledState] = useState(() => isOtaInstallEnabled());

    useEffect(() => {
        const handleChange = (event) => {
            setEnabledState(event.detail?.enabled ?? isOtaInstallEnabled());
        };

        window.addEventListener(OTA_INSTALL_PREFERENCE_EVENT, handleChange);
        return () => window.removeEventListener(OTA_INSTALL_PREFERENCE_EVENT, handleChange);
    }, []);

    const setEnabled = useCallback((value) => {
        setOtaInstallEnabled(value);
        setEnabledState(Boolean(value));
    }, []);

    return [enabled, setEnabled];
}
