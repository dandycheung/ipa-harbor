import { Box } from '@mui/joy';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocation } from 'react-router-dom';

const EASE_OUT = [0.22, 1, 0.36, 1];
const EASE_IN = [0.4, 0, 1, 1];

export default function PageTransition({ children }) {
    const location = useLocation();
    const prefersReducedMotion = useReducedMotion();

    return (
        <AnimatePresence mode="wait">
            <Box
                component={motion.div}
                key={location.pathname}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    transition: prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 0.18, ease: EASE_OUT },
                }}
                exit={
                    prefersReducedMotion
                        ? undefined
                        : {
                            opacity: 0,
                            y: -4,
                            transition: { duration: 0.14, ease: EASE_IN },
                        }
                }
                sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                }}
            >
                {children}
            </Box>
        </AnimatePresence>
    );
}
