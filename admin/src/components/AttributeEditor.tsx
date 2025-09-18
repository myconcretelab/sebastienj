import React, { useState } from 'react';
import { Box, Button, IconButton, MenuItem, Stack, TextField, InputAdornment } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import ColorLensIcon from '@mui/icons-material/ColorLensRounded';
import { AttributeValue, Settings } from '../api/types.js';

const defaultValueFor = (type: AttributeValue['type'] | 'textarea' | 'select') => {
  switch (type) {
    case 'boolean':
      return false;
    case 'date':
      return new Date().toISOString().slice(0, 10);
    case 'number':
      return 0;
    case 'link':
      return { url: '' };
    case 'image':
      return '';
    case 'select':
      return '';
    case 'color':
      return '#ffffff';
    default:
      return '';
  }
};

interface Props {
  attributes?: Record<string, AttributeValue>;
  settings: Settings;
  onChange: (next: Record<string, AttributeValue>) => void;
}

export const AttributeEditor: React.FC<Props> = ({ attributes = {}, settings, onChange }) => {
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState(settings.attributeTypes[0]?.id ?? 'text');

  const handleUpdate = (key: string, value: AttributeValue) => {
    onChange({
      ...attributes,
      [key]: value
    });
  };

  const handleRemove = (key: string) => {
    const copy = { ...attributes };
    delete copy[key];
    onChange(copy);
  };

  const addAttribute = () => {
    if (!newKey) return;
    const type = settings.attributeTypes.find((item) => item.id === newType)?.input ?? 'text';
    const normalizedType = type === 'textarea' ? 'text' : type;
    handleUpdate(newKey, { type: normalizedType as AttributeValue['type'], value: defaultValueFor(type as any) as any });
    setNewKey('');
  };

  const renderField = (key: string, attribute: AttributeValue) => {
    switch (attribute.type) {
      case 'boolean':
        return (
          <TextField
            select
            label="Valeur"
            value={attribute.value ? 'true' : 'false'}
            onChange={(event) => handleUpdate(key, { type: 'boolean', value: event.target.value === 'true' })}
          >
            <MenuItem value="true">Oui</MenuItem>
            <MenuItem value="false">Non</MenuItem>
          </TextField>
        );
      case 'date':
        return (
          <TextField
            label="Date"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={attribute.value}
            onChange={(event) => handleUpdate(key, { type: 'date', value: event.target.value })}
          />
        );
      case 'number':
        return (
          <TextField
            label="Nombre"
            type="number"
            value={attribute.value}
            onChange={(event) => handleUpdate(key, { type: 'number', value: Number(event.target.value) })}
          />
        );
      case 'link':
        return (
          <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
            <TextField
              label="URL"
              value={attribute.value.url}
              onChange={(event) =>
                handleUpdate(key, { type: 'link', value: { ...attribute.value, url: event.target.value } })
              }
              InputProps={{ startAdornment: <InputAdornment position="start">https://</InputAdornment> }}
            />
            <TextField
              label="Titre"
              value={attribute.value.label ?? ''}
              onChange={(event) =>
                handleUpdate(key, { type: 'link', value: { ...attribute.value, label: event.target.value } })
              }
            />
          </Stack>
        );
      case 'image':
        return (
          <TextField
            label="Chemin image"
            value={attribute.value}
            onChange={(event) => handleUpdate(key, { type: 'image', value: event.target.value })}
            InputProps={{ endAdornment: <InputAdornment position="end">🖼️</InputAdornment> }}
          />
        );
      case 'color':
        return (
          <TextField
            label="Couleur"
            type="color"
            value={attribute.value}
            onChange={(event) => handleUpdate(key, { type: 'color', value: event.target.value })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <ColorLensIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        );
      default:
        return (
          <TextField
            label="Valeur"
            multiline={attribute.type === 'text'}
            minRows={attribute.type === 'text' ? 2 : 1}
            value={attribute.value as string}
            onChange={(event) => handleUpdate(key, { type: attribute.type, value: event.target.value })}
          />
        );
    }
  };

  return (
    <Stack spacing={2}>
      {Object.entries(attributes).map(([key, attribute]) => (
        <Stack key={key} direction="row" spacing={1} alignItems="center">
          <TextField label="Nom" value={key} disabled sx={{ width: 160 }} />
          <Box sx={{ flex: 1 }}>{renderField(key, attribute)}</Box>
          <IconButton onClick={() => handleRemove(key)}>
            <DeleteIcon />
          </IconButton>
        </Stack>
      ))}
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          label="Nom de l'attribut"
          value={newKey}
          onChange={(event) => setNewKey(event.target.value)}
          size="small"
          sx={{ width: 180 }}
        />
        <TextField
          select
          label="Type"
          value={newType}
          size="small"
          onChange={(event) => setNewType(event.target.value)}
        >
          {settings.attributeTypes.map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {type.label}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" onClick={addAttribute} disabled={!newKey}>
          Ajouter
        </Button>
      </Stack>
    </Stack>
  );
};
