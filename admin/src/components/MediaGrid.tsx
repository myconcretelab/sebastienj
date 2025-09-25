import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import ImageIcon from '@mui/icons-material/ImageRounded';
import {
  DragOverlay,
  useDndContext,
  useDndMonitor,
  useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MediaNode } from '../api/types.js';

interface Props {
  medias: MediaNode[];
  selectedPaths: string[];
  primarySelectedPath?: string;
  onSelectionChange: (paths: string[], primary?: string) => void;
  onOpenMedia?: (media: MediaNode) => void;
  onReorder?: (nextOrder: string[]) => void | Promise<void>;
}

const THUMB_SIZE = 160;
const TAIL_DROPPABLE_ID = 'media-tail';

const isSameOrder = (a: string[] | null | undefined, b: string[] | null | undefined) => {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

const buildMediaUrl = (input?: string) => {
  if (!input) return undefined;
  if (input.startsWith('/api/media')) return input;
  const isAbsolute =
    /^(?:[a-z]+:)?\/\//i.test(input) ||
    input.startsWith('data:') ||
    input.startsWith('blob:');
  if (isAbsolute) return input;
  const normalized = input.startsWith('/') ? input : `/${input}`;
  return `/api/media${normalized}`;
};

type SortableData = {
  type: 'media';
  path: string;
  media: MediaNode;
};

type TailDropData = {
  type: 'media-tail';
};

type GridDropData = SortableData | TailDropData;

const MultiDragOverlay: React.FC<{ count: number }> = ({ count }) => (
  <Box
    sx={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 1.5,
      px: 2,
      py: 1.25,
      borderRadius: 2,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      border: '1px solid rgba(61, 111, 217, 0.45)',
      boxShadow: '0 18px 32px rgba(9, 14, 35, 0.45)',
      color: '#fff',
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: 0.3
    }}
  >
    <Box
      component="span"
      sx={{
        width: 22,
        height: 22,
        borderRadius: 1.5,
        backgroundColor: 'rgba(255,255,255,0.22)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12
      }}
    >
      {count}
    </Box>
    <Typography component="span" sx={{ fontSize: 13, fontWeight: 600 }}>
      {count === 1 ? 'Déplacer 1 image' : `Déplacer ${count} images`}
    </Typography>
  </Box>
);

const SingleDragOverlay: React.FC<{ media: MediaNode }> = ({ media }) => {
  const thumbs =
    media.thumbnails && Object.keys(media.thumbnails).length > 0
      ? media.thumbnails
      : undefined;
  const primary = thumbs ? thumbs.thumb || Object.values(thumbs)[0] : undefined;
  const previewUrl = buildMediaUrl(primary?.defaultPath);

  return (
    <Box
      sx={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        border: '1px solid rgba(120, 130, 140, 0.45)',
        borderRadius: 1,
        overflow: 'hidden',
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={media.title || media.name}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <ImageIcon fontSize="large" color="disabled" />
      )}
    </Box>
  );
};

const TailDropZone: React.FC<{ active: boolean }> = ({ active }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: TAIL_DROPPABLE_ID,
    data: { type: 'media-tail' } as TailDropData
  });

  const highlight = active || isOver;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        flexBasis: '100%',
        minHeight: 32,
        border: highlight ? '2px dashed #6f89a6' : '2px dashed transparent',
        borderRadius: 1,
        transition: 'border-color 120ms ease'
      }}
    />
  );
};

interface SortableMediaTileProps {
  media: MediaNode;
  isSelected: boolean;
  isDragTarget: boolean;
  onClick: (event: React.MouseEvent<HTMLDivElement>, media: MediaNode) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, media: MediaNode) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>, media: MediaNode) => void;
}

const SortableMediaTile: React.FC<SortableMediaTileProps> = ({
  media,
  isSelected,
  isDragTarget,
  onClick,
  onPointerDown,
  onDoubleClick
}) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: media.path,
    data: { type: 'media', path: media.path, media } as SortableData
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? 'grabbing' : 'grab'
  } as React.CSSProperties;

  const thumbs =
    media.thumbnails && Object.keys(media.thumbnails).length > 0
      ? media.thumbnails
      : undefined;
  const primary = thumbs ? thumbs.thumb || Object.values(thumbs)[0] : undefined;
  const previewUrl = buildMediaUrl(primary?.defaultPath);

  return (
    <Box
      ref={setNodeRef}
      data-role="thumbnail"
      data-path={media.path}
      sx={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        border: '1px solid rgba(120, 130, 140, 0.45)',
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        outline: isSelected ? '2px solid #3d6fd9' : 'none',
        boxShadow: isDragTarget ? '0 0 0 2px rgba(111,137,166,0.6) inset' : 'none',
        opacity: isDragging ? 0.6 : 1,
        borderRadius: 1,
        overflow: 'hidden'
      }}
      style={style}
      onClick={(event) => onClick(event, media)}
      onPointerDown={(event) => onPointerDown(event, media)}
      onDoubleClick={(event) => onDoubleClick?.(event, media)}
      {...attributes}
      {...listeners}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={media.title || media.name}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <ImageIcon fontSize="large" color="disabled" />
      )}
    </Box>
  );
};

