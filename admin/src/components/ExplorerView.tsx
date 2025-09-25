import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useDndContext, useDndMonitor, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
const LABEL_PADDING_LEFT = 4; // base left padding for folder label rows
const LEVEL_INDENT_WIDTH = 15; // additional padding applied per depth level
const TOGGLE_ICON_GAP = 0; // horizontal gap between the +/- toggle and folder labels (theme spacing units)
const ROW_VERTICAL_PADDING = 0.2; // vertical padding applied to each explorer row (theme spacing units)
const ROW_CONTENT_VERTICAL_PADDING = ROW_VERTICAL_PADDING * 0.5;

const LeafPlaceholder = () => <Box component="span" sx={{ width: 16, height: 16 }} />;

interface FolderReorderSpacerProps {
  parentPath: string;
  beforePath: string | null;
  targetDepth: number;
}

const FolderReorderSpacer: React.FC<FolderReorderSpacerProps> = ({ parentPath, beforePath, targetDepth }) => {
  const theme = useTheme();
  const { active } = useDndContext();
  const activeData = active?.data?.current as { type?: string; path?: string; parent?: string } | undefined;
  const isFolderDrag = activeData?.type === 'folder-node';
  const activePath = activeData?.path;
  const activeParent = activeData?.parent;

  if (!isFolderDrag || !activePath || activeParent === undefined) {
    return null;
  }

  if (activeParent !== parentPath) {
    return null;
  }

  if (beforePath !== null && beforePath === activePath) {
    return null;
  }

  const spacerId = `folder-reorder:${parentPath || 'root'}:${beforePath ?? 'end'}`;
  const { setNodeRef, isOver } = useDroppable({
    id: spacerId,
    data: { type: 'folder-reorder', parent: parentPath, before: beforePath }
  });

  const indent = LABEL_PADDING_LEFT + targetDepth * LEVEL_INDENT_WIDTH;
  const accent = theme.palette.primary?.light || 'rgba(61,111,217,0.65)';

  return (
    <Box
      ref={setNodeRef}
      sx={{
        height: isOver ? 24 : 14,
        mx: 1,
        my: 0.75,
        borderRadius: 1,
        border: `1px dashed ${accent}`,
        borderColor: isOver ? accent : 'rgba(111,137,166,0.32)',
        bgcolor: isOver ? 'rgba(61,111,217,0.2)' : 'transparent',
        opacity: isOver ? 0.85 : 0.6,
        transition: 'all 140ms ease',
        pointerEvents: 'auto',
        ml: `${indent}px`,
        mr: 1.5
      }}
    />
  );
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

  useEffect(() => {
    setPendingOrders({});
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
    const activeData = active?.data?.current as { type?: string; path?: string; parent?: string } | undefined;
    const activeType = activeData?.type;
    const isMediaDrag = activeType === 'media';
    const isFolderDrag = activeType === 'folder-node';

    const { setNodeRef: setDropTargetRef, isOver: isDropTargetOver } = useDroppable({
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
      data: { type: 'folder-node', path: folderPath, parent: parentPath },
      disabled: isRoot
    });

    const combinedRef = useCallback(
      (element: HTMLElement | null) => {
        setSortableRef(element);
        setDropTargetRef(element);
      },
      [setSortableRef, setDropTargetRef]
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
                isDragging ||
                (isMediaDrag && isDropTargetOver) ||
                (isFolderDrag && isDropTargetOver && activeData?.path !== folderPath)
                  ? '1px solid rgba(61, 111, 217, 0.55)'
                  : '1px solid transparent',
              bgcolor:
                isMediaDrag && isDropTargetOver
                  ? 'rgba(61,111,217,0.12)'
                  : isFolderDrag && isDropTargetOver && activeData?.path !== folderPath
                  ? 'rgba(61,111,217,0.1)'
                  : 'transparent',
              opacity: isDragging ? 0.65 : 1
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
        {childFolders.length > 0 && (
          <SortableContext
            items={childFolders.map((child) => child.path || `${folderPath}/${child.name}`)}
            strategy={verticalListSortingStrategy}
          >
            {childFolders.map((child) => {
              const childPath = child.path || `${folderPath}/${child.name}`;
              return (
                <Fragment key={childPath}>
                  <FolderReorderSpacer parentPath={folderPath} beforePath={childPath} targetDepth={depth + 1} />
                  <FolderTreeItem node={child} depth={depth + 1} parentPath={folderPath} />
                </Fragment>
              );
            })}
            <FolderReorderSpacer parentPath={folderPath} beforePath={null} targetDepth={depth + 1} />
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
    onDragEnd: ({ active, over }) => {
      const activeData = active.data?.current as
        | { type?: string; path?: string; parent?: string }
        | undefined;
      if (activeData?.type !== 'folder-node' || !activeData.path || activeData.parent === undefined) {
        return;
      }

      const parentPath = activeData.parent;

      const clearPreview = () => {
        setPendingOrders((prev) => {
          if (!prev[parentPath]) return prev;
          const next = { ...prev };
          delete next[parentPath];
          return next;
        });
      };

      if (!over) {
        clearPreview();
        return;
      }

      const overData = over.data?.current as
        | { type?: string; path?: string; parent?: string; before?: string | null }
        | undefined;

      const siblings = folderChildrenMap.get(parentPath) ?? [];
      const currentOrder = getOrderedPaths(parentPath, siblings);
      const baseOrder = siblings.map((child) => child.path || '');

      if (overData?.type === 'folder-reorder') {
        if (overData.parent !== parentPath) {
          clearPreview();
          return;
        }

        if (currentOrder.length === 0) {
          clearPreview();
          return;
        }

        const filtered = currentOrder.filter((entry) => entry !== activeData.path);
        if (filtered.length === currentOrder.length) {
          clearPreview();
          return;
        }

        let insertIndex = filtered.length;
        if (overData.before !== undefined && overData.before !== null) {
          const targetIndex = filtered.indexOf(overData.before);
          if (targetIndex === -1) {
            clearPreview();
            return;
          }
          insertIndex = targetIndex;
        }

        const nextOrder = [...filtered];
        nextOrder.splice(insertIndex, 0, activeData.path);

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
        return;
      }

      if (overData?.type === 'folder-node' && overData.path && overData.parent === parentPath) {
        if (currentOrder.length === 0) {
          clearPreview();
          return;
        }

        const fromIndex = currentOrder.indexOf(activeData.path);
        const toIndex = currentOrder.indexOf(overData.path);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
          clearPreview();
          return;
        }

        const nextOrder = arrayMove(currentOrder, fromIndex, toIndex);

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
        return;
      }

      clearPreview();
    },
    onDragCancel: ({ active }) => {
      const activeData = active.data?.current as
        | { type?: string; parent?: string }
        | undefined;
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

  return (
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
          const normalized = Array.isArray(itemIds) ? itemIds.map((id) => (typeof id === 'string' ? id : String(id))) : [];
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
  );
};
