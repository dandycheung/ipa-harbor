import { ModalDialog } from '@mui/joy';
import useBelowSm from '../hooks/useBelowSm';

export default function ResponsiveModalDialog({ layout, ...props }) {
    const belowSm = useBelowSm();
    return (
        <ModalDialog
            layout={belowSm ? 'fullscreen' : layout}
            {...props}
        />
    );
}
