import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditRounded';
import SaveIcon from '@mui/icons-material/SaveRounded';
import FolderIcon from '@mui/icons-material/FolderRounded';
import BrushIcon from '@mui/icons-material/BrushRounded';
import PhotoIcon from '@mui/icons-material/PhotoCameraRounded';
import CollectionsIcon from '@mui/icons-material/CollectionsRounded';
import { FolderNode, Settings } from '../api/types.js';
import { AttributeEditor } from './AttributeEditor.js';

interface Props {
  folder: FolderNode;
  settings: Settings;
  onSaveMetadata: (metadata: Partial<FolderNode>) => Promise<void> | void;
  onSaveDescription: (markdown: string) => Promise<void> | void;
  onRename?: (nextName: string) => Promise<void> | void;
}

export const FolderEditor: React.FC<Props> = ({ folder, settings, onSaveMetadata, onSaveDescription, onRename }) => {
  const [title, setTitle] = useState(folder.title || '');
  const [tags, setTags] = useState(folder.tags?.join(', ') || '');
  const [visibility, setVisibility] = useState(folder.visibility !== 'private');
  const [cover, setCover] = useState(folder.coverMedia || '');
  const [icon, setIcon] = useState(folder.icon || '');
  const [attributes, setAttributes] = useState(folder.attributes || {});
  const [description, setDescription] = useState(folder.description || '');
  const [message, setMessage] = useState<string | undefined>();
  const [renameValue, setRenameValue] = useState(folder.name);

  useEffect(() => {
    setTitle(folder.title || '');
    setTags(folder.tags?.join(', ') || '');
    setVisibility(folder.visibility !== 'private');
    setCover(folder.coverMedia || '');
    setIcon(folder.icon || '');
    setAttributes(folder.attributes || {});
    setDescription(folder.description || '');
    setRenameValue(folder.name);
  }, [folder]);

  const handleSaveMeta = async () => {
    await onSaveMetadata({
      title,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      visibility: visibility ? 'public' : 'private',
      coverMedia: cover,
      icon: icon || undefined,
      attributes
    } as any);
    setMessage('Métadonnées enregistrées ✨');
  };

  const handleSaveDescription = async () => {
    await onSaveDescription(description);
    setMessage('Description sauvegardée 📜');
  };

  const handleRename = async () => {
    if (!onRename || !renameValue || renameValue === folder.name) return;
    await onRename(renameValue);
    setMessage(`Dossier renommé en ${renameValue}`);
  };

  const iconOptions = useMemo(
    () => [
      { value: '', label: 'Automatique', icon: <FolderIcon fontSize="small" /> },
      { value: 'brush', label: 'Atelier / pinceaux', icon: <BrushIcon fontSize="small" /> },
      { value: 'photo', label: 'Photographies', icon: <PhotoIcon fontSize="small" /> },
      { value: 'croquis', label: 'Croquis', icon: <CollectionsIcon fontSize="small" /> }
    ],
    []
  );

  return (
    <Stack spacing={3}>
      {message && <Alert severity="success">{message}</Alert>}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {folder.title || folder.name}
        </Typography>
        <Typography variant="subtitle2" color="text.secondary">
          {folder.path || 'racine'}
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-end">
        <TextField label="Titre" value={title} onChange={(event) => setTitle(event.target.value)} sx={{ flex: 1 }} />
        {onRename && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Renommer"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              size="small"
            />
            <Button variant="outlined" startIcon={<EditIcon />} onClick={handleRename}>
              Renommer
            </Button>
          </Stack>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          label="Tags"
          helperText="Séparés par des virgules"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Media de couverture"
          value={cover}
          onChange={(event) => setCover(event.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Icône"
          value={icon}
          onChange={(event) => setIcon(event.target.value)}
          select
          sx={{ flex: 1 }}
          helperText="Icône affichée dans l'arborescence"
        >
          {iconOptions.map((option) => (
            <MenuItem key={option.value || 'default'} value={option.value}>
              <Stack direction="row" spacing={1} alignItems="center">
                {option.icon}
                <span>{option.label}</span>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={<Switch checked={visibility} onChange={(event) => setVisibility(event.target.checked)} />}
          label={visibility ? 'Visible' : 'Masqué'}
        />
      </Stack>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Description poétique
        </Typography>
        <TextField
          multiline
          minRows={6}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          fullWidth
        />
        <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 1 }} onClick={handleSaveDescription}>
          Sauvegarder la description
        </Button>
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Attributs personnalisés
        </Typography>
        <AttributeEditor attributes={attributes} settings={settings} onChange={setAttributes} />
        <Button variant="outlined" onClick={handleSaveMeta} startIcon={<SaveIcon />} sx={{ mt: 2 }}>
          Mettre à jour les métadonnées
        </Button>
      </Box>
    </Stack>
  );
};
