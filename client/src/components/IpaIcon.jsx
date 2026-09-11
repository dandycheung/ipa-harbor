import React from 'react';
import {
    Box, Stack, Typography, Divider, IconButton, Chip, Link,
} from '@mui/joy';
import MouseTooltip from './MouseTooltip';
import IpaAppIcon from './IpaAppIcon';
import { downloadApp, isRateLimitError, getAppDownloadPackageUrlByFileName } from '../utils/api';
import Swal from 'sweetalert2';
import formatFileSize from '../utils/formatFileSize.js';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';

export default function IpaIcon({ item, size = 128, isDragging = false, onOpenDetail }) {
    const { t } = useTranslation();
    const { user } = useApp();
    const {
        id: appId,
        name,
        status,
        progress = 0,
        sizeProgress,
        taskId,
        bundleId,
        itemId,
        bundleDisplayName,
        artistName,
        bundleShortVersionString,
        bundleVersion,
        productType,
        softwareVersionBundleId,
        softwareVersionExternalIdentifier,
        releaseDate,
        firstReleaseDate,
        size: fileSize,
        createdAt,
    } = item;

    const isCompactIcon = size < 96;
    const labelFontSize = isCompactIcon ? '0.65rem' : '0.9rem';
    const subLabelFontSize = isCompactIcon ? '0.55rem' : '0.75rem';
    const progressBarHeight = isCompactIcon ? 8 : 15;
    const progressBarBottom = isCompactIcon ? 4 : 9;

    const extractAppInfo = (fileName) => {
        if (!fileName) return { appId: null, versionId: null };
        const match = fileName.match(/^(\d+)_(.+)\.ipa$/);
        return match ? { appId: match[1], versionId: match[2] } : { appId: null, versionId: null };
    };

    const { appId: extractedAppId, versionId } = extractAppInfo(name);
    const finalAppId = appId || extractedAppId;
    const displayAppId = finalAppId || (itemId != null ? String(itemId) : null);

    const formatDate = (dateString) => {
        //  if (!dateString) return '未知';
        if (!dateString) return t('ui.unknown');
        try {
            // return new Date(dateString).toLocaleString('zh-CN');
            const lng = localStorage.getItem('language') || 'en';
            return new Date(dateString).toLocaleString(lng.startsWith('zh') ? 'zh-CN' : 'en-US');
        } catch {
            // return '日期格式错误';
            return t('ui.dateFormatError');
        }
    };

    const getTooltipContent = () => {
        const fields = [
            { label: t('ui.appName_label'), value: bundleDisplayName }, // 应用名称
            { label: t('ui.developer'), value: artistName }, // 开发者
            { label: t('ui.appVersion'), value: bundleShortVersionString },
            { label: t('ui.buildVersion'), value: bundleVersion }, // 构建版本
            { label: t('ui.bundleId'), value: softwareVersionBundleId }, // bundle ID
            { label: t('ui.appId'), value: displayAppId }, // 应用 ID
            { label: t('ui.versionId'), value: softwareVersionExternalIdentifier }, // 版本 ID
            { label: t('ui.productType'), value: productType }, // 产品类型
            { label: t('ui.fileSize'), value: fileSize ? formatFileSize(fileSize) : null }, // 文件大小
            { label: t('ui.releaseDate'), value: releaseDate ? formatDate(releaseDate) : null },
            { label: t('ui.firstReleaseDate'), value: firstReleaseDate ? formatDate(firstReleaseDate) : null },
            { label: t('ui.downloadTime'), value: createdAt ? formatDate(createdAt) : null }, // 下载时间
            { label: t('ui.fileName'), value: name }, // 文件名称
        ];

        const details = fields
            .filter(field => field.value)
            .map(field => `${field.label}: ${field.value}`);

        return details.length ? details.join('\n') : null;
    };


    const tooltipContent = getTooltipContent();

    const handleRetryDownload = async (e) => {
        e.stopPropagation();
        console.log(item);
        if (!finalAppId || !bundleId) {
            Swal.fire({
                icon: 'error',
                title: t('ui.retryFailed'), // 重试失败
                text: t('ui.cannotGetAppId'), // 无法获取应用ID
                confirmButtonText: t('ui.confirm') // 确定
            });
            return;
        }

        try {
            const response = await downloadApp(finalAppId, versionId || 'latest', bundleId);
            if (response.success) {
                Swal.fire({
                    icon: 'success',
                    title: t('ui.retryTaskCreated'), // 重试任务已创建
                    text: `${t('ui.taskId')}: ${response.taskId}`, // 任务ID: ${response.taskId}
                    position: 'top',
                    toast: true,
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        } catch (error) {
            if (isRateLimitError(error)) return;
            console.error('重试下载失败:', error.message);
            Swal.fire({
                icon: 'error',
                title: t('ui.retryFailed'), // 重试失败
                text: error.message, // 错误信息
                confirmButtonText: t('ui.confirm') // 确定
            });
        }
    };

    const tooltipTitle = tooltipContent && (
        <Box sx={{ whiteSpace: 'pre-line', maxWidth: 300 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography level="body-xs">{bundleDisplayName}</Typography>
                <Typography level="body-xs">{bundleShortVersionString}</Typography>
            </Stack>
            {bundleDisplayName && <Divider sx={{ my: 0.5 }} />}
            <Typography level="body-xs">{tooltipContent}</Typography>
        </Box>
    );

    const itemHoverSx = {
        borderRadius: '12px',
        p: isCompactIcon ? 0.5 : 1,
        boxSizing: 'content-box',
        transition: 'background-color 0.22s ease, box-shadow 0.22s ease',
        '@media (hover: hover)': {
            '&:hover': {
                backgroundColor: 'primary.softBg',
                boxShadow: 'inset 0 0 0 1px rgba(var(--joy-palette-primary-mainChannel) / 0.18)',
            },
        },
    };

    const wrapLabelTooltip = (labels) => {
        if (!tooltipContent) return labels;
        return (
            <MouseTooltip title={isDragging ? null : tooltipTitle} disabled={isDragging}>
                {labels}
            </MouseTooltip>
        );
    };

    const downloadUrl = name ? getAppDownloadPackageUrlByFileName(name) : null;
    const canLinkDownload = ['completed', 'downloaded'].includes(status) && downloadUrl;

    const renderAppIcon = (iconProps) => {
        const icon = <IpaAppIcon {...iconProps} />;

        if (!canLinkDownload) {
            return icon;
        }

        return (
            <Link
                component="a"
                href={downloadUrl}
                onClick={(e) => e.preventDefault()} // 阻止默认a事件，同时右键仍可 href 另存为下载
                sx={{
                    display: 'block',
                    lineHeight: 0,
                    textDecoration: 'none',
                    color: 'inherit',
                }}
            >
                {icon}
            </Link>
        );
    };

    const renderContent = () => {
        switch (status) {
            case 'pending':
            case 'running':
                return (
                    <>
                        {/* 图标 + 进度条 */}
                        <Box sx={{ position: 'relative' }}>
                            {renderAppIcon({ appId: finalAppId, size, disabled: true, country: user?.region })}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: progressBarBottom,
                                    left: '9%',
                                    right: '9%',
                                    height: progressBarHeight,
                                    padding: isCompactIcon ? '1px' : '2px',
                                    border: isCompactIcon ? '0.8px solid rgba(0,0,0,0.2)' : '1.2px solid rgba(0,0,0,0.2)',
                                    borderRadius: isCompactIcon ? '8px' : '16px',
                                    backgroundColor: 'rgba(255,255,255,0.3)', // 轨道底色
                                    overflow: 'hidden',
                                    boxSizing: 'border-box',
                                }}
                            >
                                {/* 进度条 */}
                                <Box
                                    sx={{
                                        height: '100%',
                                        width: `${progress}%`,
                                        backgroundColor: '#007aff',
                                        borderRadius: '6px',
                                        transition: 'width 0.2s ease',
                                    }}
                                />
                            </Box>
                        </Box>

                        {/* 描述部分 */}
                        {wrapLabelTooltip(
                            <Stack spacing="0.1rem" alignItems="center" sx={{ width: size }}>
                                <Typography
                                    sx={{
                                        fontSize: labelFontSize,
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        width: '100%',
                                    }}
                                >
                                    {/* {status === 'running' ? '下载中' : '等待中'} {progress && progress + '%'} */}
                                    {status === 'running' ? t('ui.downloading') : t('ui.waiting')} {progress && progress + '%'}
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: subLabelFontSize,
                                        textAlign: 'center',
                                        color: '#666',
                                        wordBreak: 'break-all',
                                    }}
                                >
                                    {sizeProgress || `${progress}%`}
                                </Typography>
                            </Stack>
                        )}
                    </>
                );

            case 'failed':
                return (
                    <>
                        <Box
                            sx={{
                                position: 'relative',
                                cursor: 'pointer',
                            }}
                            onClick={handleDeleteTask}
                        >
                            {renderAppIcon({ appId: finalAppId, size, disabled: true, country: user?.region })}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    // backgroundColor: 'rgba(255,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: size / 6,
                                    opacity: '0.6',
                                    ":hover": {
                                        opacity: 1
                                    },
                                    color: 'white',
                                    textShadow: '1px 2px 2px black'
                                }}
                            >
                                {/* 删除 */}
                                {t('ui.delete')}
                            </Box>
                        </Box>

                        {wrapLabelTooltip(
                            <Stack
                                spacing="0.1rem"
                                alignItems="center"
                                sx={{
                                    width: size,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        opacity: 0.8
                                    }
                                }}
                                onClick={handleRetryDownload}
                            >
                                <Typography sx={{ fontSize: labelFontSize, textAlign: 'center' }}>{t('ui.failed')}</Typography>
                                <Link sx={{ fontSize: subLabelFontSize, textAlign: 'center', color: '#666' }}>
                                    {/* 点击这里重试 */}
                                    {t('ui.clickToRetry')}
                                </Link>
                            </Stack>
                        )}
                    </>
                );

            case 'completed':
            case 'downloaded':
                return (
                    <>
                        {renderAppIcon({ appId: finalAppId, size, country: user?.region })}
                        {wrapLabelTooltip(
                            <Stack spacing="0.1rem" alignItems="center" sx={{ width: size }}>
                                <Typography
                                    sx={{
                                        fontSize: labelFontSize,
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        width: '100%',
                                    }}
                                >
                                    {bundleDisplayName || name}
                                </Typography>
                                <Typography sx={{ fontSize: subLabelFontSize, textAlign: 'center', color: '#666' }}>
                                    {formatFileSize(fileSize) || t('ui.completed')}
                                </Typography>
                            </Stack>
                        )}
                    </>
                );

            default:
                return (
                    <>
                        {renderAppIcon({ appId: finalAppId, size, country: user?.region })}
                        {wrapLabelTooltip(
                            <Stack spacing="0.1rem" alignItems="center" sx={{ width: size }}>
                                <Typography
                                    sx={{
                                        fontSize: labelFontSize,
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        width: '100%',
                                    }}
                                >
                                    {/* {name || '未知应用'} */}
                                    {name || t('ui.unknown')}
                                </Typography>
                                <Typography sx={{ fontSize: subLabelFontSize, textAlign: 'center', color: '#666' }}>
                                    —
                                </Typography>
                            </Stack>
                        )}
                    </>
                );
        }
    };

    const handleClick = () => {
        if (['completed', 'downloaded'].includes(status)) {
            onOpenDetail?.(item);
        }
    };

    const content = (
        <Stack
            alignItems="center"
            spacing={isCompactIcon ? '0.15rem' : '0.4rem'}
            sx={{
                width: size,
                userSelect: 'none',
                position: 'relative',
                display: 'inline-block',
                ...itemHoverSx,
            }}
            onClick={handleClick}
        >
            {renderContent()}
        </Stack>
    );

    return content;

}
