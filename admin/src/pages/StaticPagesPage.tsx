import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  InputAdornment,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/AddRounded';
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffRounded';
import SaveIcon from '@mui/icons-material/SaveRounded';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeRounded';
import LinkIcon from '@mui/icons-material/LinkRounded';

import { api, useStaticPages } from '../api/client.js';
import { StaticPage } from '../api/types.js';
import { Toolbar } from '../components/Toolbar.js';
import { RichTextEditor } from '../components/RichTextEditor.js';

const createId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const layoutPresets: Array<{ id: string; label: string; spans: number[] }> = [
  { id: 'one', label: '1 colonne pleine', spans: [12] },
  { id: 'two', label: '2 colonnes équilibrées', spans: [6, 6] },
  { id: 'two-wide', label: '2 colonnes (large + étroite)', spans: [8, 4] },
  { id: 'three', label: '3 colonnes', spans: [4, 4, 4] }
];

const clonePage = (page: StaticPage): StaticPage => ({
  ...page,
  sections: page.sections.map((section) => ({
    ...section,
    columns: section.columns.map((column) => ({ ...column }))
  }))
});

const ensureSections = (page: StaticPage): StaticPage => {
  if (page.sections.length > 0) return page;
  return {
    ...page,
    sections: [
      {
        id: createId(),
        columns: [
          {
            id: createId(),
            span: 12,
            content: ''
          }
        ]
      }
    ]
  };
};

