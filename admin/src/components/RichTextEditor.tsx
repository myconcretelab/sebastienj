import React, { useEffect, useMemo, useRef } from 'react';
import { Box, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkIcon from '@mui/icons-material/Link';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import TitleIcon from '@mui/icons-material/Title';

interface RichTextEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  label?: string;
}

type ToolbarCommand = {
  icon: React.ReactNode;
  command: string;
  label: string;
  value?: string;
};

const commands: ToolbarCommand[] = [
  { icon: <FormatBoldIcon fontSize="small" />, command: 'bold', label: 'Gras' },
  { icon: <FormatItalicIcon fontSize="small" />, command: 'italic', label: 'Italique' },
  { icon: <FormatUnderlinedIcon fontSize="small" />, command: 'underline', label: 'Souligner' },
  { icon: <FormatQuoteIcon fontSize="small" />, command: 'formatBlock', value: 'blockquote', label: 'Citation' },
  { icon: <TitleIcon fontSize="small" />, command: 'formatBlock', value: 'h2', label: 'Titre' },
  { icon: <FormatListBulletedIcon fontSize="small" />, command: 'insertUnorderedList', label: 'Liste à puces' },
  { icon: <FormatListNumberedIcon fontSize="small" />, command: 'insertOrderedList', label: 'Liste numérotée' }
];

const createId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, label }) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const internalId = useMemo(createId, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const handleLink = () => {
    const url = window.prompt('Adresse du lien ?');
    if (url) {
      handleCommand('createLink', url);
    }
  };

  return (
    <Stack spacing={1.5} sx={{ border: '1px solid rgba(111,137,166,0.3)', borderRadius: 2, overflow: 'hidden', background: '#fff' }}>
      <Box sx={{ px: 1.5, py: 1, background: 'rgba(240,245,250,0.5)', display: 'flex', alignItems: 'center', gap: 1 }}>
        {label && (
          <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {label}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {commands.map((item) => (
            <Tooltip key={item.label} title={item.label} placement="top">
              <IconButton size="small" onClick={() => handleCommand(item.command, item.value)}>
                {item.icon}
              </IconButton>
            </Tooltip>
          ))}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Insérer un lien" placement="top">
            <IconButton size="small" onClick={handleLink}>
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Box
        id={internalId}
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML ?? '')}
        onBlur={() => onChange(editorRef.current?.innerHTML ?? '')}
        sx={{
          minHeight: 160,
          px: 2,
          py: 1.5,
          outline: 'none',
          '&:empty::before': {
            content: `'${placeholder ?? 'Commencez à écrire...'}'`,
            color: 'rgba(0,0,0,0.35)'
          },
          '& h2': {
            margin: '0 0 0.4em',
            fontSize: '1.4rem'
          },
          '& blockquote': {
            borderLeft: '3px solid rgba(25, 118, 210, 0.35)',
            margin: '0 0 1em',
            padding: '0.2em 0 0.2em 1em',
            color: 'rgba(0,0,0,0.7)'
          },
          '& ul, & ol': {
            paddingLeft: '1.4em',
            margin: '0 0 1em'
          },
          '& p': {
            margin: '0 0 1em'
          }
        }}
      />
    </Stack>
  );
};
