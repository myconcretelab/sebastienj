import React, { createContext, useContext, useMemo, useState } from 'react';

export type Selection = {
  folderPath: string;
  mediaPath?: string;
  setFolderPath: (path: string) => void;
  setMediaPath: (path?: string) => void;
};

const SelectionContext = createContext<Selection | undefined>(undefined);

export const SelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [folderPath, setFolderPath] = useState('');
  const [mediaPath, setMediaPath] = useState<string | undefined>();

  const value = useMemo(
    () => ({
      folderPath,
      mediaPath,
      setFolderPath: (path: string) => {
        setFolderPath(path);
        setMediaPath(undefined);
      },
      setMediaPath
    }),
    [folderPath, mediaPath]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
};

export const useSelection = () => {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error('SelectionProvider is missing');
  }
  return ctx;
};
