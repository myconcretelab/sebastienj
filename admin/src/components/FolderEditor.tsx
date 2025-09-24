import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import SaveIcon from '@mui/icons-material/SaveRounded';
import { FolderNode, Settings } from '../api/types.js';
import { AttributeEditor } from './AttributeEditor.js';

interface Props {
  folder: FolderNode;
  settings: Settings;
  onSaveMetadata: (metadata: Partial<FolderNode>) => Promise<void> | void;
  onSaveDescription: (markdown: string) => Promise<void> | void;
}

export const FolderEditor: React.FC<Props> = ({ folder, settings, onSaveMetadata, onSaveDescription }) => {
  const [title, setTitle] = useState(folder.title || '');
  const [tags, setTags] = useState(folder.tags?.join(', ') || '');
  const [visibility, setVisibility] = useState(folder.visibility !== 'private');
  const [attributes, setAttributes] = useState(folder.attributes || {});
  const [description, setDescription] = useState(folder.description || '');
  const [message, setMessage] = useState<string | undefined>();
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    setTitle(folder.title || '');
    setTags(folder.tags?.join(', ') || '');
    setVisibility(folder.visibility !== 'private');
    setAttributes(folder.attributes || {});
    setDescription(folder.description || '');
    setMessage(undefined);
    setMessageType('success');
  }, [folder]);

  const handleSaveAll = async () => {
    try {
      await onSaveMetadata({
        title,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        visibility: visibility ? 'public' : 'private',
        attributes
      } as any);
      await onSaveDescription(description);
      setMessage('Dossier mis à jour ✨');
      setMessageType('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d'enregistrer");
      setMessageType('error');
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {folder.title || folder.name}
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">
            {folder.path || 'racine'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveAll}
          sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
        >
          Enregistrer
        </Button>
      </Stack>

      {message && <Alert severity={messageType}>{message}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField label="Titre" value={title} onChange={(event) => setTitle(event.target.value)} sx={{ flex: 1 }} />
        <TextField
          label="Tags"
          helperText="Séparés par des virgules"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          sx={{ flex: 1 }}
        />
      </Stack>

      <FormControlLabel
        control={<Switch checked={visibility} onChange={(event) => setVisibility(event.target.checked)} />}
        label={visibility ? 'Visible' : 'Masqué'}
      />

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
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Attributs personnalisés
        </Typography>
        <AttributeEditor attributes={attributes} settings={settings} onChange={setAttributes} />
      </Box>
    </Stack>
  );
};
