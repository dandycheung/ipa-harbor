import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    MouseSensor,
    TouchSensor,
    closestCenter,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS, getEventCoordinates } from '@dnd-kit/utilities';
import {
    Autocomplete,
    AutocompleteOption,
    Button,
    ListItemContent,
    Modal,
    ModalClose,
    Typography,
} from '@mui/joy';
import { useTranslation } from 'react-i18next';
import ResponsiveModalDialog from './ResponsiveModalDialog';
import {
    FILENAME_VARIABLE_KEYS,
    FILENAME_TEXT_PRESETS,
    FILENAME_PREVIEW_SAMPLE,
    DATE_FORMAT_PRESETS,
    buildFileNameFromTemplate,
    cloneTemplate,
    createTextSegment,
    createVariableSegment,
    normalizeTemplate,
    countVariableSegments,
    getVariableLabelKey,
    getTextPresetLabelKey,
    getTextPresetByKey,
    getTextPresetByValue,
    getTextPresetKeyFromPaletteId,
    getVariableKeyFromPaletteId,
    paletteTextId,
    paletteVariableId,
    isPaletteTextId,
    isDateVariableKey,
    getSegmentFormat,
    getDateFormatPreset,
    getValidDateFormat,
} from '../utils/filenameTemplate';
import './FilenameTemplateEditor.css';

const CANVAS_ZONE_ID = 'filename-zone-canvas';
const PALETTE_ZONE_ID = 'filename-zone-palette';
// 鼠标：移动超过距离才进入拖拽，轻点即 click
const DRAG_ACTIVATION_DISTANCE = 8;
// 触控：Pointer 统一 delay 容易和 tap 冲突，Touch 单独用短 delay + tolerance
const TOUCH_DRAG_DELAY_MS = 200;
const TOUCH_DRAG_TOLERANCE = 8;
const CLICK_GUARD_MS = 50;

const DATE_FORMAT_GROUP_LABEL_KEYS = {
    Numeric: 'ui.filenameDateFormatGroupNumeric',
    'Full month': 'ui.filenameDateFormatGroupFullMonth',
    'Short month': 'ui.filenameDateFormatGroupShortMonth',
    'Month / Year': 'ui.filenameDateFormatGroupMonthYear',
    Year: 'ui.filenameDateFormatGroupYear',
    'Date + Time': 'ui.filenameDateFormatGroupDateTime',
};

function disableSortingStrategy() {
    return null;
}

let nextCanvasItemId = 0;

// dnd-kit 需要稳定的列表项 id；时间戳 + 计数器，非安全上下文无法使用 crypto 会导致白屏 
function createCanvasItemId() {
    nextCanvasItemId += 1;
    return `${Date.now()}-${nextCanvasItemId}`;
}

function syncItemIds(idsRef, length) {
    while (idsRef.current.length < length) {
        idsRef.current.push(createCanvasItemId());
    }

    if (idsRef.current.length > length) {
        idsRef.current.length = length;
    }
}

function buildCanvasItems(segments, idsRef) {
    syncItemIds(idsRef, segments.length);
    return segments.map((segment, index) => ({
        id: idsRef.current[index],
        segment,
    }));
}

function isPointInRect(x, y, rect) {
    if (!rect) {
        return false;
    }

    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function resolveZoneByPointer(pointer, canvasZoneRef, paletteZoneRef) {
    const canvasRect = canvasZoneRef.current?.getBoundingClientRect();
    if (isPointInRect(pointer.x, pointer.y, canvasRect)) {
        return 'canvas';
    }

    const paletteRect = paletteZoneRef.current?.getBoundingClientRect();
    if (isPointInRect(pointer.x, pointer.y, paletteRect)) {
        return 'palette';
    }

    return null;
}

function resolveInsertIndex(over, canvasIds) {
    if (!over) {
        return -1;
    }

    if (canvasIds.includes(over.id)) {
        return canvasIds.indexOf(over.id);
    }

    return canvasIds.length;
}

function DropZoneFrame({ zoneId, isOver, variant = 'canvas', zoneRef, children }) {
    const { setNodeRef } = useDroppable({ id: zoneId });

    const setCombinedRef = useCallback((node) => {
        setNodeRef(node);
        if (zoneRef) {
            zoneRef.current = node;
        }
    }, [setNodeRef, zoneRef]);

    const className = [
        'drop',
        variant === 'palette' ? 'palette' : '',
        isOver ? 'over' : '',
    ].filter(Boolean).join(' ');

    return (
        <div ref={setCombinedRef} className={className}>
            {children}
        </div>
    );
}

function SpaceIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M10.75 11.25v.75h-5.5v-.75a.5.5 0 0 0-1 0V12c0 .69.56 1.25 1.25 1.25h5c.69 0 1.25-.56 1.25-1.25v-.75a.5.5 0 0 0-1 0Z" />
        </svg>
    );
}

