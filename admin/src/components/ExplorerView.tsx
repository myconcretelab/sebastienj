import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const MEDIA_DRAG_TYPE = 'application/x-media-path';
const LABEL_PADDING_LEFT = 4; // base left padding for folder label rows
const LEVEL_INDENT_WIDTH = 15; // additional padding applied per depth level
const TOGGLE_ICON_GAP = 0; // horizontal gap between the +/- toggle and folder labels (theme spacing units)
const ROW_VERTICAL_PADDING = 0.2; // vertical padding applied to each explorer row (theme spacing units)
const ROW_CONTENT_VERTICAL_PADDING = ROW_VERTICAL_PADDING * 0.5;

const LeafPlaceholder = () => <Box component="span" sx={{ width: 16, height: 16 }} />;

interface Props {
  tree: FolderNode;
  selectedPath: string;
  onSelect: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onEditFolder: () => void;
  onMoveMedias: (mediaPaths: string[], destination: string) => void;
}

export const ExplorerView: React.FC<Props> = ({
  tree,
  selectedPath,
  onSelect,
  onCreateFolder,
  onEditFolder,
  onMoveMedias
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
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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

  const isMediaDrag = (event: React.DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes(MEDIA_DRAG_TYPE);

  const readDraggedMediaPaths = (event: React.DragEvent): string[] => {
    const raw = event.dataTransfer.getData(MEDIA_DRAG_TYPE);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
      }
      if (typeof parsed === 'string') {
        return parsed ? [parsed] : [];
      }
    } catch (error) {
      if (typeof raw === 'string') {
        return raw
          .split('\n')
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
      }
    }
    if (typeof raw === 'string' && raw.length > 0) {
      return [raw];
    }
    return [];
  };

  const renderNode = (node: FolderNode, depth = 0) => {
    const nodeId = node.path || rootId;
    const isActiveDropTarget = dropTarget === nodeId;
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
              transition: 'background-color 120ms ease, border 120ms ease',
              border: isActiveDropTarget
                ? '1px solid rgba(61, 111, 217, 0.55)'
                : '1px solid transparent',
              bgcolor: isActiveDropTarget ? 'rgba(61,111,217,0.12)' : 'transparent'
            }}
            onDragOver={(event) => {
              if (!isMediaDrag(event)) return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = 'move';
              setDropTarget(nodeId);
            }}
            onDragEnter={(event) => {
              if (!isMediaDrag(event)) return;
              event.preventDefault();
              event.stopPropagation();
              setDropTarget(nodeId);
            }}
            onDragLeave={(event) => {
              if (!isMediaDrag(event)) return;
              const related = event.relatedTarget as Node | null;
              if (!related || !event.currentTarget.contains(related)) {
                setDropTarget((current) => (current === nodeId ? null : current));
              }
            }}
            onDrop={(event) => {
              if (!isMediaDrag(event)) return;
              const dragged = readDraggedMediaPaths(event);
              if (dragged.length === 0) return;
              event.preventDefault();
              event.stopPropagation();
              setDropTarget(null);
              onMoveMedias(dragged, folderPath);
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
        {node.children
          .filter((child): child is FolderNode => child.type === 'folder')
          .map((child) => renderNode(child, depth + 1))}
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
        {renderNode(tree)}
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
