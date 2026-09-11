import React from 'react';
import { Box, useTheme } from '@mui/joy';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';

const NAV_ICONS = {
    '/': SearchIcon,
    '/purchases': ShoppingBagOutlinedIcon,
    '/dl': DownloadRoundedIcon,
    '/settings': SettingsRoundedIcon,
};

const ICON_SIZE = 32;

const noSelectSx = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
};

export default function StandaloneBottomNav({ navItems, currentPath, onNavigate }) {
    const theme = useTheme();

    const getItemColor = (isSelected) => (
        isSelected
            ? theme.vars.palette.primary[500]
            : theme.vars.palette.text.tertiary
    );

    return (
        <Box
            component="nav"
            aria-label="Bottom Navigation"
            sx={{
                ...noSelectSx,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                minHeight: 49,
                pb: 'max(6px, env(safe-area-inset-bottom, 0px))',
                pl: 'max(0px, env(safe-area-inset-left, 0px))',
                pr: 'max(0px, env(safe-area-inset-right, 0px))',
                '& *': noSelectSx,
            }}
        >
            <Box
                component="div"
                role="tablist"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    minHeight: 49,
                }}
            >
                {navItems.map((item) => {
                    const Icon = NAV_ICONS[item.path];
                    const isSelected = currentPath === item.path;
                    const badgeCount = item.badge?.count || 0;
                    const itemColor = getItemColor(isSelected);

                    return (
                        <Box
                            key={item.path}
                            component="button"
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => onNavigate(item.path)}
                            sx={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.5,
                                minHeight: 49,
                                py: 0.5,
                                px: 0.25,
                                m: 0,
                                border: 'none',
                                outline: 'none',
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                bgcolor: 'transparent',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                fontWeight: 500,
                                fontSize: '0.625rem',
                                letterSpacing: '-0.01em',
                                textAlign: 'center',
                                color: itemColor,
                                transition: 'color 0.15s ease',
                            }}
                        >
                            <Box
                                component="span"
                                sx={{
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: ICON_SIZE,
                                    height: ICON_SIZE,
                                    flexShrink: 0,
                                }}
                            >
                                <Icon
                                    sx={{
                                        fontSize: ICON_SIZE,
                                        color: itemColor,
                                    }}
                                />
                                {badgeCount > 0 && (
                                    <Box
                                        component="span"
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            right: -6,
                                            minWidth: 16,
                                            height: 16,
                                            px: 0.5,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '999px',
                                            bgcolor: item.badge.color === 'primary'
                                                ? theme.vars.palette.primary[500]
                                                : theme.vars.palette.neutral[500],
                                            color: '#fff',
                                            fontSize: '0.625rem',
                                            fontWeight: 600,
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {badgeCount}
                                    </Box>
                                )}
                            </Box>
                            <Box
                                component="span"
                                sx={{
                                    color: itemColor,
                                    lineHeight: 1.2,
                                }}
                            >
                                {item.label}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
