import React, { useMemo, useState } from 'react';
import { Box, Button, Divider, Stack, TextField, Typography } from '@mui/material';
import TreeView from '@mui/lab/TreeView';
import TreeItem from '@mui/lab/TreeItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BrushIcon from '@mui/icons-material/BrushRounded';
import PhotoIcon from '@mui/icons-material/PhotoCameraRounded';
import CollectionsIcon from '@mui/icons-material/CollectionsRounded';
import FolderIcon from '@mui/icons-material/FolderRounded';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import { FolderNode } from '../api/types.js';
import { motion } from 'framer-motion';

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
}

export const ExplorerView: React.FC<Props> = ({ tree, selectedPath, onSelect, onCreateFolder }) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [expanded, setExpanded] = useState<string[]>([tree.path]);

  const renderNode = (node: FolderNode) => (
    <TreeItem
      key={node.path || 'root'}
      nodeId={node.path || 'root'}
      label={
        <Stack direction="row" alignItems="center" spacing={1}>
          {iconForFolder(node)}
          <Typography variant="body2" sx={{ fontWeight: node.path === selectedPath ? 700 : 500 }}>
            {node.title || node.name}
          </Typography>
        </Stack>
      }
      onClick={() => onSelect(node.path)}
    >
      {node.children
        .filter((child): child is FolderNode => child.type === 'folder')
        .map((child) => renderNode(child))}
    </TreeItem>
  );

  const handleCreate = () => {
    if (!newFolderName) return;
    const candidate = selectedPath ? `${selectedPath}/${newFolderName}` : newFolderName;
    onCreateFolder(candidate.replace(/\s+/g, '-').toLowerCase());
    setNewFolderName('');
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

  return (
    <Stack spacing={2} sx={{ height: '100%' }}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ letterSpacing: 1, textTransform: 'uppercase' }}>
          Arborescence ({folderCount})
        </Typography>
      </Box>
      <TreeView
        aria-label="explorateur"
        defaultCollapseIcon={<ExpandMoreIcon />}
        defaultExpandIcon={<ChevronRightIcon />}
        expanded={expanded}
        onNodeToggle={(_event: React.SyntheticEvent, nodeIds: string[]) => setExpanded(nodeIds)}
        selected={selectedPath || 'root'}
        sx={{ flex: 1, overflowY: 'auto', pr: 1 }}
      >
        {renderNode(tree)}
      </TreeView>
      <Divider sx={{ borderStyle: 'dashed' }} />
      <Stack spacing={1} component={motion.div} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeMotionIcon fontSize="small" />
          Nouveau nid créatif
        </Typography>
        <TextField
          size="small"
          label="Nom du dossier"
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleCreate();
            }
          }}
        />
        <Button variant="contained" onClick={handleCreate} disabled={!newFolderName}>
          Créer dans {selectedPath || 'la racine'}
        </Button>
      </Stack>
    </Stack>
  );
};
