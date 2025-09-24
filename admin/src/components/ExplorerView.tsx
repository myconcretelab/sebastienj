import React, { useEffect, useMemo, useState } from 'react';
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BrushIcon from '@mui/icons-material/BrushRounded';
import PhotoIcon from '@mui/icons-material/PhotoCameraRounded';
import CollectionsIcon from '@mui/icons-material/CollectionsRounded';
import FolderIcon from '@mui/icons-material/FolderRounded';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolderRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import { FolderNode } from '../api/types.js';
import { motion } from 'framer-motion';

const MEDIA_DRAG_TYPE = 'application/x-media-path';

const iconForFolder = (node: FolderNode) => {
  if (node.icon === 'brush' || node.name.toLowerCase().includes('peint')) return <BrushIcon fontSize="small" />;
  if (node.icon === 'photo' || node.name.toLowerCase().includes('photo')) return <PhotoIcon fontSize="small" />;
  if (node.icon === 'croquis' || node.name.toLowerCase().includes('croquis')) return <CollectionsIcon fontSize="small" />;
  return <FolderIcon fontSize="small" />;
};

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
  const [newFolderName, setNewFolderName] = useState('');
  const rootId = tree.path || 'root';
  const [expanded, setExpanded] = useState<string[]>(() => [rootId]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    setExpanded((prev) => {
      if (prev.includes(rootId)) return prev;
      return [...prev, rootId];
    });
  }, [rootId]);

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

  const renderNode = (node: FolderNode) => {
    const nodeId = node.path || rootId;
    const isActiveDropTarget = dropTarget === nodeId;
    const folderPath = node.path || '';

    return (
      <TreeItem
        key={nodeId}
        itemId={nodeId}
        label={
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              px: 1,
              py: 0.5,
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
          >
            {iconForFolder(node)}
            <Typography variant="body2" sx={{ fontWeight: node.path === selectedPath ? 700 : 500 }}>
              {node.title || node.name}
            </Typography>
          </Stack>
        }
      >
        {node.children
          .filter((child): child is FolderNode => child.type === 'folder')
          .map((child) => renderNode(child))}
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
        slots={{ collapseIcon: ExpandMoreIcon, expandIcon: ChevronRightIcon }}
        expandedItems={expanded}
        onExpandedItemsChange={(_event, itemIds) => setExpanded(itemIds)}
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
