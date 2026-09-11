import React, { useMemo, useState, useEffect, useRef, useCallback, lazy, Suspense, forwardRef } from 'react';
import { Box, Typography, Chip, Stack, CircularProgress, Sheet, Badge, IconButton } from '@mui/joy';
import { VirtuosoGrid } from 'react-virtuoso';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useApp } from '../contexts/AppContext';
import IpaIcon from '../components/IpaIcon';
import IpaDetailDrawer from '../components/IpaDetailDrawer';
import {
    Check,
    Schedule,
    Download,
    ErrorOutline,
    CheckCircle,
    CloudDone,
    InfoOutlined,
} from '@mui/icons-material';
import formatFileSize from '../utils/formatFileSize.js';
import { useTranslation } from 'react-i18next';
import { NewDownloadButton } from '../components/NewDownloadDialog';
import { useJoyDown } from '../hooks/useJoyMedia';

const NewDownloadDialog = lazy(() => import('../components/NewDownloadDialog'));

const STATUS_FILTERS = [
    { key: 'pending', color: 'warning', Icon: Schedule, labelKey: 'pending' },
    { key: 'running', color: 'primary', Icon: Download, labelKey: 'running' },
    { key: 'failed', color: 'danger', Icon: ErrorOutline, labelKey: 'failed' },
    { key: 'completed', color: 'success', Icon: CheckCircle, labelKey: 'completed' },
    { key: 'downloaded', color: 'neutral', Icon: CloudDone, labelKey: 'downloaded' },
];

// 根据 IpaIcon 实际尺寸推算单元格大小（含 hover padding 与双行标签）
function buildGridLayout(iconSize, compact) {
    const hoverPad = compact ? 4 : 8;
    const labelArea = compact ? 40 : 52;
    const cellMargin = compact ? 8 : 16;
    return {
        iconSize,
        cellWidth: iconSize + hoverPad * 2 + cellMargin,
        cellHeight: iconSize + hoverPad * 2 + labelArea,
        gap: compact ? 4 : 8,
        listPadding: compact ? 4 : 8,
    };
}

const GRID_LAYOUT = {
    default: buildGridLayout(128, false),
    compact: buildGridLayout(64, true),
};

const DETAIL_QUERY_KEY = 'detail';
const DETAIL_OPEN_STATUSES = new Set(['completed', 'downloaded']);

function findDetailItem(items, detailParam) {
    if (!detailParam) {
        return null;
    }

    try {
        const fileName = decodeURIComponent(detailParam);
        return items.find((item) => item.name === fileName) ?? null;
    } catch {
        return null;
    }
}

// VirtuosoGrid 通过 style 传入滚动与绝对定位，必须用原生 div + style，不能放进 sx
function createGridComponents({ cellWidth, cellHeight, gap, listPadding, compact }) {
    return {
        List: forwardRef(function DownloadGridList({ style, children, ...props }, ref) {
            return (
                <div
                    ref={ref}
                    {...props}
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        width: '100%',
                        margin: 0,
                        padding: listPadding,
                        gap,
                        overflowX: 'hidden',
                        boxSizing: 'border-box',
                        ...style,
                    }}
                >
                    {children}
                </div>
            );
        }),
        Item: ({ children, style, ...props }) => (
            <div
                {...props}
                style={{
                    width: cellWidth,
                    height: cellHeight,
                    flex: 'none',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    paddingTop: compact ? 2 : 4,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    ...style,
                }}
            >
                {children}
            </div>
        ),
    };
}

