import React from 'react';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import { Box, Button, Sheet, Stack, Typography } from '@mui/joy';

const containSx = {
    minWidth: 0,
    maxWidth: '100%',
};

const scrollRowSx = {
    display: 'flex',
    gap: 1.5,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    overscrollBehaviorX: 'contain',
    pb: 0.5,
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'thin',
    '& img': {
        scrollSnapAlign: 'start',
    },
};

const pictureImgSx = {
    display: 'block',
    width: 'auto',
    maxWidth: 'none',
    borderRadius: 'md',
    boxShadow: 'sm',
};

function ScreenshotPicture({ item, sizes, imageHeight }) {
    return (
        <Box
            sx={{
                flexShrink: 0,
                '& [data-rmiz-content]': {
                    display: 'block',
                    lineHeight: 0,
                },
            }}
        >
            <Zoom zoomImg={{ src: item.zoomSrc }}>
                <picture style={{ display: 'block', margin: 0 }}>
                    <source srcSet={item.srcSet} sizes={sizes} />
                    <Box
                        component="img"
                        src={item.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        sx={{
                            ...pictureImgSx,
                            height: imageHeight,
                        }}
                    />
                </picture>
            </Zoom>
        </Box>
    );
}

function ScreenshotRow({ items, sizes, imageHeight = { xs: 200, sm: 240 } }) {
    return (
        <Box sx={{ ...containSx, overflow: 'hidden' }}>
            <Box sx={scrollRowSx}>
                {items.map((item, index) => (
                    <ScreenshotPicture
                        key={`${item.src}-${index}`}
                        item={item}
                        sizes={sizes}
                        imageHeight={imageHeight}
                    />
                ))}
            </Box>
        </Box>
    );
}

export default function AppScreenshots({
    phoneGroup,
    ipadGroup,
    showGallery,
    onLoadOnce,
    title,
    phoneTitle,
    ipadTitle,
    loadOnceLabel,
    emptyLabel,
}) {
    const hasPhone = Boolean(phoneGroup?.items?.length);
    const hasIpad = Boolean(ipadGroup?.items?.length);
    const hasAnyScreenshot = hasPhone || hasIpad;
    const showSeparateSections = hasPhone && hasIpad;

    if (!showGallery) {
        return (
            <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'md', ...containSx }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5}>
                    <Typography level="title-sm">{title}</Typography>
                    <Button size="sm" variant="soft" onClick={onLoadOnce}>
                        {loadOnceLabel}
                    </Button>
                </Stack>
            </Sheet>
        );
    }

    if (!hasAnyScreenshot) {
        return (
            <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'md', ...containSx }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>{title}</Typography>
                <Typography level="body-sm" sx={{ color: 'text.tertiary' }}>{emptyLabel}</Typography>
            </Sheet>
        );
    }

    const renderSection = (group, sectionTitle, sizes, imageHeight) => (
        <Stack key={sectionTitle} gap={1} sx={containSx}>
            {showSeparateSections && (
                <Typography level="body-sm" fontWeight="md">{sectionTitle}</Typography>
            )}
            <ScreenshotRow
                items={group.items}
                sizes={sizes}
                imageHeight={imageHeight}
            />
        </Stack>
    );

    return (
        <Sheet variant="outlined" sx={{ p: 2, borderRadius: 'md', ...containSx, overflow: 'hidden' }}>
            <Typography level="title-sm" sx={{ mb: 1.5 }}>{title}</Typography>
            <Stack gap={2} sx={containSx}>
                {hasPhone && renderSection(
                    phoneGroup,
                    phoneTitle,
                    '(max-width: 600px) 200px, 240px',
                    { xs: 200, sm: 240 },
                )}
                {hasIpad && renderSection(
                    ipadGroup,
                    ipadTitle,
                    '(max-width: 600px) 160px, 200px',
                    { xs: 160, sm: 200 },
                )}
            </Stack>
        </Sheet>
    );
}
