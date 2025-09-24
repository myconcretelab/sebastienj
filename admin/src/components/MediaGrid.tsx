import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import ImageIcon from '@mui/icons-material/ImageRounded';
import { MediaNode } from '../api/types.js';

interface Props {
  medias: MediaNode[];
  selectedPaths: string[];
  primarySelectedPath?: string;
  onSelectionChange: (paths: string[], primary?: string) => void;
  onReorder: (nextOrder: string[]) => void;
}

const MEDIA_DRAG_TYPE = 'application/x-media-path';
const THUMB_SIZE = 160;

const isSameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export const MediaGrid: React.FC<Props> = ({
  medias,
  selectedPaths,
  primarySelectedPath,
  onSelectionChange,
  onReorder
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [tailActive, setTailActive] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  const committedOrderRef = useRef<string[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const marqueeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeBaseSelectionRef = useRef<string[]>([]);
  const marqueeBasePrimaryRef = useRef<string | undefined>(undefined);
  const containerRectRef = useRef<DOMRect | null>(null);
  const hasDraggedRef = useRef(false);
  const [marqueeRect, setMarqueeRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const selectionAnchorRef = useRef<string | null>(primarySelectedPath ?? null);

  useEffect(() => {
    committedOrderRef.current = medias.map((media) => media.path);
    setPreviewOrder(null);
    setDraggingId(null);
    setDragOverId(null);
    setTailActive(false);
  }, [medias]);

  useEffect(() => {
    if (primarySelectedPath) {
      selectionAnchorRef.current = primarySelectedPath;
    }
    if (selectedPaths.length === 0) {
      selectionAnchorRef.current = null;
    }
  }, [primarySelectedPath, selectedPaths.length]);

  const baseOrder = useMemo(() => medias.map((media) => media.path), [medias]);

  const orderedMedias = useMemo(() => {
    if (!previewOrder) return medias;
    const map = new Map(medias.map((media) => [media.path, media]));
    const arranged: MediaNode[] = [];
    previewOrder.forEach((path) => {
      const media = map.get(path);
      if (media) arranged.push(media);
    });
    medias.forEach((media) => {
      if (!previewOrder.includes(media.path)) {
        arranged.push(media);
      }
    });
    return arranged;
  }, [previewOrder, medias]);

  const mediaPaths = useMemo(() => orderedMedias.map((media) => media.path), [orderedMedias]);
  const orderMap = useMemo(() => {
    const map = new Map<string, number>();
    orderedMedias.forEach((media, index) => {
      map.set(media.path, index);
    });
    return map;
  }, [orderedMedias]);

  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);

  const sortSelection = useCallback(
    (paths: Iterable<string>) => {
      const unique = Array.from(new Set(paths));
      unique.sort((a, b) => {
        const aIndex = orderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = orderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      });
      return unique;
    },
    [orderMap]
  );

  const commitSelection = useCallback(
    (paths: Iterable<string>, primary?: string) => {
      const ordered = sortSelection(paths);
      let nextPrimary = primary;
      if (ordered.length === 0) {
        nextPrimary = undefined;
      } else if (!nextPrimary || !ordered.includes(nextPrimary)) {
        if (primarySelectedPath && ordered.includes(primarySelectedPath)) {
          nextPrimary = primarySelectedPath;
        } else {
          nextPrimary = ordered[ordered.length - 1];
        }
      }

      if (isSameOrder(ordered, selectedPaths) && nextPrimary === primarySelectedPath) {
        return;
      }

      onSelectionChange(ordered, nextPrimary);
    },
    [sortSelection, selectedPaths, primarySelectedPath, onSelectionChange]
  );

  const updatePreviewOrder = (nextOrder: string[]) => {
    setPreviewOrder((current) => {
      if (current) {
        return isSameOrder(current, nextOrder) ? current : nextOrder;
      }
      return isSameOrder(baseOrder, nextOrder) ? current : nextOrder;
    });
  };

  const previewReorderTo = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const currentOrder = previewOrder ?? baseOrder;
    const fromIndex = currentOrder.indexOf(draggingId);
    const toIndex = currentOrder.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const nextOrder = [...currentOrder];
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, draggingId);
    updatePreviewOrder(nextOrder);
  };

  const previewMoveToEnd = () => {
    if (!draggingId) return;
    const currentOrder = previewOrder ?? baseOrder;
    const fromIndex = currentOrder.indexOf(draggingId);
    if (fromIndex === -1 || fromIndex === currentOrder.length - 1) return;
    const nextOrder = [...currentOrder];
    nextOrder.splice(fromIndex, 1);
    nextOrder.push(draggingId);
    updatePreviewOrder(nextOrder);
  };

  const isMediaDrag = (event: React.DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes(MEDIA_DRAG_TYPE);

  const commitOrder = (nextOrder: string[]) => {
    if (isSameOrder(nextOrder, committedOrderRef.current)) {
      return;
    }
    setPreviewOrder(nextOrder);
    committedOrderRef.current = nextOrder;
    onReorder(nextOrder);
  };

  const handleDragEnd = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.dropEffect === 'none') {
      setPreviewOrder(null);
    }
    setDraggingId(null);
    setDragOverId(null);
    setTailActive(false);
  };

  const handleTileClick = (event: React.MouseEvent<HTMLDivElement>, media: MediaNode) => {
    event.preventDefault();
    const shift = event.shiftKey;
    const toggle = event.metaKey || event.ctrlKey;

    if (shift) {
      const anchor =
        selectionAnchorRef.current ??
        primarySelectedPath ??
        selectedPaths[selectedPaths.length - 1] ??
        media.path;
      const anchorIndex = orderMap.get(anchor);
      const targetIndex = orderMap.get(media.path);
      if (anchorIndex === undefined || targetIndex === undefined) {
        commitSelection([media.path], media.path);
        return;
      }
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      const range = orderedMedias.slice(start, end + 1).map((item) => item.path);
      commitSelection(range, media.path);
      return;
    }

    if (toggle) {
      const current = new Set(selectedPaths);
      if (current.has(media.path)) {
        current.delete(media.path);
      } else {
        current.add(media.path);
      }
      const ordered = sortSelection(current);
      const nextPrimary = current.has(media.path)
        ? media.path
        : primarySelectedPath === media.path
        ? ordered[ordered.length - 1]
        : primarySelectedPath;
      selectionAnchorRef.current = media.path;
      commitSelection(ordered, nextPrimary);
      return;
    }

    selectionAnchorRef.current = media.path;
    commitSelection([media.path], media.path);
  };

  const handleContainerMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-role="thumbnail"]')) return;

    const container = containerRef.current;
    if (!container) return;

    event.preventDefault();

    const additive = event.metaKey || event.ctrlKey;
    marqueeOriginRef.current = { x: event.clientX, y: event.clientY };
    containerRectRef.current = container.getBoundingClientRect();
    marqueeBaseSelectionRef.current = additive ? [...selectedPaths] : [];
    marqueeBasePrimaryRef.current = additive ? primarySelectedPath : undefined;
    hasDraggedRef.current = false;

    setMarqueeRect({
      left: event.clientX - containerRectRef.current.left,
      top: event.clientY - containerRectRef.current.top,
      width: 0,
      height: 0
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!marqueeOriginRef.current || !containerRectRef.current) return;
      hasDraggedRef.current = true;

      const { x: startX, y: startY } = marqueeOriginRef.current;
      const currentX = moveEvent.clientX;
      const currentY = moveEvent.clientY;

      const rectLeft = Math.min(startX, currentX);
      const rectTop = Math.min(startY, currentY);
      const rectRight = Math.max(startX, currentX);
      const rectBottom = Math.max(startY, currentY);

      setMarqueeRect({
        left: rectLeft - containerRectRef.current.left,
        top: rectTop - containerRectRef.current.top,
        width: rectRight - rectLeft,
        height: rectBottom - rectTop
      });

      const tiles = container.querySelectorAll<HTMLElement>('[data-role="thumbnail"]');
      const next = new Set(additive ? marqueeBaseSelectionRef.current : []);
      tiles.forEach((tile) => {
        const bounds = tile.getBoundingClientRect();
        const intersects =
          bounds.right >= rectLeft &&
          bounds.left <= rectRight &&
          bounds.bottom >= rectTop &&
          bounds.top <= rectBottom;
        const path = tile.dataset.path;
        if (!path) return;
        if (intersects) {
          next.add(path);
        } else if (!additive) {
          next.delete(path);
        }
      });
      commitSelection(next);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setMarqueeRect(null);
      marqueeOriginRef.current = null;
      containerRectRef.current = null;
      if (!hasDraggedRef.current) {
        commitSelection(marqueeBaseSelectionRef.current, marqueeBasePrimaryRef.current);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  if (medias.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, opacity: 0.7 }}>
        <Typography variant="subtitle1">Ce dossier attend encore sa première image.</Typography>
        <Typography variant="body2">Glissez-déposez vos créations n'importe où sur la page pour les importer ici.</Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onMouseDown={handleContainerMouseDown}
      sx={{
        position: 'relative',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '15px',
        alignContent: 'flex-start'
      }}
    >
      {marqueeRect && (
        <Box
          sx={{
            position: 'absolute',
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
            border: '1px dashed rgba(61, 111, 217, 0.8)',
            backgroundColor: 'rgba(61, 111, 217, 0.12)',
            pointerEvents: 'none',
            zIndex: 2
          }}
        />
      )}

      {orderedMedias.map((media) => {
        const thumbnails = media.thumbnails && Object.keys(media.thumbnails).length > 0 ? media.thumbnails : undefined;
        const primary = thumbnails ? thumbnails.thumb || Object.values(thumbnails)[0] : undefined;
        const previewPath = primary?.defaultPath;
        const isDragging = draggingId === media.path;
        const isDragTarget = dragOverId === media.path;
        const isSelected = selectedSet.has(media.path);

        return (
          <Box
            key={media.path}
            data-role="thumbnail"
            data-path={media.path}
            onClick={(event) => handleTileClick(event, media)}
            draggable
            onDragStart={(event: React.DragEvent<HTMLDivElement>) => {
              const dragPaths = selectedSet.has(media.path) ? [...selectedPaths] : [media.path];
              if (!selectedSet.has(media.path)) {
                selectionAnchorRef.current = media.path;
                commitSelection(dragPaths, media.path);
              }
              setDraggingId(media.path);
              setDragOverId(null);
              setTailActive(false);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify(dragPaths));
              event.dataTransfer.setData('text/plain', dragPaths.join('\n'));
              const node = event.currentTarget;
              const rect = node.getBoundingClientRect();
              if (event.dataTransfer.setDragImage) {
                event.dataTransfer.setDragImage(node, rect.width / 2, rect.height / 2);
              }
            }}
            onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
              if (!isMediaDrag(event) || !draggingId || draggingId === media.path) return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = 'move';
              setDragOverId(media.path);
              setTailActive(false);
              previewReorderTo(media.path);
            }}
            onDragEnter={(event: React.DragEvent<HTMLDivElement>) => {
              if (!isMediaDrag(event) || !draggingId || draggingId === media.path) return;
              event.preventDefault();
              event.stopPropagation();
              setDragOverId(media.path);
              setTailActive(false);
              previewReorderTo(media.path);
            }}
            onDragLeave={(event: React.DragEvent<HTMLDivElement>) => {
              if (!isMediaDrag(event)) return;
              const related = event.relatedTarget as Node | null;
              if (!related || !event.currentTarget.contains(related)) {
                setDragOverId((current) => (current === media.path ? null : current));
              }
            }}
            onDrop={(event: React.DragEvent<HTMLDivElement>) => {
              if (!isMediaDrag(event) || !draggingId) return;
              event.preventDefault();
              event.stopPropagation();
              setDragOverId(null);
              setTailActive(false);
              if (draggingId === media.path) return;
              const finalOrder = previewOrder ?? mediaPaths;
              commitOrder(finalOrder);
            }}
            onDragEnd={handleDragEnd}
            sx={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              border: '1px solid rgba(120, 130, 140, 0.45)',
              borderRadius: 0,
              overflow: 'hidden',
              backgroundColor: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              outline: isSelected ? '2px solid #3d6fd9' : 'none',
              outlineOffset: isSelected ? '5px' : '0px',
              boxShadow: isDragTarget ? '0 0 0 2px rgba(111,137,166,0.6) inset' : 'none',
              opacity: isDragging ? 0.6 : 1,
              transition: 'opacity 120ms ease, outline 120ms ease, box-shadow 120ms ease'
            }}
          >
            {previewPath ? (
              <img
                src={`/api/media${previewPath}`}
                alt={media.title || media.name}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <ImageIcon fontSize="large" color="disabled" />
            )}
          </Box>
        );
      })}
      <Box
        onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
          if (!isMediaDrag(event) || !draggingId) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
          setDragOverId(null);
          setTailActive(true);
          previewMoveToEnd();
        }}
        onDrop={(event: React.DragEvent<HTMLDivElement>) => {
          if (!isMediaDrag(event) || !draggingId) return;
          event.preventDefault();
          event.stopPropagation();
          setTailActive(false);
          const finalOrder = previewOrder ?? mediaPaths;
          commitOrder(finalOrder);
        }}
        onDragLeave={(event: React.DragEvent<HTMLDivElement>) => {
          if (!isMediaDrag(event)) return;
          const related = event.relatedTarget as Node | null;
          if (!related || !event.currentTarget.contains(related)) {
            setTailActive(false);
          }
        }}
        onDragEnd={handleDragEnd}
        sx={{
          flexBasis: '100%',
          minHeight: 32,
          borderRadius: 2,
          border: tailActive ? '2px dashed #6f89a6' : '2px dashed transparent',
          transition: 'border 120ms ease'
        }}
      />
    </Box>
  );
};
