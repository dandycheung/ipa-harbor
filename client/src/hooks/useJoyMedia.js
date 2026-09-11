import { useEffect, useState } from 'react';
import { useTheme } from '@mui/joy/styles';

function normalizeMediaQuery(query) {
    return String(query).replace(/^@media\s*/, '');
}

function useMediaQuery(query) {
    const normalizedQuery = normalizeMediaQuery(query);

    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') {
            return false;
        }
        return window.matchMedia(normalizedQuery).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(normalizedQuery);
        const handleChange = (event) => setMatches(event.matches);

        setMatches(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [normalizedQuery]);

    return matches;
}

/** Joy 断点：down('md')、up('sm') 等 */
export function useJoyDown(breakpoint) {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.down(breakpoint));
}

export function useJoyUp(breakpoint) {
    const theme = useTheme();
    return useMediaQuery(theme.breakpoints.up(breakpoint));
}

/** A2HS / iOS standalone */
export function useStandaloneDisplay() {
    const displayMode = useMediaQuery('(display-mode: standalone)');
    const iosStandalone = typeof navigator !== 'undefined' && navigator.standalone === true;
    return displayMode || iosStandalone;
}

/** Dialog / Drawer：< md 或 standalone 时用全屏布局 */
export function useFullscreenDialog() {
    const belowMd = useJoyDown('md');
    const standalone = useStandaloneDisplay();
    return belowMd || standalone;
}
