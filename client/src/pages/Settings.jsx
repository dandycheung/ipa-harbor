import React, { useEffect, useState } from 'react';
import { Avatar, Box, Button, Sheet, Stack, Switch, Typography } from '@mui/joy';
import { Check } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';
import FilenameTemplateEditor from '../components/FilenameTemplateEditor';
import { useApp } from '../contexts/AppContext';
import { useAdmin } from '../contexts/AdminContext';
import { updateAdminSettings, isRateLimitError } from '../utils/api';
import {
    cloneTemplate,
    DEFAULT_DOWNLOAD_FILENAME_TEMPLATE,
    normalizeTemplate,
    templateHasVariable,
} from '../utils/filenameTemplate';
import { normalizeLanguageCode } from '../i18n';
import Swal from 'sweetalert2';

const scrollSx = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    overscrollBehavior: 'contain',
    pb: 1,
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

export default function Settings() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user, isAuthenticated, loading, settings, setSettings, settingsLoaded } = useApp();
    const { updateAppSettings } = useAdmin();
    const [language, setLanguage] = useState(normalizeLanguageCode(i18n.language));
    const [downloadFileNameTemplate, setDownloadFileNameTemplate] = useState(
        cloneTemplate(DEFAULT_DOWNLOAD_FILENAME_TEMPLATE)
    );
    const [showVersionMetadataRefresh, setShowVersionMetadataRefresh] = useState(false);
    const [versionMetadataRefreshSaving, setVersionMetadataRefreshSaving] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (!settingsLoaded) {
            return;
        }

        setDownloadFileNameTemplate(cloneTemplate(settings.downloadFileNameTemplate));
        setShowVersionMetadataRefresh(settings.showVersionMetadataRefresh === true);
        setDirty(false);
    }, [settings, settingsLoaded]);

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
                mt: -3,
                pt: 0,
            }}
        >
            <Box sx={scrollSx}>
                <Box component="header" sx={{ pt: 3, mb: 3, flexShrink: 0 }}>
                    <Typography level="h2">{t('ui.settings')}</Typography>
                </Box>

                <Stack gap={3}>
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
                            sx={{ mb: 1.5 }}
                        >
                            <Typography level="title-md">
                                {t('ui.downloadFileNameSettings')}
                            </Typography>
                            <Stack direction="row" gap={1} sx={{ flexShrink: 0 }}>
                                <Button
                                    size="sm"
                                    variant="outlined"
                                    color="neutral"
                                    onClick={handleResetTemplate}
                                >
                                    {t('ui.resetToDefault')}
                                </Button>
                                <Button
                                    size="sm"
                                    loading={saving}
                                    disabled={saving || !dirty}
                                    onClick={handleSave}
                                    startDecorator={<Check />}
                                >
                                    {t('ui.save')}
                                </Button>
                            </Stack>
                        </Stack>

                        <FilenameTemplateEditor
                            value={downloadFileNameTemplate}
                            onChange={(nextValue) => {
                                setDownloadFileNameTemplate(nextValue);
                                markDirty();
                            }}
                        />
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
                </Stack>
            </Box>
        </Box>
    );
}
