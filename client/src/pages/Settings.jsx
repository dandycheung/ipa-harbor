import React, { useEffect, useState } from 'react';
import { Avatar, Box, Button, Chip, Divider, IconButton, Sheet, Stack, Switch, Tooltip, Typography } from '@mui/joy';
import { Check, ExitToApp, InfoOutlined, SystemUpdateAlt } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Dialog from '../components/Dialog';
import FilenameTemplateEditor from '../components/FilenameTemplateEditor';
import { useJoyDown } from '../hooks/useJoyMedia';
import { useApp } from '../contexts/AppContext';
import { useAdmin } from '../contexts/AdminContext';
import { updateAdminSettings, isRateLimitError, checkAppUpdate, getAdminStatus } from '../utils/api';
import {
    cloneTemplate,
    DEFAULT_DOWNLOAD_FILENAME_TEMPLATE,
    normalizeTemplate,
    templateHasVariable,
} from '../utils/filenameTemplate';
import { normalizeLanguageCode } from '../i18n';
import { isOtaSecureContext, useOtaInstallPreference } from '../utils/otaInstallPreference';
import { useLoadAppScreenshotsPreference } from '../utils/appScreenshotsPreference';
import Swal from 'sweetalert2';

const scrollSx = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    overscrollBehavior: 'contain',
    pr: 3,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(var(--joy-palette-neutral-500Channel, 99 107 116) / 0.55) transparent',
    scrollbarGutter: 'stable',
    '&::-webkit-scrollbar': {
        width: 8,
    },
    '&::-webkit-scrollbar-thumb': {
        borderRadius: '999px',
        bgcolor: 'rgba(var(--joy-palette-neutral-500Channel, 99 107 116) / 0.45)',
    },
    '&::-webkit-scrollbar-thumb:hover': {
        bgcolor: 'rgba(var(--joy-palette-neutral-500Channel, 99 107 116) / 0.65)',
    },
};

