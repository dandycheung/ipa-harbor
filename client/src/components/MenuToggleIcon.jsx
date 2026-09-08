import { Box } from '@mui/joy';
import { useReducedMotion } from 'motion/react';

const LINE_WIDTH = 18;
const LINE_HEIGHT = 2;
const LINE_GAP = 5;
const LINE_OFFSET = LINE_HEIGHT + LINE_GAP;

export default function MenuToggleIcon({ open }) {
    const reducedMotion = useReducedMotion();
    const duration = reducedMotion ? 0 : 0.2;
    const middleDuration = reducedMotion ? 0 : 0.15;

    const lineBase = {
        display: 'block',
        width: LINE_WIDTH,
        height: LINE_HEIGHT,
        borderRadius: '1px',
        bgcolor: 'currentColor',
        transformOrigin: 'center',
    };

    const outerTransition = reducedMotion
        ? 'none'
        : `transform ${duration}s cubic-bezier(0.4, 0, 0.2, 1)`;

    const middleTransition = reducedMotion
        ? 'none'
        : `transform ${middleDuration}s ease, opacity ${middleDuration}s ease`;

    return (
        <Box
            aria-hidden
            sx={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Box
                component="span"
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${LINE_GAP}px`,
                    width: LINE_WIDTH,
                }}
            >
                <Box
                    component="span"
                    sx={{
                        ...lineBase,
                        transition: outerTransition,
                        transform: open
                            ? `translateY(${LINE_OFFSET}px) rotate(45deg)`
                            : 'none',
                    }}
                />
                <Box
                    component="span"
                    sx={{
                        ...lineBase,
                        transition: middleTransition,
                        opacity: open ? 0 : 1,
                        transform: open ? 'scaleX(0)' : 'none',
                    }}
                />
                <Box
                    component="span"
                    sx={{
                        ...lineBase,
                        transition: outerTransition,
                        transform: open
                            ? `translateY(-${LINE_OFFSET}px) rotate(-45deg)`
                            : 'none',
                    }}
                />
            </Box>
        </Box>
    );
}
