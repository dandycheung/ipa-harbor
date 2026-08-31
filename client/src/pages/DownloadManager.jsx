import React, { useMemo, useState, useEffect, lazy, Suspense, forwardRef } from 'react';
import { Box, Typography, Chip, Stack, CircularProgress, Sheet, Badge, IconButton } from '@mui/joy';
import { VirtuosoGrid } from 'react-virtuoso';
import { useApp } from '../contexts/AppContext';
import IpaIcon from '../components/IpaIcon';
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
    const [isCompact, setIsCompact] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 599.95px)').matches : false
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 599.95px)');
        const handleChange = (event) => setIsCompact(event.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const gridLayout = isCompact ? GRID_LAYOUT.compact : GRID_LAYOUT.default;
    const gridComponents = useMemo(
        () => createGridComponents({ ...gridLayout, compact: isCompact }),
        [gridLayout.cellWidth, gridLayout.cellHeight, gridLayout.gap, gridLayout.listPadding, isCompact]
    );
    const { taskList, fileList } = useApp();
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [newDownloadDialogOpen, setNewDownloadDialogOpen] = useState(false);

    const allItems = useMemo(() => {
        const items = [];

        ['pending', 'running', 'failed', 'completed'].forEach(status => {
            if (taskList[status]) {
                taskList[status].forEach(task => {
                    // 从任务中提取应用信息
                    const appId = task.appId || task.id;
                    const fileName = task.fileName || `${appId}_${task.versionId || 'latest'}.ipa`;

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
                    // 提取应用ID
                    const appId = file.name.match(/^(\d+)_/)?.[1];

                    items.push({
                        id: appId,
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
                                <IpaIcon item={filteredItems[index]} size={gridLayout.iconSize} />
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

