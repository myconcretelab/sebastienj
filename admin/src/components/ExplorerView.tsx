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
import { useDndContext, useDroppable } from '@dnd-kit/core';
import { DndProvider } from 'react-dnd';
import {
  Tree,
  type NodeModel,
  type RenderParams,
  type DropOptions,
  getBackendOptions,
  MultiBackend,
  type TreeMethods
} from '@minoru/react-dnd-treeview';

const LABEL_PADDING_LEFT = 4; // base left padding for folder label rows
const LEVEL_INDENT_WIDTH = 15; // additional padding applied per depth level
const TOGGLE_ICON_GAP = 0; // horizontal gap between the +/- toggle and folder labels (theme spacing units)
const ROW_VERTICAL_PADDING = 0.2; // vertical padding applied to each explorer row (theme spacing units)
const VIRTUAL_ROOT_ID = '__explorer-root__';

const LeafPlaceholder = () => <Box component="span" sx={{ width: 16, height: 16 }} />;

type ExplorerNode = NodeModel<FolderNode>;

type FolderPathMap = Map<ExplorerNode['id'], string>;

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
  const treeRef = useRef<TreeMethods>(null);
  const backendOptions = useMemo(() => getBackendOptions(), []);

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
    try {
      window.localStorage.setItem('explorer-expanded', JSON.stringify(expanded));
    } catch (error) {
      console.warn('Failed to persist explorer state', error);
    }
  }, [expanded]);

  const updateExpanded = useCallback(
    (ids: (string | number)[]) => {
      const normalized = Array.from(new Set([rootId, ...ids.map((id) => id.toString())]));
      setExpanded(normalized);
    },
    [rootId]
  );

  useEffect(() => {
    if (!expanded.includes(rootId)) {
      treeRef.current?.open(rootId, (ids) => updateExpanded(ids));
    }
  }, [expanded, rootId, updateExpanded]);

  const pathToNodeId = useCallback(
    (path: string) => {
      return path ? path : rootId;
    },
    [rootId]
  );

  useEffect(() => {
    if (!selectedPath) {
      if (!expanded.includes(rootId)) {
        treeRef.current?.open(rootId, (ids) => updateExpanded(ids));
      }
      return;
    }

    const ancestorPaths = selectedPath
      .split('/')
      .filter(Boolean)
      .reduce<string[]>((acc, segment) => {
        const next = acc.length ? `${acc[acc.length - 1]}/${segment}` : segment;
        acc.push(next);
        return acc;
      }, []);

    const requiredIds = [rootId, ...ancestorPaths.map(pathToNodeId)];
    const missing = requiredIds.filter((id) => !expanded.includes(id));
    if (missing.length > 0) {
      treeRef.current?.open(requiredIds, (ids) => updateExpanded(ids));
    }
  }, [selectedPath, rootId, expanded, updateExpanded, pathToNodeId]);

  const { treeData, idToPathMap } = useMemo(() => {
    const nodes: ExplorerNode[] = [];
    const idToPath: FolderPathMap = new Map();

    const visit = (node: FolderNode, parentId: string | number) => {
      const nodeId = node.path || rootId;
      idToPath.set(nodeId, node.path || '');
      nodes.push({
        id: nodeId,
        parent: parentId,
        text: node.title || node.name,
        droppable: true,
        data: node
      });

      const folders = node.children.filter((child): child is FolderNode => child.type === 'folder');
      if (folders.length === 0) {
        return;
      }
      const orderedPaths = getOrderedPaths(node.path || '', folders);
      const map = new Map(folders.map((child) => [child.path || '', child]));
      orderedPaths.forEach((path) => {
        const child = map.get(path);
        if (child) {
          visit(child, nodeId);
          map.delete(path);
        }
      });
      map.forEach((child) => visit(child, nodeId));
    };

    visit(tree, VIRTUAL_ROOT_ID);
    return { treeData: nodes, idToPathMap: idToPath };
  }, [tree, rootId, getOrderedPaths]);

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

  const handleDrop = useCallback(
    (newTree: ExplorerNode[], options: DropOptions<FolderNode>) => {
      const dragSource = options.dragSource;
      if (!dragSource?.data?.path) {
        return;
      }

      const sourceParentId = dragSource.parent;
      if (sourceParentId === undefined || sourceParentId === null) {
        return;
      }

      const updatedSource = newTree.find((node) => node.id === dragSource.id);
      if (!updatedSource || updatedSource.parent !== sourceParentId) {
        const parentPathFallback = idToPathMap.get(sourceParentId) ?? '';
        setPendingOrders((prev) => {
          if (!prev[parentPathFallback]) return prev;
          const next = { ...prev };
          delete next[parentPathFallback];
          return next;
        });
        return;
      }

      const parentPath = idToPathMap.get(sourceParentId) ?? '';
      const siblings = folderChildrenMap.get(parentPath) ?? [];
      if (siblings.length === 0) {
        return;
      }

      const siblingNodes = newTree.filter((node) => node.parent === sourceParentId);
      if (siblingNodes.length === 0) {
        return;
      }

      const nextOrder = siblingNodes
        .map((node) => node.data?.path || (typeof node.id === 'string' ? (node.id === rootId ? '' : node.id) : String(node.id)))
        .filter((value): value is string => typeof value === 'string');

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
    [folderChildrenMap, idToPathMap, isSameOrder, onReorderFolders, rootId]
  );

  const hasSelection = selectedPath !== undefined && selectedPath !== null;
  const targetLabel = hasSelection && selectedPath ? selectedPath : 'la racine';

  const ExplorerTreeNode: React.FC<{ node: ExplorerNode; params: RenderParams }> = ({ node, params }) => {
    const folder = node.data ?? tree;
    const folderPath = folder.path || '';
    const isRoot = node.id === rootId;
    const paddingLeft = LABEL_PADDING_LEFT + params.depth * LEVEL_INDENT_WIDTH;
    const mediaCount = folder.children.filter((child) => child.type === 'media').length;

    const { active } = useDndContext();
    const activeType = (active?.data?.current as { type?: string } | undefined)?.type;
    const isMediaDrag = activeType === 'media';

    const { setNodeRef: setMediaDropRef, isOver: isMediaDropOver } = useDroppable({
      id: `media-target:${node.id}`,
      data: { type: 'folder', path: folderPath }
    });

    const combinedRef = useCallback(
      (element: HTMLElement | null) => {
        if (params.containerRef) {
          (params.containerRef as React.MutableRefObject<HTMLElement | null>).current = element;
        }
        setMediaDropRef(element);
      },
      [params.containerRef, setMediaDropRef]
    );

    const handleRef = useCallback(
      (element: HTMLDivElement | null) => {
        if (params.handleRef) {
          (params.handleRef as React.MutableRefObject<HTMLDivElement | null>).current = element;
        }
      },
      [params.handleRef]
    );

    const isSelected = folderPath ? folderPath === selectedPath : !selectedPath;
    const isDropHighlight = params.isDropTarget || (isMediaDrag && isMediaDropOver);

    return (
      <Box
        ref={combinedRef}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.25,
          pr: 1,
          pl: `${paddingLeft}px`,
          py: ROW_VERTICAL_PADDING,
          borderRadius: 1,
          transition: 'background-color 120ms ease, border 120ms ease, opacity 120ms ease',
          border: isDropHighlight ? '1px solid rgba(61, 111, 217, 0.55)' : '1px solid transparent',
          bgcolor: isDropHighlight ? 'rgba(61,111,217,0.12)' : 'transparent',
          opacity: params.isDragging ? 0.65 : 1,
          cursor: isRoot ? 'default' : params.isDragging ? 'grabbing' : 'grab'
        }}
        onClick={() => {
          onSelect(folderPath);
        }}
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
      >
        <Box
          component="span"
          sx={{
            width: 16,
            mr: TOGGLE_ICON_GAP,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
            cursor: params.hasChild ? 'pointer' : 'default'
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (params.hasChild) {
              params.onToggle();
            }
          }}
        >
          {params.hasChild ? (params.isOpen ? <CollapseIcon /> : <ExpandIcon />) : <LeafPlaceholder />}
        </Box>
        <Stack
          ref={handleRef}
          direction="row"
          alignItems="center"
          spacing={1.25}
          justifyContent="space-between"
          sx={{ flex: 1, minWidth: 0 }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            {iconForFolder(folder)}
            <Typography variant="body2" noWrap sx={{ fontWeight: isSelected ? 700 : 500, color: 'text.primary' }}>
              {folder.title || folder.name}
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
      </Box>
    );
  };

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
      <DndProvider backend={MultiBackend} options={backendOptions}>
        <Tree
          ref={treeRef}
          tree={treeData}
          rootId={VIRTUAL_ROOT_ID}
          sort={false}
          canDrag={(node) => (node ? node.id !== rootId : true)}
          onChangeOpen={(ids) => updateExpanded(ids)}
          initialOpen={expanded}
          onDrop={handleDrop}
          render={(node, params) => <ExplorerTreeNode node={node} params={params} />}
        />
      </DndProvider>
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
