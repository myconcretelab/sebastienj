import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/PaletteRounded';
import AddIcon from '@mui/icons-material/AddRounded';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import { Settings } from '../api/types.js';
import { api, useThumbnails } from '../api/client.js';
import { ThumbnailSettingsPanel } from '../components/ThumbnailSettingsPanel.js';

interface Props {
  settings: Settings;
}

export const SettingsPage: React.FC<Props> = ({ settings }) => {
  const [draft, setDraft] = useState(settings);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [tab, setTab] = useState<'general' | 'thumbnails'>('general');
  const { data: thumbnailSummary, error: thumbnailError } = useThumbnails();

  const updateAttribute = (index: number, key: keyof Settings['attributeTypes'][number], value: any) => {
    const next = { ...draft };
    next.attributeTypes = [...draft.attributeTypes];
    next.attributeTypes[index] = { ...next.attributeTypes[index], [key]: value };
    setDraft(next);
  };

  const addAttribute = () => {
    setDraft({
      ...draft,
      attributeTypes: [
        ...draft.attributeTypes,
        { id: `custom-${Date.now()}`, label: 'Nouvel attribut', input: 'text' as const }
      ]
    });
  };

  const removeAttribute = (index: number) => {
    const next = { ...draft };
    next.attributeTypes = draft.attributeTypes.filter((_, idx) => idx !== index);
    setDraft(next);
  };

  const save = async () => {
    try {
      await api.updateSettings(draft);
      setMessage('Réglages sauvegardés 🎈');
      setMessageType('success');
    } catch (error) {
      setMessage((error as Error).message);
      setMessageType('error');
    }
  };

  return (
    <Stack spacing={4} sx={{ p: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Paramètres de l'atelier
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Définissez le vocabulaire des métadonnées, l'identité visuelle et les miniatures.
        </Typography>
      </Box>

      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        textColor="primary"
        indicatorColor="primary"
        sx={{ borderBottom: '1px solid rgba(111,137,166,0.2)' }}
      >
        <Tab label="Général" value="general" />
        <Tab label="Miniatures" value="thumbnails" />
      </Tabs>

      {tab === 'general' && (
        <Stack spacing={4}>
          {message && <Alert severity={messageType}>{message}</Alert>}
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <PaletteIcon color="primary" />
                <Typography variant="h6">Palette et ambiance</Typography>
              </Stack>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Thème"
                    value={draft.ui.theme}
                    onChange={(event) => setDraft({ ...draft, ui: { ...draft.ui, theme: event.target.value } })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Couleur d'accent"
                    type="color"
                    value={draft.ui.accentColor}
                    onChange={(event) => setDraft({ ...draft, ui: { ...draft.ui, accentColor: event.target.value } })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Couleur papier"
                    type="color"
                    value={draft.ui.paperColor}
                    onChange={(event) => setDraft({ ...draft, ui: { ...draft.ui, paperColor: event.target.value } })}
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Lightbox
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Couleur de l'overlay"
                    type="color"
                    value={draft.ui.lightbox.overlayColor}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        ui: {
                          ...draft.ui,
                          lightbox: { ...draft.ui.lightbox, overlayColor: event.target.value }
                        }
                      })
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Opacité de l'overlay"
                    type="number"
                    value={draft.ui.lightbox.overlayOpacity}
                    inputProps={{ min: 0, max: 1, step: 0.05 }}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDraft({
                        ...draft,
                        ui: {
                          ...draft.ui,
                          lightbox: {
                            ...draft.ui.lightbox,
                            overlayOpacity: Number.isNaN(value)
                              ? draft.ui.lightbox.overlayOpacity
                              : value
                          }
                        }
                      });
                    }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Flou de l'overlay (px)"
                    type="number"
                    value={draft.ui.lightbox.overlayBlur}
                    inputProps={{ min: 0, max: 96, step: 1 }}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDraft({
                        ...draft,
                        ui: {
                          ...draft.ui,
                          lightbox: {
                            ...draft.ui.lightbox,
                            overlayBlur: Number.isNaN(value) ? draft.ui.lightbox.overlayBlur : value
                          }
                        }
                      });
                    }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Fond de la carte"
                    type="color"
                    value={draft.ui.lightbox.backgroundColor}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        ui: {
                          ...draft.ui,
                          lightbox: { ...draft.ui.lightbox, backgroundColor: event.target.value }
                        }
                      })
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Rayon des bords (px)"
                    type="number"
                    value={draft.ui.lightbox.borderRadius}
                    inputProps={{ min: 0, max: 96, step: 1 }}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDraft({
                        ...draft,
                        ui: {
                          ...draft.ui,
                          lightbox: {
                            ...draft.ui.lightbox,
                            borderRadius: Number.isNaN(value) ? draft.ui.lightbox.borderRadius : value
                          }
                        }
                      });
                    }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Largeur maximale (px)"
                    type="number"
                    value={draft.ui.lightbox.maxWidth}
                    inputProps={{ min: 240, max: 2000, step: 10 }}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDraft({
                        ...draft,
                        ui: {
                          ...draft.ui,
                          lightbox: {
                            ...draft.ui.lightbox,
                            maxWidth: Number.isNaN(value) ? draft.ui.lightbox.maxWidth : value
                          }
                        }
                      });
                    }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Marge intérieure (px)"
                    type="number"
                    value={draft.ui.lightbox.padding}
                    inputProps={{ min: 12, max: 160, step: 1 }}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDraft({
                        ...draft,
                        ui: {
                          ...draft.ui,
                          lightbox: {
                            ...draft.ui.lightbox,
                            padding: Number.isNaN(value) ? draft.ui.lightbox.padding : value
                          }
                        }
                      });
                    }}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="h6">Types d'attributs</Typography>
                <Button startIcon={<AddIcon />} onClick={addAttribute} variant="outlined">
                  Ajouter un type
                </Button>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={2}>
                {draft.attributeTypes.map((attribute, index) => (
                  <Stack key={attribute.id} direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                    <TextField
                      label="Identifiant"
                      value={attribute.id}
                      onChange={(event) => updateAttribute(index, 'id', event.target.value)}
                      size="small"
                    />
                    <TextField
                      label="Label"
                      value={attribute.label}
                      onChange={(event) => updateAttribute(index, 'label', event.target.value)}
                      size="small"
                    />
                    <TextField
                      select
                      label="Composant"
                      value={attribute.input}
                      onChange={(event) => updateAttribute(index, 'input', event.target.value)}
                      size="small"
                      sx={{ minWidth: 160 }}
                    >
                      {['text', 'textarea', 'checkbox', 'date', 'number', 'link', 'image', 'select', 'color'].map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Options (sélection)"
                      value={attribute.options?.join(', ') || ''}
                      onChange={(event) =>
                        updateAttribute(index, 'options', event.target.value.split(',').map((value: string) => value.trim()))
                      }
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <Button color="error" startIcon={<DeleteIcon />} onClick={() => removeAttribute(index)}>
                      Retirer
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Button variant="contained" size="large" onClick={save} sx={{ alignSelf: 'flex-start' }}>
            Sauvegarder les réglages
          </Button>
        </Stack>
      )}

      {tab === 'thumbnails' && (
        <Box>
          {thumbnailError && <Alert severity="error">{thumbnailError.message}</Alert>}
          {!thumbnailSummary && !thumbnailError && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          )}
          {thumbnailSummary && (
            <ThumbnailSettingsPanel
              summary={thumbnailSummary}
              onSave={(config) => api.updateThumbnails(config)}
              onRebuild={() => api.rebuildThumbnails()}
            />
          )}
        </Box>
      )}
    </Stack>
  );
};
