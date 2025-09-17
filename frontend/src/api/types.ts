export type AttributeValue =
  | { type: 'text'; value: string }
  | { type: 'textarea'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'date'; value: string }
  | { type: 'number'; value: number }
  | { type: 'link'; value: { url: string; label?: string } }
  | { type: 'image'; value: string }
  | { type: 'select'; value: string }
  | { type: 'color'; value: string };

export type FolderNode = {
  type: 'folder';
  name: string;
  path: string;
  title?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  attributes?: Record<string, AttributeValue>;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  icon?: string;
  coverMedia?: string;
  children: Array<FolderNode | MediaNode>;
};

export type MediaVariant = {
  format: string;
  path: string;
  size?: number;
};

export type MediaNode = {
  type: 'media';
  name: string;
  path: string;
  title?: string;
  tags?: string[];
  visibility?: 'public' | 'private';
  attributes?: Record<string, AttributeValue>;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  mimeType: string | false;
  variants?: MediaVariant[];
  focalPoint?: { x: number; y: number };
  colorPalette?: string[];
};

export type Settings = {
  attributeTypes: Array<{
    id: string;
    label: string;
    input:
      | 'text'
      | 'textarea'
      | 'checkbox'
      | 'date'
      | 'number'
      | 'link'
      | 'image'
      | 'select'
      | 'color';
    options?: string[];
    description?: string;
  }>;
  defaultFolderAttributes: Record<string, AttributeValue>;
  defaultMediaAttributes: Record<string, AttributeValue>;
  ui: {
    theme: string;
    accentColor: string;
    paperColor: string;
    texture?: string;
    animation: {
      duration: number;
      easing: string;
    };
  };
  previews: {
    enabled: boolean;
    tokenExpirationMinutes: number;
  };
};

export type Orphans = {
  metadataWithoutFiles: {
    folders: string[];
    medias: string[];
  };
  filesWithoutMetadata: {
    folders: string[];
    medias: string[];
  };
};
