import React, { useEffect, useState } from 'react';
import {
    Box,
    Stack,
    Typography,
    Sheet,
    Button,
    Badge,
    IconButton,
} from '@mui/joy';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    AddToHomeScreen as AddToHomeScreenIcon,
} from '@mui/icons-material';
import UserStatus from './UserStatus';
import AdminStatus from './AdminStatus';
import LanguageSwitcher from './LanguageSwitcher';
import MobileNavMenu from './MobileNavMenu';
import MenuToggleIcon from './MenuToggleIcon';
import PageTransition from './PageTransition';
import StandaloneBottomNav from './StandaloneBottomNav';
import { useApp } from '../contexts/AppContext';
import { useJoyUp, useStandaloneDisplay } from '../hooks/useJoyMedia';
import GitHubIcon from '@mui/icons-material/GitHub';
import { useTranslation } from 'react-i18next';

export default function AppShell() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { taskList, isAuthenticated } = useApp();
    const standalone = useStandaloneDisplay();
    const aboveSm = useJoyUp('sm');
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuMounted, setMenuMounted] = useState(false);

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    // 屏幕展开到 sm 及以上时自动折叠菜单
    useEffect(() => {
        if (aboveSm) {
            setMenuOpen(false);
        }
    }, [aboveSm]);

    const handleNavigate = (path) => {
        navigate(path);
        setMenuOpen(false);
    };

    const getBadgeInfo = () => {
        if (!taskList) return { count: 0, color: 'neutral' };

        const runningCount = taskList.running?.length || 0;
        const completedCount = taskList.completed?.length || 0;

        if (runningCount > 0) {
            return { count: runningCount, color: 'primary' };
        }
        if (completedCount > 0) {
            return { count: completedCount, color: 'neutral' };
        }

        return { count: 0, color: 'neutral' };
    };

    const badgeInfo = getBadgeInfo();

    const navItems = [
        { path: '/', label: t('ui.search') },
        { path: '/purchases', label: t('ui.purchasedApps') },
        { path: '/dl', label: t('ui.downloadManager'), badge: badgeInfo },
        { path: '/settings', label: t('ui.settings') },
    ];

    const visibleNavItems = isAuthenticated
        ? navItems
        : navItems.filter((item) => item.path !== '/purchases');

    const renderNavButton = (item) => {
        const isActive = location.pathname === item.path;
        const button = (
            <Button
                variant={isActive ? 'soft' : 'plain'}
                size="sm"
                onClick={() => handleNavigate(item.path)}
                color={isActive ? 'primary' : 'neutral'}
            >
                {item.label}
            </Button>
        );

        if (item.badge?.count > 0) {
            return (
                <Badge badgeContent={item.badge.count} color={item.badge.color} size="sm" key={item.path}>
                    {button}
                </Badge>
            );
        }

        return <Box key={item.path}>{button}</Box>;
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <Sheet
                component="header"
                className="safe-area-x app-shell-header"
                sx={{
                    flexShrink: 0,
                    position: 'relative',
                    border: 'none',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 0,
                    pb: 2,
                    bgcolor: 'background.surface',
                    zIndex: menuOpen || menuMounted ? 1301 : 2,
                    '--safe-area-pad-x': '16px',
                }}
            >
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ maxWidth: '1200px', mx: 'auto', width: '100%' }}
                >
                    <Stack direction="row" alignItems="center" gap={1}>
                        <IconButton color="primary" onClick={() => handleNavigate('/')}>
                            <AddToHomeScreenIcon />
                        </IconButton>
                        <Typography
                            level="h3"
                            sx={{
                                fontWeight: 'bold',
                                color: 'primary.500',
                                fontSize: { xs: '1.1rem', sm: undefined },
                            }}
                        >
                            IPA Harbor
                        </Typography>
                    </Stack>

                    {/* sm 及以上：横向导航 */}
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                        {visibleNavItems.map(renderNavButton)}

                        {isAuthenticated ? (
                            <UserStatus />
                        ) : (
                            <Badge color="danger" size="md">
                                <Button
                                    variant="outlined"
                                    size="sm"
                                    onClick={() => handleNavigate('/apple-id')}
                                    color="danger"
                                >
                                    {t('ui.needAppleIdLogin')}
                                </Button>
                            </Badge>
                        )}
                        <LanguageSwitcher />
                    </Stack>

                    {/* sm 以下：账户状态 + 菜单按钮 */}
                    <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        sx={{
                            display: { xs: 'flex', sm: 'none' },
                            position: 'relative',
                            zIndex: menuOpen || menuMounted ? 1301 : undefined,
                        }}
                    >
                        {isAuthenticated ? (
                            !menuMounted && <UserStatus />
                        ) : (
                            <Badge color="danger" size="md">
                                <Button
                                    variant="outlined"
                                    size="sm"
                                    onClick={() => handleNavigate('/apple-id')}
                                    color="danger"
                                >
                                    {t('ui.needAppleIdLogin')}
                                </Button>
                            </Badge>
                        )}
                        <IconButton
                            variant="plain"
                            color="neutral"
                            onClick={() => setMenuOpen((prev) => !prev)}
                            aria-label={menuOpen ? t('ui.closeMenu') : t('ui.openMenu')}
                            aria-expanded={menuOpen}
                        >
                            <MenuToggleIcon open={menuOpen} />
                        </IconButton>
                    </Stack>
                </Stack>
            </Sheet>

            {/* sm 以下：全屏 overlay 菜单 */}
            <MobileNavMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                onMountedChange={setMenuMounted}
                navItems={navItems}
                onNavigate={handleNavigate}
                isAuthenticated={isAuthenticated}
            />

            {/* 主要内容区域 */}
            <Box
                component="main"
                className="safe-area-x"
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: '1200px',
                    mx: 'auto',
                    width: '100%',
                    '--safe-area-pad-x': '24px',
                }}
            >
                <PageTransition />
            </Box>

            {/* Footer：standalone 下为底部 Tab 导航 */}
            <Sheet
                component="footer"
                className={standalone ? undefined : 'safe-area-footer'}
                sx={{
                    flexShrink: 0,
                    border: 'none',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 0,
                    bgcolor: 'background.surface',
                    ...(standalone && {
                        pt: 0,
                        pb: 0,
                        px: 0,
                    }),
                }}
            >
                {standalone ? (
                    <StandaloneBottomNav
                        navItems={visibleNavItems}
                        currentPath={location.pathname}
                        onNavigate={handleNavigate}
                    />
                ) : (
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ maxWidth: '1200px', mx: 'auto', width: '100%' }}
                    >
                        {/* 左侧：开源信息 */}
                        <Stack direction="column" alignItems="flex-start" gap={0.2}>
                            <Typography level="body-xs">IPA Harbor ©2025</Typography>
                            <Stack
                                direction="row"
                                gap={0.2}
                                sx={{
                                    cursor: 'pointer',
                                    ':hover': { opacity: 0.8 },
                                    transition: 'opacity 0.2s ease-in-out',
                                }}
                            >
                                <Typography
                                    level="body-xs"
                                    sx={{ fontSize: '0.625rem', fontWeight: 'normal' }}
                                    onClick={() => window.open('https://github.com/ij369/ipa-harbor', '_blank')}
                                    startDecorator={<GitHubIcon sx={{ fontSize: '0.75rem' }} />}
                                >
                                    {t('ui.footer')}
                                </Typography>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        fontSize: '0.625rem',
                                        fontWeight: 'normal',
                                        display: { xs: 'none', sm: 'none', md: 'block' },
                                    }}
                                    onClick={() => window.open('https://github.com/ij369/ipa-harbor', '_blank')}
                                >
                                    {t('ui.footerSuffix')}
                                </Typography>
                            </Stack>
                        </Stack>

                        {/* 右侧：操作按钮 */}
                        <Stack direction="row" alignItems="center" gap={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
                            <AdminStatus />
                        </Stack>
                    </Stack>
                )}
            </Sheet>
        </Box>
    );
}
