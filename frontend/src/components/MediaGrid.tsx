import React from 'react';
import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import { MediaNode } from '../api/types.js';
import { motion } from 'framer-motion';
import ImageIcon from '@mui/icons-material/ImageRounded';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffRounded';

interface Props {
  medias: MediaNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
}

const MotionCard = motion(Card);

export const MediaGrid: React.FC<Props> = ({ medias, selectedPath, onSelect }) => {
  if (medias.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, opacity: 0.7 }}>
        <Typography variant="subtitle1">Ce dossier attend encore sa première image.</Typography>
        <Typography variant="body2">Déposez vos créations via SFTP ou glissez-déposez dans le futur uploader.</Typography>
      </Box>
    );
  }

  return (
    <Stack direction="row" flexWrap="wrap" gap={2}>
      {medias.map((media) => (
        <MotionCard
          key={media.path}
          onClick={() => onSelect(media.path)}
          whileHover={{ y: -4, boxShadow: '0 12px 24px rgba(111, 137, 166, 0.16)' }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          sx={{
            width: 200,
            borderRadius: 4,
            border: media.path === selectedPath ? '2px solid #6f89a6' : '1px solid rgba(111,137,166,0.2)',
            position: 'relative'
          }}
        >
          <CardActionArea sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
            <ImageIcon fontSize="large" color="disabled" />
          </CardActionArea>
          <CardContent sx={{ minHeight: 100 }}>
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" noWrap>
                {media.title || media.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {media.path}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {media.tags?.slice(0, 3).map((tag) => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
                {media.visibility === 'private' && (
                  <Chip icon={<VisibilityOffIcon />} label="Privé" size="small" color="warning" variant="outlined" />
                )}
              </Stack>
            </Stack>
          </CardContent>
        </MotionCard>
      ))}
    </Stack>
  );
};
