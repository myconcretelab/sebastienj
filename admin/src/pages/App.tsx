import React, { useEffect, useMemo } from 'react';
import { Box, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { Routes, Route } from 'react-router-dom';
import { useTree, useSettings, api } from '../api/client.js';
import { Toolbar } from '../components/Toolbar.js';
import { ExplorerView } from '../components/ExplorerView.js';
import { FolderEditor } from '../components/FolderEditor.js';
import { MediaGrid } from '../components/MediaGrid.js';
import { MediaEditor } from '../components/MediaEditor.js';
import { SettingsPage } from './SettingsPage.js';
import { StaticPagesPage } from './StaticPagesPage.js';
import { SelectionProvider, useSelection } from '../state/SelectionContext.js';
import { FolderNode, MediaNode, Settings } from '../api/types.js';

const findFolder = (root: FolderNode, path: string): FolderNode | undefined => {
  if (!path || root.path === path) return root;
  for (const child of root.children) {
    if (child.type === 'folder') {
      const found = findFolder(child, path);
      if (found) return found;
    }
  }
  return undefined;
};

const AdminView: React.FC<{ tree: FolderNode; settings: Settings }> = ({ tree, settings }) => {
  const { folderPath, mediaPath, setFolderPath, setMediaPath } = useSelection();

  useEffect(() => {
    if (folderPath === undefined || folderPath === null) {
      setFolderPath(tree.path || '');
    }
  }, [folderPath, setFolderPath, tree.path]);

  const currentFolder = useMemo(() => findFolder(tree, folderPath) || tree, [tree, folderPath]);
  const medias = useMemo(() => currentFolder.children.filter((child): child is MediaNode => child.type === 'media'), [
    currentFolder
  ]);
  const selectedMedia = medias.find((media) => media.path === mediaPath);

  const handleCreateFolder = async (path: string) => {
    await api.createFolder(path);
    await api.refreshTree();
  };

  return (
    <Stack sx={{ height: '100vh' }}>
      <Toolbar
        onRefresh={() => api.refreshTree()}
        onNewFolder={() => {
          const name = window.prompt('Nom du dossier à créer dans la racine ?');
          if (name) handleCreateFolder(name.trim());
        }}
        title={currentFolder.title || currentFolder.name}
      />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ width: 320, borderRight: '1px solid rgba(111,137,166,0.2)', p: 3, overflowY: 'auto' }}>
          <ExplorerView
            tree={tree}
            selectedPath={currentFolder.path}
            onSelect={(path) => setFolderPath(path)}
            onCreateFolder={handleCreateFolder}
          />
        </Box>
        <Divider orientation="vertical" flexItem variant="middle" />
        <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
          <Stack spacing={4}>
            <FolderEditor
              folder={currentFolder}
              settings={settings}
              onSaveMetadata={(metadata) => api.saveFolderMeta(currentFolder.path, metadata)}
              onSaveDescription={(markdown) => api.saveFolderDescription(currentFolder.path, markdown)}
              onRename={currentFolder.path ? (nextName) => api.renameFolder(currentFolder.path, nextName) : undefined}
            />

            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Médias ({medias.length})
              </Typography>
              <MediaGrid
                medias={medias}
                selectedPath={selectedMedia?.path}
                onSelect={(path) => setMediaPath(path)}
              />
            </Box>

            {selectedMedia && (
              <MediaEditor
                media={selectedMedia}
                settings={settings}
                onSaveMetadata={(metadata) => api.saveMediaMeta(selectedMedia.path, metadata)}
                onRename={(nextName) => api.renameMedia(selectedMedia.path, nextName)}
                onMove={(destination) => api.moveMedia(selectedMedia.path, destination)}
                onDelete={async () => {
                  await api.deleteMedia(selectedMedia.path);
                  setMediaPath(undefined);
                }}
              />
            )}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
};

const AppRoutes: React.FC = () => {
  const { data: tree, error: treeError } = useTree();
  const { data: settings, error: settingsError } = useSettings();

  if (treeError || settingsError) {
    return (
      <Box sx={{ p: 6 }}>
        <Typography variant="h6">Une erreur est survenue. {treeError?.message || settingsError?.message}</Typography>
      </Box>
    );
  }

  if (!tree || !settings) {
    return (
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<AdminView tree={tree} settings={settings} />} />
      <Route path="/pages" element={<StaticPagesPage />} />
      <Route path="/settings" element={<SettingsPage settings={settings} />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <SelectionProvider>
    <AppRoutes />
  </SelectionProvider>
);

export default App;
