import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import BrushIcon from '@mui/icons-material/BrushRounded';
import PhotoIcon from '@mui/icons-material/PhotoCameraRounded';
import CollectionsIcon from '@mui/icons-material/CollectionsRounded';
import FolderIcon from '@mui/icons-material/FolderRounded';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import Avatar from '@mui/material/Avatar';
import { useTheme } from '@mui/material/styles';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolderRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import { FolderNode } from '../api/types.js';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDndContext,
  useDndMonitor,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
const LABEL_PADDING_LEFT = 4; // base left padding for folder label rows
const LEVEL_INDENT_WIDTH = 15; // additional padding applied per depth level
const TOGGLE_ICON_GAP = 0; // horizontal gap between the +/- toggle and folder labels (theme spacing units)
const ROW_VERTICAL_PADDING = 0.2; // vertical padding applied to each explorer row (theme spacing units)
const ROW_CONTENT_VERTICAL_PADDING = ROW_VERTICAL_PADDING * 0.5;

const LeafPlaceholder = () => <Box component="span" sx={{ width: 16, height: 16 }} />;

const TreePlaceholder: React.FC<{ depth: number }> = ({ depth }) => {
  const paddingLeft = LABEL_PADDING_LEFT + depth * LEVEL_INDENT_WIDTH;
  return (
    <Box
      component="li"
      role="presentation"
      sx={{
        listStyle: 'none',
        py: ROW_VERTICAL_PADDING,
        px: 0,
        display: 'flex'
      }}
    >
      <Box
        sx={{
          ml: `${paddingLeft}px`,
          mr: 1,
          height: 28,
          flex: 1,
          borderRadius: 1,
          border: '1px dashed rgba(99,115,129,0.6)',
          bgcolor: 'rgba(145,158,171,0.12)'
        }}
      />
    </Box>
  );
};

type FolderDragData = {
  type: 'folder-node';
  path: string;
  parent: string;
  depth: number;
};

interface Props {
  tree: FolderNode;
  selectedPath: string;
  onSelect: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onEditFolder: () => void;
  onReorderFolders?: (parentPath: string, order: string[]) => void;
}

