import { Box } from '@mui/joy';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocation, useOutlet } from 'react-router-dom';

const EASE_OUT = [0.22, 1, 0.36, 1];

export default function PageTransition() {
    const location = useLocation();
    const outlet = useOutlet();
    const prefersReducedMotion = useReducedMotion();

    return (
        <Box
            sx={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                width: '100%',
            }}
        >
            <AnimatePresence initial={false}>
                <Box
                    component={motion.div}
                    key={location.pathname}
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{
                        opacity: 1,
                        transition: prefersReducedMotion
                            ? { duration: 0 }
                            : { duration: 0.15, ease: EASE_OUT },
                    }}
                    exit={{
                        opacity: 0,
                        transition: prefersReducedMotion
                            ? { duration: 0 }
                            : { duration: 0.08 },
                    }}
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                        overflow: 'hidden',
                        width: '100%',
                    }}
                >
                    {outlet}
                </Box>
            </AnimatePresence>
        </Box>
    );
}