const sectionSx = {
    p: 2,
    borderRadius: 'md',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const HARBOR_GITHUB_URL = 'https://github.com/ij369/ipa-harbor';
const HARBOR_DOCKER_HUB_URL = 'https://hub.docker.com/r/uuphy/ipa-harbor/tags';

const tablerIconSx = {
    width: 20,
    height: 20,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};

function TablerGitHubIcon({ sx }) {
    return (
        <Box
            component="svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden
            sx={{ ...tablerIconSx, ...sx }}
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" />
        </Box>
    );
}

function TablerDockerIcon({ sx }) {
    return (
        <Box
            component="svg"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden
            sx={{ ...tablerIconSx, ...sx }}
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M22 12.54c-1.804 -.345 -2.701 -1.08 -3.523 -2.94c-.487 .696 -1.102 1.568 -.92 2.4c.028 .238 -.32 1 -.557 1h-14c0 5.208 3.164 7 6.196 7c4.124 .022 7.828 -1.376 9.854 -5c1.146 -.101 2.296 -1.505 2.95 -2.46" />
            <path d="M5 10h3v3h-3l0 -3" />
            <path d="M8 10h3v3h-3l0 -3" />
            <path d="M11 10h3v3h-3l0 -3" />
            <path d="M8 7h3v3h-3l0 -3" />
            <path d="M11 7h3v3h-3l0 -3" />
            <path d="M11 4h3v3h-3l0 -3" />
            <path d="M4.571 18c1.5 0 2.047 -.074 2.958 -.78" />
            <path d="M10 16l0 .01" />
        </Box>
    );
}

export default function Settings() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user, isAuthenticated, loading, settings, setSettings, settingsLoaded } = useApp();
    const {
        updateAppSettings,
        user: adminUser,
        logout: adminLogout,
        getFormattedExpiresAt,
        isExpiringSoon,
    } = useAdmin();
    const [language, setLanguage] = useState(normalizeLanguageCode(i18n.language));
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [appVersion, setAppVersion] = useState('');
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [otaInstallEnabled, setOtaInstallEnabled] = useOtaInstallPreference();
    const [loadAppScreenshotsEnabled, setLoadAppScreenshotsEnabled] = useLoadAppScreenshotsPreference();
    const otaSecureContext = isOtaSecureContext();
    const [downloadFileNameTemplate, setDownloadFileNameTemplate] = useState(
        cloneTemplate(DEFAULT_DOWNLOAD_FILENAME_TEMPLATE)
    );
    const [showVersionMetadataRefresh, setShowVersionMetadataRefresh] = useState(false);
    const [versionMetadataRefreshSaving, setVersionMetadataRefreshSaving] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [filenameDialogOpen, setFilenameDialogOpen] = useState(false);
    const belowMd = useJoyDown('md');

    useEffect(() => {
        if (!settingsLoaded) {
            return;
        }

        setDownloadFileNameTemplate(cloneTemplate(settings.downloadFileNameTemplate));
        setShowVersionMetadataRefresh(settings.showVersionMetadataRefresh === true);
        setDirty(false);
    }, [settings, settingsLoaded]);

    useEffect(() => {
        getAdminStatus()
            .then((response) => {
                if (response.success && response.data?.version) {
                    setAppVersion(response.data.version);
                }
            })
            .catch(() => {
                // 静默失败，版本区显示占位
            });
    }, []);

    const markDirty = () => setDirty(true);

    const handleLanguageChange = (lng) => {
        setLanguage(lng);
        i18n.changeLanguage(lng);
        localStorage.setItem('language', lng);
    };

    const handleResetTemplate = () => {
        setDownloadFileNameTemplate(cloneTemplate(DEFAULT_DOWNLOAD_FILENAME_TEMPLATE));
        markDirty();
    };

    const handleShowVersionMetadataRefreshChange = async (checked) => {
        setShowVersionMetadataRefresh(checked);
        setVersionMetadataRefreshSaving(true);

        try {
            const response = await updateAdminSettings({ showVersionMetadataRefresh: checked });

            if (response.success && response.data?.settings) {
                setSettings(response.data.settings);
                updateAppSettings(response.data.settings);
            }
        } catch (error) {
            setShowVersionMetadataRefresh(!checked);

            if (isRateLimitError(error)) {
                return;
            }

            Swal.fire({
                icon: 'error',
                title: t('ui.settingsSaveFailed'),
                text: error.message,
                confirmButtonText: t('ui.confirm'),
            });
        } finally {
            setVersionMetadataRefreshSaving(false);
        }
    };

    const buildGithubLinksHtml = (harborGithubUrl, ipatoolGithubUrl) => `
        <p style="margin: 12px 0 8px; font-size: 14px;">${t('ui.reportIssueHint')}</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.8;">
            <a href="${harborGithubUrl}" target="_blank" rel="noopener noreferrer">${t('ui.harborGithub')}</a><br/>
            <a href="${ipatoolGithubUrl}" target="_blank" rel="noopener noreferrer">${t('ui.ipatoolGithub')}</a>
        </p>
    `;

    const handleCheckUpdate = async () => {
        setCheckingUpdate(true);

        try {
            const response = await checkAppUpdate();
            const data = response.data;

            if (data?.currentVersion) {
                setAppVersion(data.currentVersion);
            }

            const linksHtml = buildGithubLinksHtml(
                data.harborGithubUrl,
                data.ipatoolGithubUrl
            );

            if (data.isLatest) {
                await Swal.fire({
                    icon: 'success',
                    title: t('ui.alreadyLatestVersion', { version: data.currentVersion }),
                    html: linksHtml,
                    confirmButtonText: t('ui.confirm'),
                });
                return;
            }

            await Swal.fire({
                icon: 'info',
                title: t('ui.updateAvailable', {
                    latest: data.latestVersion,
                    current: data.currentVersion,
                }),
                html: `
                    <p style="margin: 0 0 8px; font-size: 14px;">
                        <a href="${data.dockerHubUrl}" target="_blank" rel="noopener noreferrer">${t('ui.viewDockerTags')}</a>
                    </p>
                    ${linksHtml}
                `,
                confirmButtonText: t('ui.confirm'),
            });
        } catch (error) {
            if (isRateLimitError(error)) {
                return;
            }

            await Swal.fire({
                icon: 'error',
                title: t('ui.updateCheckFailed'),
                text: error.message,
                confirmButtonText: t('ui.confirm'),
            });
        } finally {
            setCheckingUpdate(false);
        }
    };

    const handleAdminLogout = async () => {
        setLogoutLoading(true);

        try {
            await adminLogout();
            navigate('/login');
        } catch (error) {
            console.error('退出系统失败:', error);
        } finally {
            setLogoutLoading(false);
        }
    };

    const handleSave = async () => {
        if (!templateHasVariable(downloadFileNameTemplate)) {
            Swal.fire({
                icon: 'warning',
                title: t('ui.filenameNeedVariable'),
                confirmButtonText: t('ui.confirm'),
            });
            return;
        }

        setSaving(true);

        try {
            const payload = {
                downloadFileNameTemplate: normalizeTemplate(downloadFileNameTemplate),
            };

            const response = await updateAdminSettings(payload);

            if (response.success && response.data?.settings) {
                setSettings(response.data.settings);
                updateAppSettings(response.data.settings);
                setDirty(false);
                setFilenameDialogOpen(false);

                Swal.fire({
                    icon: 'success',
                    title: t('ui.settingsSaved'),
                    timer: 1500,
                    toast: true,
                    position: 'top',
                    showConfirmButton: false,
                });
            }
        } catch (error) {
            if (isRateLimitError(error)) {
                return;
            }

            Swal.fire({
                icon: 'error',
                title: t('ui.settingsSaveFailed'),
                text: error.message,
                confirmButtonText: t('ui.confirm'),
            });
        } finally {
            setSaving(false);
        }
    };

    const renderFilenameTemplateActions = (fullWidth = false) => (
        <Stack direction="row" gap={1} sx={{ flexShrink: 0, ...(fullWidth && { width: '100%' }) }}>
            <Button
                size="sm"
                variant="outlined"
                color="neutral"
                onClick={handleResetTemplate}
                sx={fullWidth ? { flex: 1 } : undefined}
            >
                {t('ui.resetToDefault')}
            </Button>
            <Button
                size="sm"
                loading={saving}
                disabled={saving || !dirty}
                onClick={handleSave}
                startDecorator={<Check />}
                sx={fullWidth ? { flex: 1 } : undefined}
            >
                {t('ui.save')}
            </Button>
        </Stack>
    );

    return (
        <Box
            sx={{
                flex: 1,
                minHeight: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                width: (theme) => `calc(100% + ${theme.spacing(3)})`,
                mr: -3,
                overflow: 'hidden',
            }}
        >
            <Box className="safe-area-scroll-bottom" sx={scrollSx}>
                <Box component="header" sx={{ pt: 3, mb: 3, flexShrink: 0 }}>
                    <Typography level="h2">{t('ui.settings')}</Typography>
                </Box>

                <Stack gap={3} sx={{ pb: 3 }}>
                    <Sheet variant="outlined" sx={sectionSx}>
                        <Typography level="title-md" sx={{ mb: 2 }}>
                            {t('ui.systemInfo')}
                        </Typography>

                        <Stack gap={2}>
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                justifyContent="space-between"
                                alignItems={{ xs: 'stretch', sm: 'center' }}
                                gap={1.5}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography level="body-sm" sx={{ color: 'text.tertiary' }}>
                                        {t('ui.adminAccount')}
                                    </Typography>
                                    {adminUser && (
                                        <>
                                            <Typography level="body-sm" sx={{ mt: 0.5, fontWeight: 'md' }}>
                                                {adminUser.username}
                                            </Typography>
                                            <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.25 }}>
                                                <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                                                    {t('ui.expiryTime')}: {getFormattedExpiresAt()}
                                                </Typography>
                                                {isExpiringSoon() && (
                                                    <Chip color="warning" size="sm">
                                                        {t('ui.expiringSoon')}
                                                    </Chip>
                                                )}
                                            </Stack>
                                        </>
                                    )}
                                </Box>
                                <Button
                                    color="danger"
                                    variant="outlined"
                                    size="sm"
                                    loading={logoutLoading}
                                    disabled={logoutLoading}
                                    onClick={handleAdminLogout}
                                    startDecorator={<ExitToApp />}
                                    sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}
                                >
                                    {logoutLoading ? t('ui.loggingOut') : t('ui.logoutSystem')}
                                </Button>
                            </Stack>

                            <Divider />

                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                justifyContent="space-between"
                                alignItems={{ xs: 'stretch', sm: 'center' }}
                                gap={1.5}
                            >
                                <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="center"
                                    sx={{ flex: 1, minWidth: 0, width: '100%' }}
                                >
                                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                        <Typography level="body-sm" sx={{ fontWeight: 'md' }}>
                                            IPA Harbor
                                        </Typography>
                                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                                            {t('ui.currentVersion')}：{appVersion ? `v${appVersion}` : '—'}
                                        </Typography>
                                    </Stack>

                                    <Stack direction="row" alignItems="center" gap={0.25} sx={{ flexShrink: 0 }}>
                                        <IconButton
                                            component="a"
                                            href={HARBOR_GITHUB_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="plain"
                                            color="neutral"
                                            size="sm"
                                            aria-label={t('ui.harborGithub')}
                                        >
                                            <TablerGitHubIcon />
                                        </IconButton>
                                        <IconButton
                                            component="a"
                                            href={HARBOR_DOCKER_HUB_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="plain"
                                            color="neutral"
                                            size="sm"
                                            aria-label={t('ui.viewDockerTags')}
                                        >
                                            <TablerDockerIcon />
                                        </IconButton>
                                    </Stack>
                                </Stack>
                                <Button
                                    variant="outlined"
                                    color="neutral"
                                    size="sm"
                                    loading={checkingUpdate}
                                    disabled={checkingUpdate}
                                    onClick={handleCheckUpdate}
                                    startDecorator={<SystemUpdateAlt />}
                                    sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}
                                >
                                    {checkingUpdate ? t('ui.checkingUpdates') : t('ui.checkForUpdates')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Sheet>

                    <Sheet variant="outlined" sx={{ ...sectionSx, display: 'none' }}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={1.5}
                        >
                            <Typography level="title-md">
                                {t('ui.appleId')}
                            </Typography>
                            {loading ? (
                                <Typography level="body-sm">{t('ui.loading')}</Typography>
                            ) : !isAuthenticated || !user ? (
                                <Button
                                    variant="outlined"
                                    size="sm"
                                    onClick={() => navigate('/apple-id')}
                                >
                                    {t('ui.appleIdLogin')}
                                </Button>
                            ) : (
                                <Stack
                                    direction="row"
                                    spacing={1.5}
                                    alignItems="center"
                                    sx={{ minWidth: 0, flexShrink: 1 }}
                                >
                                    <Avatar size="sm" sx={{ bgcolor: 'primary.500', color: 'white' }}>
                                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                    </Avatar>
                                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                        <Typography level="body-sm" fontWeight="md" noWrap>
                                            {user.name || t('ui.unknownUser')}
                                        </Typography>
                                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }} noWrap>
                                            {user.email || t('ui.unknownEmail')}
                                        </Typography>
                                    </Stack>
                                </Stack>
                            )}
                        </Stack>
                    </Sheet>

                    <Sheet variant="outlined" sx={sectionSx}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={1.5}
                        >
                            <Typography level="title-md">
                                {t('ui.languageSettings')}
                            </Typography>
                            <LanguageSwitcher
                                variant="select"
                                value={language}
                                onChange={handleLanguageChange}
                            />
                        </Stack>
                    </Sheet>

                    <Sheet variant="outlined" sx={sectionSx}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={1.5}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" alignItems="center" gap={0.5}>
                                    <Typography level="title-md">
                                        {t('ui.enableOtaInstall')}
                                    </Typography>
                                    {!otaSecureContext && (
                                        <Tooltip
                                            title={t('ui.enableOtaInstallInsecureContext')}
                                            variant="outlined"
                                            color="warning"
                                            placement="top"
                                            arrow
                                        >
                                            <IconButton
                                                variant="plain"
                                                color="warning"
                                                size="sm"
                                                aria-label={t('ui.enableOtaInstallInsecureContext')}
                                                sx={{ '--IconButton-size': '24px', minWidth: 24, minHeight: 24 }}
                                            >
                                                <InfoOutlined sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Stack>
                                <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.5 }}>
                                    {t('ui.enableOtaInstallHint')}
                                </Typography>
                            </Box>
                            <Switch
                                checked={otaInstallEnabled}
                                onChange={(event) => setOtaInstallEnabled(event.target.checked)}
                            />
                        </Stack>
                    </Sheet>

                    <Sheet variant="outlined" sx={sectionSx}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={1.5}
                            sx={{ mb: 1.5 }}
                        >
                            <Typography level="title-md">
                                {t('ui.downloadFileNameSettings')}
                            </Typography>
                            {belowMd ? (
                                <Button
                                    size="sm"
                                    variant="outlined"
                                    color={dirty ? 'primary' : 'neutral'}
                                    onClick={() => setFilenameDialogOpen(true)}
                                >
                                    {t('ui.editFilenameTemplate')}
                                </Button>
                            ) : (
                                renderFilenameTemplateActions()
                            )}
                        </Stack>

                        <FilenameTemplateEditor
                            value={downloadFileNameTemplate}
                            previewOnly={belowMd}
                            onChange={(nextValue) => {
                                setDownloadFileNameTemplate(nextValue);
                                markDirty();
                            }}
                        />
                    </Sheet>

                    <Dialog
                        isOpen={belowMd && filenameDialogOpen}
                        onClose={() => setFilenameDialogOpen(false)}
                        title={t('ui.downloadFileNameSettings')}
                        size="large"
                        fillBody
                        actions={renderFilenameTemplateActions(true)}
                    >
                        <FilenameTemplateEditor
                            value={downloadFileNameTemplate}
                            onChange={(nextValue) => {
                                setDownloadFileNameTemplate(nextValue);
                                markDirty();
                            }}
                        />
                    </Dialog>

                    <Sheet variant="outlined" sx={sectionSx}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={1.5}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography level="title-md">
                                    {t('ui.showVersionMetadataRefresh')}
                                </Typography>
                                <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.5 }}>
                                    {t('ui.showVersionMetadataRefreshHint')}
                                </Typography>
                            </Box>
                            <Switch
                                checked={showVersionMetadataRefresh}
                                disabled={versionMetadataRefreshSaving}
                                onChange={(event) => handleShowVersionMetadataRefreshChange(event.target.checked)}
                            />
                        </Stack>
                    </Sheet>

                    <Sheet variant="outlined" sx={sectionSx}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            gap={1.5}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography level="title-md">
                                    {t('ui.loadAppScreenshots')}
                                </Typography>
                                <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.5 }}>
                                    {t('ui.loadAppScreenshotsHint')}
                                </Typography>
                            </Box>
                            <Switch
                                checked={loadAppScreenshotsEnabled}
                                onChange={(event) => setLoadAppScreenshotsEnabled(event.target.checked)}
                            />
                        </Stack>
                    </Sheet>
                </Stack>
            </Box>
        </Box>
    );
}