export const ExplorerView: React.FC<Props> = ({
  tree,
  selectedPath,
  onSelect,
  onCreateFolder,
  onEditFolder,
  onReorderFolders
}) => {
  const theme = useTheme();
  const accentColor = theme.palette.primary?.light || '#6f89a6';
  const lastTouchRef = useRef<{ time: number; path?: string }>({ time: 0, path: undefined });

  const iconForFolder = (node: FolderNode) => {
    const iconProps = { sx: { fontSize: 18, color: accentColor } };
    if (node.icon === 'brush' || node.name.toLowerCase().includes('peint')) return <BrushIcon {...iconProps} />;
    if (node.icon === 'photo' || node.name.toLowerCase().includes('photo')) return <PhotoIcon {...iconProps} />;
    if (node.icon === 'croquis' || node.name.toLowerCase().includes('croquis')) return <CollectionsIcon {...iconProps} />;
    return <FolderIcon {...iconProps} />;
  };

  const ExpandIcon = () => (
    <Box
      component="span"
      sx={{
        width: 16,
        textAlign: 'center',
        color: accentColor,
        fontSize: 16,
        fontWeight: 700,
        lineHeight: '16px'
      }}
    >
      +
    </Box>
  );

  const CollapseIcon = () => (
    <Box
      component="span"
      sx={{
        width: 16,
        textAlign: 'center',
        color: accentColor,
        fontSize: 16,
        fontWeight: 700,
        lineHeight: '16px'
      }}
    >
      −
    </Box>
  );
  const [newFolderName, setNewFolderName] = useState('');
  const rootId = tree.path || 'root';
  const [expanded, setExpanded] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [rootId];
    try {
      const raw = window.localStorage.getItem('explorer-expanded');
      if (!raw) return [rootId];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized = parsed.filter((value): value is string => typeof value === 'string');
        return normalized.length > 0 ? Array.from(new Set([rootId, ...normalized])) : [rootId];
      }
      return [rootId];
    } catch (error) {
      console.warn('Failed to restore explorer state', error);
      return [rootId];
    }
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<Record<string, string[]>>({});
  const [activePath, setActivePath] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState<{
    parentPath: string;
    index: number;
    depth: number;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 }
    })
  );

  useEffect(() => {
    setPendingOrders({});
    setPlaceholder(null);
    setActivePath(null);
  }, [tree]);

  const folderChildrenMap = useMemo(() => {
    const map = new Map<string, FolderNode[]>();
    const visit = (node: FolderNode) => {
      const key = node.path || '';
      const children = node.children.filter((child): child is FolderNode => child.type === 'folder');
      map.set(key, children);
      children.forEach(visit);
    };
    visit(tree);
    return map;
  }, [tree]);

  const folderNodeMap = useMemo(() => {
    const map = new Map<string, FolderNode>();
    const visit = (node: FolderNode) => {
      map.set(node.path || '', node);
      node.children.forEach((child) => {
        if (child.type === 'folder') {
          visit(child);
        }
      });
    };
    visit(tree);
    return map;
  }, [tree]);

  const getOrderedPaths = useCallback(
    (parentPath: string, children: FolderNode[]) => {
      const baseOrder = children.map((child) => child.path || '');
      const preview = pendingOrders[parentPath];
      if (!preview || preview.length === 0) {
        return baseOrder;
      }
      const remaining = new Set(baseOrder);
      const ordered: string[] = [];
      preview.forEach((path) => {
        if (remaining.has(path)) {
          ordered.push(path);
          remaining.delete(path);
        }
      });
      baseOrder.forEach((path) => {
        if (remaining.has(path)) {
          ordered.push(path);
          remaining.delete(path);
        }
      });
      return ordered;
    },
    [pendingOrders]
  );

  const isSameOrder = useCallback((a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }, []);

  useEffect(() => {
    setExpanded((prev) => {
      if (prev.includes(rootId)) return prev;
      return [...prev, rootId];
    });
  }, [rootId]);

  useEffect(() => {
    try {
      window.localStorage.setItem('explorer-expanded', JSON.stringify(expanded));
    } catch (error) {
      console.warn('Failed to persist explorer state', error);
    }
  }, [expanded]);

  useEffect(() => {
    if (!selectedPath) return;
    const ancestorIds = selectedPath
      .split('/')
      .filter(Boolean)
      .reduce<string[]>((acc, segment) => {
        const next = acc.length ? `${acc[acc.length - 1]}/${segment}` : segment;
        acc.push(next);
        return acc;
      }, []);

    setExpanded((prev) => {
      const required = new Set<string>([rootId, ...ancestorIds]);
      let changed = false;
      const next = [...prev];
      required.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [selectedPath, rootId]);

  const FolderTreeItem: React.FC<{ node: FolderNode; depth: number; parentPath: string }> = ({
    node,
    depth,
    parentPath
  }) => {
    const nodeId = node.path || rootId;
    const folderPath = node.path || '';
    const isRoot = depth === 0;
    const paddingLeft = LABEL_PADDING_LEFT + depth * LEVEL_INDENT_WIDTH;
    const groupStyles = !isRoot
      ? {
          marginLeft: 18,
          paddingLeft: 16,
          position: 'relative',
          '&:before': {
            content: '""',
            position: 'absolute',
            left: 6,
            top: 0,
            bottom: 8,
            borderLeft: '1px solid rgba(140,150,160,0.45)'
          }
        }
      : {
          marginLeft: 18,
          paddingLeft: 16
        };
    const mediaCount = node.children.filter((child) => child.type === 'media').length;

    const { active } = useDndContext();
    const activeType = (active?.data?.current as { type?: string } | undefined)?.type;
    const isMediaDrag = activeType === 'media';

    const { setNodeRef: setMediaDropRef, isOver: isMediaDropOver } = useDroppable({
      id: `media-target:${nodeId}`,
      data: { type: 'folder', path: folderPath }
    });

    const {
      setNodeRef: setSortableRef,
      attributes,
      listeners,
      transform,
      transition,
      isDragging
    } = useSortable({
      id: nodeId,
      data: { type: 'folder-node', path: folderPath, parent: parentPath, depth },
      disabled: isRoot
    });

    const combinedRef = useCallback(
      (element: HTMLElement | null) => {
        setSortableRef(element);
        setMediaDropRef(element);
      },
      [setSortableRef, setMediaDropRef]
    );

    const sortableStyle = isRoot
      ? undefined
      : ({
          transform: CSS.Transform.toString(transform),
          transition,
          cursor: isDragging ? 'grabbing' : 'grab'
        } as React.CSSProperties);

    const childFolders = useMemo(() => {
      const folders = node.children.filter((child): child is FolderNode => child.type === 'folder');
      if (folders.length === 0) return [] as FolderNode[];
      const orderedPaths = getOrderedPaths(folderPath, folders);
      const map = new Map(folders.map((child) => [child.path || '', child]));
      const ordered: FolderNode[] = [];
      orderedPaths.forEach((path) => {
        const entry = map.get(path);
        if (entry) {
          ordered.push(entry);
          map.delete(path);
        }
      });
      map.forEach((remaining) => ordered.push(remaining));
      return ordered;
    }, [node.children, folderPath, getOrderedPaths]);

    return (
      <TreeItem
        key={nodeId}
        itemId={nodeId}
        sx={{
          '& .MuiTreeItem-content': {
            py: ROW_CONTENT_VERTICAL_PADDING,
            px: 0,
            alignItems: 'center'
          },
          '& .MuiTreeItem-iconContainer': {
            minWidth: 16,
            width: 16,
            mr: TOGGLE_ICON_GAP,
            alignItems: 'center',
            justifyContent: 'center'
          },
          '& > .MuiTreeItem-group': groupStyles
        }}
        label={
          <Stack
            ref={combinedRef}
            direction="row"
            alignItems="center"
            spacing={1.25}
            justifyContent="space-between"
            sx={{
              flex: 1,
              pr: 1,
              pl: `${paddingLeft}px`,
              py: ROW_VERTICAL_PADDING,
              borderRadius: 1,
              transition: 'background-color 120ms ease, border 120ms ease, opacity 120ms ease',
              border:
                (isMediaDropOver && isMediaDrag) || isDragging
                  ? '1px solid rgba(61, 111, 217, 0.55)'
                  : '1px solid transparent',
              bgcolor: isMediaDropOver && isMediaDrag ? 'rgba(61,111,217,0.12)' : 'transparent',
              opacity: isDragging ? 0 : 1,
              visibility: isDragging ? 'hidden' : 'visible'
            }}
            style={sortableStyle}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(folderPath);
              onEditFolder();
            }}
            onTouchEnd={(event) => {
              if (event.touches.length > 0) return;
              const now = Date.now();
              if (lastTouchRef.current.path === folderPath && now - lastTouchRef.current.time < 350) {
                event.preventDefault();
                event.stopPropagation();
                onSelect(folderPath);
                onEditFolder();
                lastTouchRef.current = { time: 0, path: undefined };
              } else {
                lastTouchRef.current = { time: now, path: folderPath };
              }
            }}
            {...attributes}
            {...listeners}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
              {iconForFolder(node)}
              <Typography
                variant="body2"
                noWrap
                sx={{ fontWeight: node.path === selectedPath ? 700 : 500, color: 'text.primary' }}
              >
                {node.title || node.name}
              </Typography>
            </Stack>
            {mediaCount > 0 && (
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(145,158,171,0.24)',
                  color: 'rgba(71,79,98,0.9)',
                  fontWeight: 600
                }}
              >
                {mediaCount}
              </Avatar>
            )}
          </Stack>
        }
      >
        {(childFolders.length > 0 || (placeholder && placeholder.parentPath === folderPath)) && (
          <SortableContext
            items={childFolders.map((child) => child.path || `${folderPath}/${child.name}`)}
            strategy={verticalListSortingStrategy}
          >
            {(() => {
              const placeholderDetails =
                placeholder && placeholder.parentPath === folderPath ? placeholder : null;
              const elements: React.ReactNode[] = [];
              childFolders.forEach((child, index) => {
                if (placeholderDetails && placeholderDetails.index === index) {
                  elements.push(
                    <TreePlaceholder key={`placeholder-${folderPath}-${index}`} depth={placeholderDetails.depth} />
                  );
                }
                elements.push(
                  <FolderTreeItem
                    key={child.path || child.name}
                    node={child}
                    depth={depth + 1}
                    parentPath={folderPath}
                  />
                );
              });
              if (placeholderDetails && placeholderDetails.index === childFolders.length) {
                elements.push(
                  <TreePlaceholder
                    key={`placeholder-${folderPath}-${childFolders.length}`}
                    depth={placeholderDetails.depth}
                  />
                );
              }
              return elements;
            })()}
          </SortableContext>
        )}
      </TreeItem>
    );
  };

  const handleCreate = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const basePath = selectedPath || '';
    const candidate = basePath ? `${basePath}/${trimmed}` : trimmed;
    onCreateFolder(candidate.replace(/\s+/g, '-').toLowerCase());
    setNewFolderName('');
    setCreateDialogOpen(false);
  };

  const folderCount = useMemo(() => {
    let count = 0;
    const visit = (node: FolderNode) => {
      count += 1;
      node.children.forEach((child) => {
        if (child.type === 'folder') visit(child);
      });
    };
    visit(tree);
    return count;
  }, [tree]);

  useDndMonitor({
    onDragStart: ({ active }) => {
      const activeData = active.data?.current as FolderDragData | undefined;
      if (activeData?.type !== 'folder-node') {
        setPlaceholder(null);
        setActivePath(null);
        return;
      }

      setActivePath(activeData.path);

      const parentPath = activeData.parent ?? '';
      const siblings = folderChildrenMap.get(parentPath) ?? [];
      const ordered = getOrderedPaths(parentPath, siblings);
      const currentIndex = ordered.indexOf(activeData.path);
      const filteredLength = ordered.filter((id) => id !== activeData.path).length;
      const initialIndex = currentIndex === -1 ? filteredLength : Math.min(Math.max(currentIndex, 0), filteredLength);

      setPlaceholder({ parentPath, index: initialIndex, depth: activeData.depth });
    },
    onDragOver: ({ active, over }) => {
      const activeData = active.data?.current as FolderDragData | undefined;
      if (activeData?.type !== 'folder-node') {
        setPlaceholder(null);
        return;
      }

      if (!over) {
        return;
      }

      if (over.id === active.id) {
        return;
      }

      const overData = over.data?.current as FolderDragData | undefined;
      if (overData?.type !== 'folder-node') {
        setPlaceholder(null);
        return;
      }

      if (overData.parent !== activeData.parent) {
        setPlaceholder(null);
        return;
      }

      const parentPath = activeData.parent;
      const siblings = folderChildrenMap.get(parentPath) ?? [];
      if (siblings.length === 0) {
        setPlaceholder({ parentPath, index: 0, depth: activeData.depth });
        return;
      }

      const ordered = getOrderedPaths(parentPath, siblings);
      const withoutActive = ordered.filter((id) => id !== activeData.path);
      const overIndex = withoutActive.indexOf(overData.path);

      const activeRect = active.rect.current;
      const overRect = over.rect;
      const translatedTop = activeRect.translated?.top ?? activeRect.initial.top;
      const isBelowOverItem = translatedTop > overRect.top + overRect.height / 2;

      let nextIndex = (overIndex === -1 ? withoutActive.length : overIndex) + (isBelowOverItem ? 1 : 0);
      nextIndex = Math.max(0, Math.min(withoutActive.length, nextIndex));

      setPlaceholder({ parentPath, index: nextIndex, depth: overData.depth });
    },
    onDragEnd: ({ active, over }) => {
      setActivePath(null);
      setPlaceholder(null);

      const activeData = active.data?.current as FolderDragData | undefined;
      if (activeData?.type !== 'folder-node' || !activeData.path || activeData.parent === undefined) {
        return;
      }

      const parentPath = activeData.parent;

      if (!over) {
        setPendingOrders((prev) => {
          if (!prev[parentPath]) return prev;
          const next = { ...prev };
          delete next[parentPath];
          return next;
        });
        return;
      }

      const overData = over.data?.current as FolderDragData | undefined;
      if (overData?.type !== 'folder-node' || !overData.path || overData.parent !== parentPath) {
        setPendingOrders((prev) => {
          if (!prev[parentPath]) return prev;
          const next = { ...prev };
          delete next[parentPath];
          return next;
        });
        return;
      }

      const siblings = folderChildrenMap.get(parentPath) ?? [];
      if (siblings.length === 0) return;

      const currentOrder = getOrderedPaths(parentPath, siblings);
      const fromIndex = currentOrder.indexOf(activeData.path);
      const toIndex = currentOrder.indexOf(overData.path);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return;
      }

      const nextOrder = arrayMove(currentOrder, fromIndex, toIndex);
      const baseOrder = siblings.map((child) => child.path || '');

      setPendingOrders((prev) => {
        const copy = { ...prev };
        if (isSameOrder(nextOrder, baseOrder)) {
          delete copy[parentPath];
          return copy;
        }
        copy[parentPath] = nextOrder;
        return copy;
      });

      if (!isSameOrder(nextOrder, baseOrder)) {
        onReorderFolders?.(parentPath, nextOrder);
      }
    },
    onDragCancel: ({ active }) => {
      setActivePath(null);
      setPlaceholder(null);

      const activeData = active.data?.current as FolderDragData | undefined;
      if (activeData?.type !== 'folder-node' || activeData.parent === undefined) {
        return;
      }
      const parentPath = activeData.parent;
      setPendingOrders((prev) => {
        if (!prev[parentPath]) return prev;
        const next = { ...prev };
        delete next[parentPath];
        return next;
      });
    }
  });

  const hasSelection = selectedPath !== undefined && selectedPath !== null;
  const targetLabel = hasSelection && selectedPath ? selectedPath : 'la racine';
  const activeNode = activePath ? folderNodeMap.get(activePath) : undefined;

  return (
    <DndContext sensors={sensors}>
      <Stack spacing={2} sx={{ height: '100%' }}>
        <Stack spacing={1.5} alignItems="flex-start">
          <Typography variant="subtitle2" color="text.secondary" sx={{ letterSpacing: 1, textTransform: 'uppercase' }}>
            Arborescence ({folderCount})
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon fontSize="inherit" />}
              onClick={onEditFolder}
              disabled={!hasSelection}
              sx={{ px: 1.25, py: 0.25, letterSpacing: 0.5, fontSize: '0.7rem', gap: 0.5, minHeight: 28 }}
            >
              Edition
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<CreateNewFolderIcon fontSize="inherit" />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ px: 1.25, py: 0.25, letterSpacing: 0.5, fontSize: '0.7rem', gap: 0.5, minHeight: 28 }}
            >
              Nouveau dossier
            </Button>
          </Stack>
        </Stack>
        <SimpleTreeView
          aria-label="explorateur"
          slots={{ collapseIcon: CollapseIcon, expandIcon: ExpandIcon, endIcon: LeafPlaceholder }}
          expandedItems={expanded}
          onExpandedItemsChange={(_event, itemIds) => {
            const normalized = Array.isArray(itemIds)
              ? itemIds.map((id) => (typeof id === 'string' ? id : String(id)))
              : [];
            setExpanded(Array.from(new Set([rootId, ...normalized])));
          }}
          selectedItems={selectedPath || rootId}
          onSelectedItemsChange={(_event, itemId) => {
            if (typeof itemId === 'string') {
              onSelect(itemId === rootId ? '' : itemId);
            }
          }}
          sx={{ flex: 1, overflowY: 'auto', pr: 1 }}
        >
          <SortableContext items={[tree.path || rootId]} strategy={verticalListSortingStrategy}>
            <FolderTreeItem node={tree} depth={0} parentPath="" />
          </SortableContext>
        </SimpleTreeView>
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Nouveau dossier</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Stack
              spacing={2}
              component={motion.div}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeMotionIcon fontSize="small" />
                Créer dans {targetLabel}
              </Typography>
              <TextField
                autoFocus
                label="Nom du dossier"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCreate();
                  }
                }}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                setCreateDialogOpen(false);
                setNewFolderName('');
              }}
            >
              Annuler
            </Button>
            <Button variant="contained" onClick={handleCreate} disabled={!newFolderName.trim()}>
              Créer
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
      <DragOverlay>
        {activeNode ? (
          <Box
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              boxShadow: theme.shadows[4],
              bgcolor: 'background.paper',
              border: '1px solid rgba(61,111,217,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              minWidth: 180
            }}
          >
            {iconForFolder(activeNode)}
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {activeNode.title || activeNode.name}
            </Typography>
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