export const StaticPagesPage: React.FC = () => {
  const { data: pages, error } = useStaticPages();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StaticPage | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (pages && pages.length > 0) {
      if (!selectedId || !pages.some((page) => page.id === selectedId)) {
        setSelectedId(pages[0].id);
      }
    } else {
      setSelectedId(null);
      setDraft(null);
    }
  }, [pages, selectedId]);

  useEffect(() => {
    if (!pages || !selectedId) {
      setDraft(null);
      setIsDirty(false);
      return;
    }
    const page = pages.find((item) => item.id === selectedId);
    if (page) {
      setDraft(ensureSections(clonePage(page)));
      setIsDirty(false);
      setErrorMessage(null);
    }
  }, [pages, selectedId]);

  const orderedPages = useMemo(() => (pages ? [...pages].sort((a, b) => a.order - b.order) : []), [pages]);

  const handleCreatePage = async () => {
    const title = window.prompt('Titre de la nouvelle page statique ?')?.trim();
    try {
      const created = await api.createStaticPage(title && title.length > 0 ? title : undefined);
      setSelectedId(created.id);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  const handleDeletePage = async (page: StaticPage) => {
    if (!window.confirm(`Supprimer définitivement la page « ${page.title} » ?`)) {
      return;
    }
    try {
      await api.deleteStaticPage(page.id);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  const handleToggleVisibility = async (page: StaticPage) => {
    try {
      await api.updateStaticPage(page.id, { visible: !page.visible });
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  const updateDraft = (updater: (current: StaticPage) => StaticPage) => {
    setDraft((current) => {
      if (!current) return current;
      const next = updater(current);
      setIsDirty(true);
      return next;
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await api.updateStaticPage(draft.id, {
        title: draft.title,
        slug: draft.slug,
        visible: draft.visible,
        order: draft.order,
        sections: draft.sections
      });
      setIsDirty(false);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateSlug = () => {
    if (!draft) return;
    const base = draft.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    updateDraft((current) => ({ ...current, slug: base || 'page-statique' }));
  };

  const handleAddSection = () => {
    updateDraft((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: createId(),
          columns: [
            {
              id: createId(),
              span: 12,
              content: ''
            }
          ]
        }
      ]
    }));
  };

  const handleRemoveSection = (sectionId: string) => {
    updateDraft((current) => ({
      ...current,
      sections: (() => {
        const remaining = current.sections.filter((section) => section.id !== sectionId);
        if (remaining.length > 0) return remaining;
        return [
          {
            id: createId(),
            columns: [
              {
                id: createId(),
                span: 12,
                content: ''
              }
            ]
          }
        ];
      })()
    }));
  };

  const handleLayoutChange = (sectionId: string, spans: number[]) => {
    updateDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const nextColumns = spans.map((span, index) => {
          const existing = section.columns[index];
          return {
            id: existing?.id ?? createId(),
            span,
            content: existing?.content ?? ''
          };
        });
        return {
          ...section,
          columns: nextColumns
        };
      })
    }));
  };

  const handleColumnContentChange = (sectionId: string, columnId: string, content: string) => {
    updateDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section;
        return {
          ...section,
          columns: section.columns.map((column) => (column.id === columnId ? { ...column, content } : column))
        };
      })
    }));
  };

  const handleMovePage = async (page: StaticPage, direction: -1 | 1) => {
    if (!pages) return;
    const targetOrder = page.order + direction;
    if (targetOrder < 0 || targetOrder >= pages.length) return;
    try {
      await api.updateStaticPage(page.id, { order: targetOrder });
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  return (
    <Stack sx={{ height: '100vh' }}>
      <Toolbar onRefresh={() => api.refreshStaticPages()} title={draft ? draft.title : 'Pages statiques'} />
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ width: 320, borderRight: '1px solid rgba(111,137,166,0.2)', p: 3, overflowY: 'auto' }}>
          <Stack spacing={2}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreatePage}>
              Nouvelle page
            </Button>
            {error && <Alert severity="error">Impossible de charger les pages statiques.</Alert>}
            <List dense sx={{ border: '1px solid rgba(111,137,166,0.2)', borderRadius: 2 }}>
              {orderedPages.map((page) => (
                <ListItem
                  key={page.id}
                  disablePadding
                  secondaryAction={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Tooltip title="Monter">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleMovePage(page, -1)}
                            disabled={page.order === 0}
                          >
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Descendre">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleMovePage(page, 1)}
                            disabled={page.order === orderedPages.length - 1}
                          >
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={page.visible ? 'Masquer la page' : 'Publier la page'}>
                        <IconButton size="small" onClick={() => handleToggleVisibility(page)}>
                          {page.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" onClick={() => handleDeletePage(page)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <ListItemButton selected={page.id === selectedId} onClick={() => setSelectedId(page.id)}>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {page.title}
                          </Typography>
                          {!page.visible && <Chip size="small" label="cachée" color="warning" />}
                        </Stack>
                      }
                      secondary={`/${page.slug}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {orderedPages.length === 0 && (
                <ListItem>
                  <ListItemText primary="Aucune page statique pour le moment." />
                </ListItem>
              )}
            </List>
          </Stack>
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
          {!draft && (
            <Stack spacing={3} alignItems="center" justifyContent="center" sx={{ mt: 8 }}>
              <AutoAwesomeIcon color="primary" sx={{ fontSize: 48 }} />
              <Typography variant="h6" textAlign="center">
                Sélectionnez une page statique ou créez-en une nouvelle pour commencer.
              </Typography>
            </Stack>
          )}
          {draft && (
            <Stack spacing={4}>
              {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField
                  label="Titre"
                  value={draft.title}
                  onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
                  fullWidth
                />
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography component="span" variant="body2">
                    Visible ?
                  </Typography>
                  <Switch
                    checked={draft.visible}
                    onChange={(event) => updateDraft((current) => ({ ...current, visible: event.target.checked }))}
                  />
                </Stack>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField
                  label="Slug"
                  value={draft.slug}
                  onChange={(event) => updateDraft((current) => ({ ...current, slug: event.target.value }))}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                    )
                  }}
                />
                <Button variant="outlined" onClick={handleRegenerateSlug}>
                  Régénérer
                </Button>
              </Stack>

              <Stack spacing={3}>
                {draft.sections.map((section, index) => (
                  <Stack key={section.id} spacing={2} sx={{ border: '1px solid rgba(111,137,166,0.25)', borderRadius: 2, p: 2.5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Section {index + 1}
                      </Typography>
                      <Select
                        size="small"
                        value={layoutPresets.find((preset) =>
                          preset.spans.length === section.columns.length &&
                          preset.spans.every((span, idx) => section.columns[idx]?.span === span)
                        )?.id || 'custom'}
                        onChange={(event) => {
                          const preset = layoutPresets.find((item) => item.id === event.target.value);
                          if (preset) {
                            handleLayoutChange(section.id, preset.spans);
                          }
                        }}
                        sx={{ minWidth: 220 }}
                      >
                        {layoutPresets.map((preset) => (
                          <MenuItem key={preset.id} value={preset.id}>
                            {preset.label}
                          </MenuItem>
                        ))}
                        <MenuItem value="custom" disabled>
                          Disposition personnalisée
                        </MenuItem>
                      </Select>
                      <Box flex={1} />
                      <Button color="warning" onClick={() => handleRemoveSection(section.id)}>
                        Supprimer la section
                      </Button>
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      {section.columns.map((column, columnIndex) => (
                        <Box key={column.id} sx={{ flex: column.span, minWidth: 0 }}>
                          <RichTextEditor
                            value={column.content}
                            onChange={(content) => handleColumnContentChange(section.id, column.id, content)}
                            placeholder={`Contenu de la colonne ${columnIndex + 1}`}
                            label={`Colonne ${columnIndex + 1}`}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                ))}
              </Stack>

              <Stack direction="row" spacing={2}>
                <Button variant="outlined" onClick={handleAddSection}>
                  Ajouter une section
                </Button>
                <Box flex={1} />
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer la page'}
                </Button>
              </Stack>
            </Stack>
          )}
        </Box>
      </Box>
    </Stack>
  );
};