function isSpaceTextSegment(segment) {
    return segment?.type === 'text' && segment.value === ' ';
}

function SegmentChip({ segment, label, isClone = false }) {
    const chipClassName = [
        'chip',
        segment.type === 'variable' ? 'var' : 'text',
        isClone ? 'clone' : '',
        isSpaceTextSegment(segment) ? 'icon' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={chipClassName}>
            {isSpaceTextSegment(segment) ? (
                <span className="chipIcon" aria-label={label}>
                    <SpaceIcon />
                </span>
            ) : (
                <span className="chipLabel">{label}</span>
            )}
        </div>
    );
}

function SortableCanvasChip({ id, segment, label, onRemove, onEditFormat, dragStartedRef }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.28 : 1,
    };

    const handleClick = () => {
        if (dragStartedRef.current) {
            return;
        }

        onRemove(id);
    };

    const handleContextMenu = (event) => {
        if (!isDateVariableKey(segment.key)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        onEditFormat(id);
    };

    return (
        <div ref={setNodeRef} style={style} className="item">
            <button
                type="button"
                className="chipBtn"
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                {...attributes}
                {...listeners}
            >
                <SegmentChip segment={segment} label={label} />
            </button>
        </div>
    );
}

function DraggablePaletteChip({ id, segment, label, onAdd, dragStartedRef }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

    const handleClick = () => {
        if (dragStartedRef.current) {
            return;
        }

        onAdd(id);
    };

    return (
        <div
            ref={setNodeRef}
            className="item"
            style={{ opacity: isDragging ? 0.28 : 1 }}
        >
            <button
                type="button"
                className="chipBtn"
                onClick={handleClick}
                {...attributes}
                {...listeners}
            >
                <SegmentChip segment={segment} label={label} />
            </button>
        </div>
    );
}

function DateFormatModal({ open, segment, onClose, onSave }) {
    const { t } = useTranslation();
    const [selectedPreset, setSelectedPreset] = useState(null);

    useEffect(() => {
        if (!open || !segment) {
            setSelectedPreset(null);
            return;
        }

        const format = getSegmentFormat(segment);
        setSelectedPreset(getDateFormatPreset(format));
    }, [open, segment]);

    const handleSave = () => {
        if (!selectedPreset) {
            return;
        }

        onSave(selectedPreset.value);
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose}>
            <ResponsiveModalDialog sx={{ minWidth: 360, maxWidth: 520 }}>
                <ModalClose />
                <Typography level="h4" sx={{ mb: 0.5 }}>
                    {t('ui.filenameDateFormatTitle')}
                </Typography>
                <Typography level="body-sm" sx={{ mb: 2, color: 'text.tertiary' }}>
                    {segment ? t(getVariableLabelKey(segment.key)) : ''}
                </Typography>

                <Autocomplete
                    options={DATE_FORMAT_PRESETS}
                    value={selectedPreset}
                    onChange={(event, newValue) => setSelectedPreset(newValue)}
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(option, value) => option.value === value.value}
                    groupBy={(option) => t(DATE_FORMAT_GROUP_LABEL_KEYS[option.group] || option.group)}
                    slotProps={{
                        listbox: {
                            sx: { maxHeight: 320 },
                        },
                    }}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                            <AutocompleteOption key={key} {...otherProps}>
                                <ListItemContent>
                                    <Typography level="body-md">{option.label}</Typography>
                                    <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                                        {option.value}
                                    </Typography>
                                </ListItemContent>
                            </AutocompleteOption>
                        );
                    }}
                />

                <Button sx={{ mt: 2 }} fullWidth onClick={handleSave} disabled={!selectedPreset}>
                    {t('ui.confirm')}
                </Button>
            </ResponsiveModalDialog>
        </Modal>
    );
}