export default function DownloadManager() {
    const { t } = useTranslation();
    const isCompact = useJoyDown('sm');

    const gridLayout = isCompact ? GRID_LAYOUT.compact : GRID_LAYOUT.default;
    const gridComponents = useMemo(
        () => createGridComponents({ ...gridLayout, compact: isCompact }),
        [gridLayout.cellWidth, gridLayout.cellHeight, gridLayout.gap, gridLayout.listPadding, isCompact]
    );
    const { taskList, fileList, downloadDataReady } = useApp();
    const [searchParams, setSearchParams] = useSearchParams();
    const detailParam = searchParams.get(DETAIL_QUERY_KEY);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [newDownloadDialogOpen, setNewDownloadDialogOpen] = useState(false);
    const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
    const [selectedDetailItem, setSelectedDetailItem] = useState(null);
    const detailRestoreAttemptedRef = useRef(null);

    const clearDetailParam = useCallback(() => {
        setSearchParams((prev) => {
            if (!prev.has(DETAIL_QUERY_KEY)) {
                return prev;
            }
            const next = new URLSearchParams(prev);
            next.delete(DETAIL_QUERY_KEY);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const closeDetailDrawer = useCallback(() => {
        setDetailDrawerOpen(false);
        clearDetailParam();
    }, [clearDetailParam]);

    const handleDetailExitComplete = useCallback(() => {
        setSelectedDetailItem(null);
    }, []);

    const openDetailDrawer = useCallback((item) => {
        setSelectedDetailItem(item);
        setDetailDrawerOpen(true);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set(DETAIL_QUERY_KEY, item.name);
            return next;
        }, { replace: false });
    }, [setSearchParams]);

    const allItems = useMemo(() => {
        const items = [];

        ['pending', 'running', 'failed', 'completed'].forEach(status => {
            if (taskList[status]) {
                taskList[status].forEach(task => {
                    // 从任务中提取应用信息
                    const appId = task.appId || task.id;
                    const fileName = task.fileName || `${appId}_${task.actualVersionId || task.versionId || 'latest'}.ipa`;

                    // 提取进度信息
                    const progressInfo = task.progress || {};
                    const percentage = progressInfo.percentage || 0;
                    const sizeProgress = progressInfo.sizeProgress || progressInfo.description || task.progressText || '';

                    // 对于completed状态的任务，尝试从fileList中获取完整的metadata信息
                    let itemData = {
                        id: appId,
                        name: fileName,
                        status: status,
                        progress: percentage,
                        sizeProgress: sizeProgress,
                        downloadSpeed: progressInfo.downloadSpeed || '',
                        taskId: task.taskId || task.id,
                        type: 'task',
                        bundleId: task.bundleId
                    };

                    // 如果是completed状态，尝试从fileList中获取metadata
                    if (status === 'completed' && fileList.files) {
                        const matchingFile = fileList.files.find(file => file.name === fileName);
                        if (matchingFile) {
                            itemData = {
                                ...itemData,
                                size: matchingFile.size,
                                itemId: matchingFile.itemId,
                                bundleDisplayName: matchingFile.bundleDisplayName,
                                artistName: matchingFile.artistName,
                                bundleShortVersionString: matchingFile.bundleShortVersionString,
                                bundleVersion: matchingFile.bundleVersion,
                                productType: matchingFile.productType,
                                softwareVersionBundleId: matchingFile.softwareVersionBundleId,
                                softwareVersionExternalIdentifier: matchingFile.softwareVersionExternalIdentifier,
                                releaseDate: matchingFile.releaseDate,
                                firstReleaseDate: matchingFile.firstReleaseDate,
                                createdAt: matchingFile.createdAt,
                                modifiedAt: matchingFile.modifiedAt
                            };
                        }
                    }

                    items.push(itemData);
                });
            }
        });

        // 已下载的文件（不在任务列表中的）
        if (fileList.files) {
            fileList.files.forEach(file => {
                const existsInTasks = items.some(item => item.name === file.name);

                if (!existsInTasks) {
                    // 优先使用 metadata 中的 itemId，兼容自定义文件名模板
                    const appId = file.itemId || file.name.match(/^(\d+)_/)?.[1];

                    items.push({
                        id: appId || file.name,
                        name: file.name,
                        status: 'downloaded',
                        progress: 100,
                        size: file.size,
                        type: 'file',
                        itemId: file.itemId,
                        bundleDisplayName: file.bundleDisplayName,
                        artistName: file.artistName,
                        bundleShortVersionString: file.bundleShortVersionString,
                        bundleVersion: file.bundleVersion,
                        productType: file.productType,
                        softwareVersionBundleId: file.softwareVersionBundleId,
                        softwareVersionExternalIdentifier: file.softwareVersionExternalIdentifier,
                        releaseDate: file.releaseDate,
                        firstReleaseDate: file.firstReleaseDate,
                        createdAt: file.createdAt,
                        modifiedAt: file.modifiedAt
                    });
                }
            });
        }

        return items;
    }, [taskList, fileList]);

    const statusCounts = useMemo(() => {
        const counts = {
            pending: 0,
            running: 0,
            failed: 0,
            completed: 0,
            downloaded: 0
        };

        allItems.forEach(item => {
            counts[item.status] = (counts[item.status] || 0) + 1;
        });

        return counts;
    }, [allItems]);

    const filteredItems = useMemo(() => {
        if (selectedFilter === 'all') {
            return allItems;
        }
        return allItems.filter(item => item.status === selectedFilter);
    }, [allItems, selectedFilter]);

    useEffect(() => {
        if (!detailParam) {
            detailRestoreAttemptedRef.current = null;
            return;
        }

        if (!downloadDataReady) {
            return;
        }

        if (detailRestoreAttemptedRef.current === detailParam) {
            return;
        }
        detailRestoreAttemptedRef.current = detailParam;

        const item = findDetailItem(allItems, detailParam);
        if (item && DETAIL_OPEN_STATUSES.has(item.status)) {
            if (selectedFilter !== 'all' && item.status !== selectedFilter) {
                setSelectedFilter('all');
            }
            setSelectedDetailItem(item);
            setDetailDrawerOpen(true);
            return;
        }

        Swal.fire({
            icon: 'error',
            text: t('ui.recordNotFound'),
            confirmButtonText: t('ui.confirm'),
        });
        setDetailDrawerOpen(false);
        setSelectedDetailItem(null);
        clearDetailParam();
    }, [detailParam, downloadDataReady, allItems, selectedFilter, clearDetailParam, t]);

    const openNewDownload = (e) => {
        e?.stopPropagation?.();
        setNewDownloadDialogOpen(true);
    };

    const filterChips = STATUS_FILTERS.map(({ key, color, Icon, labelKey }) => {
        const isSelected = selectedFilter === key;
        const count = statusCounts[key];
        const label = t(`ui.${labelKey}`);

        if (isCompact) {
            return (
                <Badge
                    key={key}
                    badgeContent={count}
                    color={color}
                    size="sm"
                    invisible={count === 0}
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    sx={{
                        '& .MuiBadge-badge': {
                            top: 4,
                            right: 4,
                            minWidth: 16,
                            height: 16,
                            fontSize: '0.65rem',
                        },
                    }}
                >
                    <IconButton
                        size="sm"
                        variant={isSelected ? 'solid' : 'soft'}
                        color={color}
                        onClick={() => setSelectedFilter(isSelected ? 'all' : key)}
                        title={`${label}: ${count}`}
                        sx={{
                            '--IconButton-size': '36px',
                            p: 0.75,
                        }}
                    >
                        <Icon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Badge>
            );
        }

        return (
            <Chip
                key={key}
                color={color}
                variant={isSelected ? 'solid' : 'soft'}
                onClick={() => setSelectedFilter(isSelected ? 'all' : key)}
                sx={{ cursor: 'pointer' }}
                startDecorator={isSelected ? <Check /> : null}
            >
                {`${label}: ${count}`}
            </Chip>
        );
    });

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            py: 3,
        }}>
            <Stack
                onClick={() => { setSelectedFilter('all'); }}
                direction="row"
                gap={2}
                sx={{ mb: 3, flexWrap: 'wrap', cursor: 'pointer', alignItems: 'center', flexShrink: 0 }}
                justifyContent="space-between"
            >
                <Stack direction="row" gap={2} sx={{ alignItems: 'center' }}>
                    <Typography level="h2">
                        {t('ui.downloadManagerTitle')}
                    </Typography>
                    {allItems.length}
                </Stack>
                {!isCompact && (
                    <NewDownloadButton onClick={openNewDownload} />
                )}
            </Stack>

            <Suspense fallback={<CircularProgress />}>
                <NewDownloadDialog
                    isOpen={newDownloadDialogOpen}
                    onClose={() => setNewDownloadDialogOpen(false)}
                />
            </Suspense>

            {isCompact ? (
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={1}
                    sx={{ mb: 3, flexShrink: 0 }}
                >
                    <Stack direction="row" gap={1} flexWrap="wrap" sx={{ flex: 1, minWidth: 0 }}>
                        {filterChips}
                    </Stack>
                    <NewDownloadButton compact onClick={openNewDownload} />
                </Stack>
            ) : (
                <Stack direction="row" gap={2} sx={{ mb: 3, flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
                    {filterChips}
                </Stack>
            )}

            {filteredItems.length > 0 ? (
                <Sheet
                    variant="outlined"
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        borderRadius: 'md',
                        overflow: 'hidden',
                        position: 'relative',
                    }}
                >
                    <Box sx={{ position: 'absolute', inset: 0 }}>
                        <VirtuosoGrid
                            key={`${selectedFilter}-${isCompact ? 'compact' : 'default'}`}
                            style={{ height: '100%', width: '100%' }}
                            totalCount={filteredItems.length}
                            components={gridComponents}
                            itemContent={(index) => (
                                <IpaIcon
                                    item={filteredItems[index]}
                                    size={gridLayout.iconSize}
                                    onOpenDetail={openDetailDrawer}
                                />
                            )}
                        />
                    </Box>
                </Sheet>
            ) : (
                <Box sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                }}>
                    <Typography level="body-lg" sx={{ color: 'text.secondary' }}>
                        {t('ui.noRecords')}
                    </Typography>
                    <Typography
                        level="body-sm"
                        sx={{ color: 'text.tertiary', mt: 1, cursor: selectedFilter === 'all' ? 'auto' : 'pointer' }}
                        onClick={() => { setSelectedFilter('all'); }}
                    >
                        {selectedFilter === 'all' ? t('ui.goToHomeSearch') : t('ui.clearFilter')}
                    </Typography>
                </Box>
            )}

            <IpaDetailDrawer
                item={selectedDetailItem}
                open={detailDrawerOpen}
                onClose={closeDetailDrawer}
                onExitComplete={handleDetailExitComplete}
            />

            {fileList.totalSize > 0 && (
                <Box sx={{
                    flexShrink: 0,
                    mt: 1,
                    p: 1,
                    px: 1.8,
                    backgroundColor: 'background.level1',
                    borderRadius: 'md',
                }}>
                    <Typography
                        level="body-xs"
                        startDecorator={<InfoOutlined sx={{ fontSize: 14, opacity: 0.7 }} />}
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('ui.totalFiles', { count: fileList.total, size: formatFileSize(fileList.totalSize) })}
                    </Typography>
                </Box>
            )}
        </Box>
    );
}

