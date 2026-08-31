import Table from '@mui/joy/Table';

export const wideColSx = { display: { xs: 'none', md: 'table-cell' } };

export const COL_WIDTH = {
    nameMin: 200,
    appId: 100,
    version: 100,
    price: 80,
};

export const APP_ICON_SIZE = 40;

export const appIconSx = {
    borderRadius: '22%',
    width: APP_ICON_SIZE,
    height: APP_ICON_SIZE,
};

export const headerColStyle = (width) => ({ width });

export const monoFontSx = {
    fontFamily: 'var(--joy-fontFamily-code, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
};

export const monoCellStyle = {
    fontFamily: monoFontSx.fontFamily,
};

/**
 * @param {(props: object) => object} [getRowProps] 
 */
export const createTableComponents = (getRowProps) => ({
    Table: ({ style, sx, ...props }) => (
        <Table
            component="table"
            stickyHeader
            {...props}
            sx={[
                {
                    '& thead th:first-of-type, & tbody td:first-of-type': {
                        pl: 1.5,
                    },
                },
                ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
            ]}
            style={style}
        />
    ),
    TableRow: (props) => {
        const { item, context, children, style, ...domProps } = props;
        const rowProps = getRowProps?.(props) ?? {};
        return (
            <tr
                {...domProps}
                {...rowProps}
                style={{ ...style, ...rowProps.style }}
            >
                {children}
            </tr>
        );
    },
});