export default function FilenameTemplateEditor({
    value,
    onChange,
    previewContext = FILENAME_PREVIEW_SAMPLE,
    previewOnly = false,
}) {
    const { t } = useTranslation();
    const [hint, setHint] = useState('');
    const [hoverZone, setHoverZone] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [overZone, setOverZone] = useState(null);
    const [formatEditId, setFormatEditId] = useState(null);
    const itemIdsRef = useRef([]);
    const canvasZoneRef = useRef(null);
    const paletteZoneRef = useRef(null);
    const dragStartPointerRef = useRef({ x: 0, y: 0 });
    const pointerRef = useRef({ x: 0, y: 0 });
    const dragStartedRef = useRef(false);
    const clickGuardTimerRef = useRef(null);
    const hintTimerRef = useRef(null);

    const segments = useMemo(() => normalizeTemplate(value), [value]);

    const canvasItems = useMemo(
        () => buildCanvasItems(segments, itemIdsRef),
        [segments]
    );

    const canvasIds = useMemo(() => canvasItems.map((item) => item.id), [canvasItems]);

    const paletteIds = useMemo(
        () => [
            ...FILENAME_VARIABLE_KEYS.map(paletteVariableId),
            ...FILENAME_TEXT_PRESETS.map((preset) => paletteTextId(preset.key)),
        ],
        []
    );

    const previewName = useMemo(
        () => buildFileNameFromTemplate(segments, previewContext, { withExtension: true }),
        [segments, previewContext]
    );

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: DRAG_ACTIVATION_DISTANCE,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: TOUCH_DRAG_DELAY_MS,
                tolerance: TOUCH_DRAG_TOLERANCE,
            },
        })
    );

    const releaseClickGuard = useCallback(() => {
        if (clickGuardTimerRef.current) {
            clearTimeout(clickGuardTimerRef.current);
        }

        // 拖拽结束后 pointerup 仍可能触发 click，短暂屏蔽
        clickGuardTimerRef.current = setTimeout(() => {
            dragStartedRef.current = false;
            clickGuardTimerRef.current = null;
        }, CLICK_GUARD_MS);
    }, []);

    const updatePointerFromDragEvent = useCallback((event) => {
        pointerRef.current = {
            x: dragStartPointerRef.current.x + event.delta.x,
            y: dragStartPointerRef.current.y + event.delta.y,
        };
    }, []);

    const updateSegments = useCallback((nextSegments) => {
        onChange(normalizeTemplate(nextSegments));
    }, [onChange]);

    const getTextLabel = useCallback((value) => {
        const preset = getTextPresetByValue(value);
        if (preset) {
            return t(getTextPresetLabelKey(preset.key));
        }

        return value === '' ? t('ui.filenameEmptyText') : value;
    }, [t]);

    const getSegmentLabel = useCallback((segment) => {
        if (segment.type === 'text') {
            return getTextLabel(segment.value);
        }

        const label = t(getVariableLabelKey(segment.key));
        if (isDateVariableKey(segment.key)) {
            const preset = getDateFormatPreset(getSegmentFormat(segment));
            return preset ? `${label} (${preset.label})` : label;
        }

        return label;
    }, [getTextLabel, t]);

    const segmentFromPaletteId = useCallback((paletteId) => {
        if (isPaletteTextId(paletteId)) {
            const presetKey = getTextPresetKeyFromPaletteId(paletteId);
            const preset = presetKey ? getTextPresetByKey(presetKey) : null;
            return preset ? createTextSegment(preset.value) : null;
        }

        const key = getVariableKeyFromPaletteId(paletteId);
        return key ? createVariableSegment(key) : null;
    }, []);

    const flashHint = useCallback((message) => {
        setHint(message);
        if (hintTimerRef.current) {
            clearTimeout(hintTimerRef.current);
        }
        hintTimerRef.current = setTimeout(() => {
            setHint('');
            hintTimerRef.current = null;
        }, 2000);
    }, []);

    const removeCanvasById = useCallback((id, { showHint = true } = {}) => {
        const index = canvasIds.indexOf(id);
        if (index < 0) {
            return false;
        }

        const segment = segments[index];
        if (segment.type === 'variable' && countVariableSegments(segments) <= 1) {
            if (showHint) {
                flashHint(t('ui.filenameNeedVariable'));
            }
            return false;
        }

        const next = cloneTemplate(segments);
        next.splice(index, 1);
        itemIdsRef.current.splice(index, 1);
        updateSegments(next);
        return true;
    }, [canvasIds, flashHint, segments, t, updateSegments]);

    const insertSegmentAt = useCallback((segment, index) => {
        if (!segment) {
            return;
        }

        const next = cloneTemplate(segments);
        const insertAt = index < 0 ? next.length : Math.min(index, next.length);
        next.splice(insertAt, 0, segment);
        itemIdsRef.current.splice(insertAt, 0, createCanvasItemId());
        updateSegments(next);
    }, [segments, updateSegments]);

    const updateCanvasSegmentFormat = useCallback((canvasId, format) => {
        const index = canvasIds.indexOf(canvasId);
        if (index < 0) {
            return;
        }

        const segment = segments[index];
        if (!segment || segment.type !== 'variable' || !isDateVariableKey(segment.key)) {
            return;
        }

        const next = cloneTemplate(segments);
        next[index] = {
            ...next[index],
            options: { format: getValidDateFormat(format) },
        };
        updateSegments(next);
    }, [canvasIds, segments, updateSegments]);

    const formatEditSegment = useMemo(() => {
        if (!formatEditId) {
            return null;
        }

        const index = canvasIds.indexOf(formatEditId);
        return index >= 0 ? segments[index] : null;
    }, [canvasIds, formatEditId, segments]);

    const dragOrigin = useMemo(() => {
        if (!activeId) {
            return null;
        }

        return canvasIds.includes(activeId) ? 'canvas' : 'palette';
    }, [activeId, canvasIds]);

    const activeOverlay = useMemo(() => {
        if (!activeId) {
            return null;
        }

        const canvasItem = canvasItems.find((item) => item.id === activeId);
        if (canvasItem) {
            return {
                segment: canvasItem.segment,
                label: getSegmentLabel(canvasItem.segment),
            };
        }

        const segment = segmentFromPaletteId(activeId);
        if (!segment) {
            return null;
        }

        return {
            segment,
            label: getSegmentLabel(segment),
        };
    }, [activeId, canvasItems, getSegmentLabel, segmentFromPaletteId]);

    const handleDragStart = useCallback((event) => {
        const coords = getEventCoordinates(event.activatorEvent);
        dragStartPointerRef.current = coords;
        pointerRef.current = coords;
        dragStartedRef.current = true;
        setActiveId(event.active.id);
    }, []);

    const handleDragMove = useCallback((event) => {
        updatePointerFromDragEvent(event);
        setOverZone(resolveZoneByPointer(pointerRef.current, canvasZoneRef, paletteZoneRef));
    }, [updatePointerFromDragEvent]);

    const handleDragCancel = useCallback(() => {
        setActiveId(null);
        setOverZone(null);
        releaseClickGuard();
    }, [releaseClickGuard]);

    const handleDragOver = useCallback((event) => {
        const { active, over } = event;

        updatePointerFromDragEvent(event);
        setOverZone(resolveZoneByPointer(pointerRef.current, canvasZoneRef, paletteZoneRef));

        if (!over || active.id === over.id) {
            return;
        }

        if (resolveZoneByPointer(pointerRef.current, canvasZoneRef, paletteZoneRef) !== 'canvas') {
            return;
        }

        if (!canvasIds.includes(active.id) || !canvasIds.includes(over.id)) {
            return;
        }

        const oldIndex = canvasIds.indexOf(active.id);
        const newIndex = canvasIds.indexOf(over.id);

        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
            return;
        }

        itemIdsRef.current = arrayMove(itemIdsRef.current, oldIndex, newIndex);
        updateSegments(arrayMove(segments, oldIndex, newIndex));
    }, [canvasIds, segments, updatePointerFromDragEvent, updateSegments]);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        const origin = dragOrigin;

        updatePointerFromDragEvent(event);
        const dropZone = resolveZoneByPointer(pointerRef.current, canvasZoneRef, paletteZoneRef);

        setActiveId(null);
        setOverZone(null);
        releaseClickGuard();

        if (!origin) {
            return;
        }

        if (origin === 'canvas') {
            if (dropZone !== 'canvas') {
                removeCanvasById(active.id);
            }
            return;
        }

        if (origin === 'palette' && dropZone === 'canvas') {
            insertSegmentAt(segmentFromPaletteId(active.id), resolveInsertIndex(over, canvasIds));
        }
    }, [canvasIds, dragOrigin, insertSegmentAt, releaseClickGuard, removeCanvasById, segmentFromPaletteId, updatePointerFromDragEvent]);

    useEffect(() => {
        syncItemIds(itemIdsRef, segments.length);
    }, [value]);

    useEffect(() => () => {
        if (hintTimerRef.current) {
            clearTimeout(hintTimerRef.current);
        }

        if (clickGuardTimerRef.current) {
            clearTimeout(clickGuardTimerRef.current);
        }
    }, []);

    const zoneHint = useMemo(() => {
        if (hint) {
            return hint;
        }

        if (hoverZone === 'palette') {
            return t('ui.filenameEditorHintPalette');
        }

        return t('ui.filenameEditorHintCanvas');
    }, [hint, hoverZone, t]);

    const previewBlock = (
        <div className="preview">
            <span className="previewLabel">{t('ui.filenamePreview')}</span>
            <p className="previewValue">{previewName}</p>
        </div>
    );

    if (previewOnly) {
        return (
            <div className="filename-editor">
                {previewBlock}
            </div>
        );
    }

    return (
        <div className="filename-editor">
            {previewBlock}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <p className={`hint${hint ? ' warning' : ''}`}>
                    {zoneHint}
                </p>

                <div
                    className="zones"
                    onMouseLeave={() => setHoverZone(null)}
                >
                    <div
                        className="zone"
                        onMouseEnter={() => setHoverZone('canvas')}
                    >
                        <DropZoneFrame
                            zoneId={CANVAS_ZONE_ID}
                            zoneRef={canvasZoneRef}
                            isOver={dragOrigin === 'palette' && overZone === 'canvas'}
                        >
                            <SortableContext
                                id={CANVAS_ZONE_ID}
                                items={canvasIds}
                                strategy={disableSortingStrategy}
                            >
                                <div className="inner">
                                    {canvasItems.length === 0 ? (
                                        <p className="empty">{t('ui.filenameTemplateEmpty')}</p>
                                    ) : (
                                        canvasItems.map((item) => (
                                            <SortableCanvasChip
                                                key={item.id}
                                                id={item.id}
                                                segment={item.segment}
                                                label={getSegmentLabel(item.segment)}
                                                onRemove={removeCanvasById}
                                                onEditFormat={setFormatEditId}
                                                dragStartedRef={dragStartedRef}
                                            />
                                        ))
                                    )}
                                </div>
                            </SortableContext>
                        </DropZoneFrame>
                    </div>

                    <div
                        className="zone"
                        onMouseEnter={() => setHoverZone('palette')}
                    >
                        <DropZoneFrame
                            zoneId={PALETTE_ZONE_ID}
                            zoneRef={paletteZoneRef}
                            variant="palette"
                            isOver={dragOrigin === 'canvas' && overZone === 'palette'}
                        >
                            <div className="inner">
                                {paletteIds.map((paletteId) => {
                                    const segment = segmentFromPaletteId(paletteId);
                                    if (!segment) {
                                        return null;
                                    }

                                    return (
                                        <DraggablePaletteChip
                                            key={paletteId}
                                            id={paletteId}
                                            segment={segment}
                                            label={getSegmentLabel(segment)}
                                            onAdd={(id) => insertSegmentAt(segmentFromPaletteId(id), segments.length)}
                                            dragStartedRef={dragStartedRef}
                                        />
                                    );
                                })}
                            </div>
                        </DropZoneFrame>
                    </div>
                </div>

                <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
                    {activeOverlay ? (
                        <SegmentChip
                            segment={activeOverlay.segment}
                            label={activeOverlay.label}
                            isClone
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>

            <DateFormatModal
                open={Boolean(formatEditId && formatEditSegment)}
                segment={formatEditSegment}
                onClose={() => setFormatEditId(null)}
                onSave={(format) => updateCanvasSegmentFormat(formatEditId, format)}
            />
        </div>
    );
}
