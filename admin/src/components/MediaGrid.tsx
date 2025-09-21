import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import { MediaNode } from '../api/types.js';
import ImageIcon from '@mui/icons-material/ImageRounded';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffRounded';

interface Props {
  medias: MediaNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
  onReorder: (nextOrder: string[]) => void;
}

const MEDIA_DRAG_TYPE = 'application/x-media-path';

const isSameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

export const MediaGrid: React.FC<Props> = ({ medias, selectedPath, onSelect, onReorder }) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [tailActive, setTailActive] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  const committedOrderRef = useRef<string[]>([]);

  useEffect(() => {
    committedOrderRef.current = medias.map((media) => media.path);
    setPreviewOrder(null);
    setDraggingId(null);
    setDragOverId(null);
    setTailActive(false);
  }, [medias]);

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

  if (medias.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, opacity: 0.7 }}>
        <Typography variant="subtitle1">Ce dossier attend encore sa première image.</Typography>
        <Typography variant="body2">Glissez-déposez vos créations n'importe où sur la page pour les importer ici.</Typography>
      </Box>
    );
  }

  return (
    <Stack direction="row" flexWrap="wrap" gap={2}>
      {orderedMedias.map((media) => {
        const thumbnails = media.thumbnails && Object.keys(media.thumbnails).length > 0 ? media.thumbnails : undefined;
        const primary = thumbnails ? thumbnails.thumb || Object.values(thumbnails)[0] : undefined;
        const previewPath = primary?.defaultPath;
        const isDragging = draggingId === media.path;
        const isDragTarget = dragOverId === media.path;

        return (
          <Card
            key={media.path}
            onClick={() => onSelect(media.path)}
            draggable
            onDragStart={(event: React.DragEvent<HTMLDivElement>) => {
              setDraggingId(media.path);
              setDragOverId(null);
              setTailActive(false);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData(MEDIA_DRAG_TYPE, media.path);
              event.dataTransfer.setData('text/plain', media.path);
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
              width: 200,
              borderRadius: 4,
              border:
                media.path === selectedPath
                  ? '2px solid #6f89a6'
                  : isDragTarget
                  ? '2px dashed #6f89a6'
                  : '1px solid rgba(111,137,166,0.2)',
              position: 'relative',
              opacity: isDragging ? 0.6 : 1,
              transition: 'transform 180ms ease, box-shadow 180ms ease, border 120ms ease, opacity 120ms ease',
              boxShadow: 'none',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 24px rgba(111, 137, 166, 0.16)'
              }
            }}
          >
            <CardActionArea
              sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5 }}
            >
              {previewPath ? (
                <img
                  src={`/api/media${previewPath}`}
                  alt={media.title || media.name}
                  loading="lazy"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'cover',
                    borderRadius: 8,
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)'
                  }}
                />
              ) : (
                <ImageIcon fontSize="large" color="disabled" />
              )}
            </CardActionArea>
            <CardContent sx={{ minHeight: 100 }}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" noWrap>
                  {media.title || media.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {media.path}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {media.tags?.slice(0, 3).map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                  {media.visibility === 'private' && (
                    <Chip icon={<VisibilityOffIcon />} label="Privé" size="small" color="warning" variant="outlined" />
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
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
    </Stack>
  );
};
