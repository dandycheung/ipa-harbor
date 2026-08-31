import { useEffect, useState } from 'react';

const BELOW_SM_QUERY = '(max-width: 599.95px)';

export default function useBelowSm() {
    const [belowSm, setBelowSm] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia(BELOW_SM_QUERY).matches : false
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia(BELOW_SM_QUERY);
        const handleChange = (event) => setBelowSm(event.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return belowSm;
}