export const MediaGrid: React.FC<Props> = ({
  medias,
  selectedPaths,
  primarySelectedPath,
  onSelectionChange,
  onOpenMedia,
  onReorder
}) => {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [tailActive, setTailActive] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const marqueeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeBaseSelectionRef = useRef<string[]>([]);
  const marqueeBasePrimaryRef = useRef<string | undefined>(undefined);
  const containerRectRef = useRef<DOMRect | null>(null);
  const hasDraggedRef = useRef(false);
  const selectionAnchorRef = useRef<string | null>(
    primarySelectedPath ?? null
  );

  const baseOrder = useMemo(() => medias.map((m) => m.path), [medias]);

  const mediaByPath = useMemo(() => {
    const map = new Map<string, MediaNode>();
    medias.forEach((media) => map.set(media.path, media));
    return map;
  }, [medias]);

  useEffect(() => {
    setPreviewOrder((current) => {
      if (!current) return null;
      return isSameOrder(current, baseOrder) ? null : current;
    });
    setDragOverId(null);
    setTailActive(false);
  }, [baseOrder]);

  useEffect(() => {
    if (primarySelectedPath) {
      selectionAnchorRef.current = primarySelectedPath;
    }
    if (selectedPaths.length === 0) {
      selectionAnchorRef.current = null;
    }
  }, [primarySelectedPath, selectedPaths.length]);

  const orderedMedias = useMemo(() => {
    const order = previewOrder ?? baseOrder;
    const arranged: MediaNode[] = [];
    const remaining = new Set(order);

    order.forEach((path) => {
      const media = mediaByPath.get(path);
      if (media) {
        arranged.push(media);
        remaining.delete(path);
      }
    });

    medias.forEach((media) => {
      if (!remaining.has(media.path) && !order.includes(media.path)) {
        arranged.push(media);
      }
    });

    return arranged;
  }, [previewOrder, baseOrder, mediaByPath, medias]);

  const orderMap = useMemo(() => {
    const map = new Map<string, number>();
    orderedMedias.forEach((media, index) => map.set(media.path, index));
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

      if (
        isSameOrder(ordered, selectedPaths) &&
        nextPrimary === primarySelectedPath
      ) {
        return;
      }

      onSelectionChange(ordered, nextPrimary);
    },
    [sortSelection, selectedPaths, primarySelectedPath, onSelectionChange]
  );

  const updatePreviewOrder = useCallback((next: string[]) => {
    setPreviewOrder((current) => {
      if (current && isSameOrder(current, next)) return current;
      return [...next];
    });
  }, []);

  const clearPreviewOrder = useCallback(() => {
    setPreviewOrder(null);
  }, []);

  const previewReorderTo = useCallback(
    (activeId: string, targetId: string) => {
      const current = previewOrder ?? baseOrder;
      const from = current.indexOf(activeId);
      const to = current.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return;
      const next = arrayMove(current, from, to);
      updatePreviewOrder(next);
    },
    [previewOrder, baseOrder, updatePreviewOrder]
  );

  const previewMoveToEnd = useCallback(
    (activeId: string) => {
      const current = previewOrder ?? baseOrder;
      const from = current.indexOf(activeId);
      if (from === -1 || from === current.length - 1) return;
      const next = [...current];
      next.splice(from, 1);
      next.push(activeId);
      updatePreviewOrder(next);
    },
    [previewOrder, baseOrder, updatePreviewOrder]
  );

  useDndMonitor({
    onDragStart: ({ active }) => {
      const id = typeof active.id === 'string' ? active.id : String(active.id);
      if (!baseOrder.includes(id)) return;
      setDragOverId(null);
      setTailActive(false);
    },
    onDragOver: ({ active, over }) => {
      const id = typeof active.id === 'string' ? active.id : String(active.id);
      if (!baseOrder.includes(id)) return;
      if (!over) {
        setDragOverId(null);
        setTailActive(false);
        return;
      }
      const data = over.data?.current as GridDropData | undefined;
      if (data?.type === 'media') {
        const overId = typeof over.id === 'string' ? over.id : String(over.id);
        if (overId === id) return;
        setTailActive(false);
        setDragOverId(overId);
        previewReorderTo(id, overId);
        return;
      }
      if (data?.type === 'media-tail') {
        setDragOverId(null);
        setTailActive(true);
        previewMoveToEnd(id);
        return;
      }
      setDragOverId(null);
      setTailActive(false);
      clearPreviewOrder();
    },
    onDragEnd: ({ active, over }) => {
      const id = typeof active.id === 'string' ? active.id : String(active.id);
      setDragOverId(null);
      setTailActive(false);

      if (!over) {
        clearPreviewOrder();
        return;
      }

      const data = over.data?.current as GridDropData | undefined;
      if (data?.type === 'media' || data?.type === 'media-tail') {
        const finalOrder = previewOrder ?? baseOrder;
        if (!isSameOrder(finalOrder, baseOrder)) {
          const snapshot = [...finalOrder];
          setPreviewOrder(snapshot);
          onReorder?.(snapshot);
        } else {
          clearPreviewOrder();
        }
        return;
      }

      clearPreviewOrder();
    },
    onDragCancel: () => {
      setDragOverId(null);
      setTailActive(false);
      clearPreviewOrder();
    }
  });

  const handleTilePointerDown = useCallback(
    (_event: React.PointerEvent<HTMLDivElement>, media: MediaNode) => {
      selectionAnchorRef.current = media.path;
    },
    []
  );

  const handleTileClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, media: MediaNode) => {
      event.preventDefault();
      const shift = event.shiftKey;
      const toggle = event.metaKey || event.ctrlKey;

      if (shift) {
        const anchor =
          selectionAnchorRef.current ??
          primarySelectedPath ??
          selectedPaths[selectedPaths.length - 1] ??
          media.path;
        const aIndex = orderMap.get(anchor);
        const tIndex = orderMap.get(media.path);
        if (aIndex === undefined || tIndex === undefined) {
          commitSelection([media.path], media.path);
          return;
        }
        const start = Math.min(aIndex, tIndex);
        const end = Math.max(aIndex, tIndex);
        const range = orderedMedias.slice(start, end + 1).map((item) => item.path);
        commitSelection(range, media.path);
        return;
      }

      if (toggle) {
        const current = new Set(selectedPaths);
        if (current.has(media.path)) current.delete(media.path);
        else current.add(media.path);
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
    },
    [
      commitSelection,
      orderedMedias,
      orderMap,
      primarySelectedPath,
      selectedPaths,
      sortSelection
    ]
  );

  const handleTileDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, media: MediaNode) => {
      event.preventDefault();
      onOpenMedia?.(media);
    },
    [onOpenMedia]
  );

  const handleContainerMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
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

      const handlePointerMove = (move: PointerEvent) => {
        if (!marqueeOriginRef.current || !containerRectRef.current) return;
        hasDraggedRef.current = true;
        const { x, y } = marqueeOriginRef.current;
        const rectLeft = Math.min(x, move.clientX);
        const rectTop = Math.min(y, move.clientY);
        const rectRight = Math.max(x, move.clientX);
        const rectBottom = Math.max(y, move.clientY);
        setMarqueeRect({
          left: rectLeft - containerRectRef.current.left,
          top: rectTop - containerRectRef.current.top,
          width: rectRight - rectLeft,
          height: rectBottom - rectTop
        });
        const tiles = container.querySelectorAll<HTMLElement>('[data-role="thumbnail"]');
        const next = new Set(additive ? marqueeBaseSelectionRef.current : []);
        tiles.forEach((tile) => {
          const b = tile.getBoundingClientRect();
          const intersects =
            b.right >= rectLeft &&
            b.left <= rectRight &&
            b.bottom >= rectTop &&
            b.top <= rectBottom;
          const path = tile.dataset.path;
          if (!path) return;
          if (intersects) next.add(path);
          else if (!additive) next.delete(path);
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
          commitSelection(
            marqueeBaseSelectionRef.current,
            marqueeBasePrimaryRef.current
          );
        }
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [commitSelection, primarySelectedPath, selectedPaths]
  );

  const { active } = useDndContext();
  if (medias.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, opacity: 0.7 }}>
        <Typography variant="subtitle1">
          Ce dossier attend encore sa première image.
        </Typography>
        <Typography variant="body2">
          Glissez-déposez vos créations n'importe où sur la page pour les
          importer ici.
        </Typography>
      </Box>
    );
  }

  const activeId = active
    ? typeof active.id === 'string'
      ? active.id
      : String(active.id)
    : null;
  const dragSelection = activeId && selectedSet.has(activeId)
    ? selectedPaths
    : activeId
    ? [activeId]
    : [];
  const overlayMedia = activeId ? mediaByPath.get(activeId) : undefined;

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

      <SortableContext items={orderedMedias.map((media) => media.path)} strategy={rectSortingStrategy}>
        {orderedMedias.map((media) => (
          <SortableMediaTile
            key={media.path}
            media={media}
            isSelected={selectedSet.has(media.path)}
            isDragTarget={dragOverId === media.path}
            onPointerDown={handleTilePointerDown}
            onClick={handleTileClick}
            onDoubleClick={handleTileDoubleClick}
          />
        ))}
      </SortableContext>

      <TailDropZone active={tailActive} />

      <DragOverlay>
        {dragSelection.length > 1 ? (
          <MultiDragOverlay count={dragSelection.length} />
        ) : overlayMedia ? (
          <SingleDragOverlay media={overlayMedia} />
        ) : null}
      </DragOverlay>
    </Box>
  );
};
