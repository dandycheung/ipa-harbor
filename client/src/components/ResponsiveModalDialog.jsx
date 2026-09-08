import { ModalDialog } from '@mui/joy';
import useBelowSm from '../hooks/useBelowSm';

export default function ResponsiveModalDialog({ layout, sx, ...props }) {
    const belowSm = useBelowSm();

    return (
        <ModalDialog
            layout={belowSm ? 'fullscreen' : layout}
            sx={[
                sx,
                belowSm && {
                    minWidth: 0,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                },
            ]}
            {...props}
        />
    );
}
