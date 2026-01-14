
export interface PhotoData {
  id: string;
  url: string;
  file: File;
}

export interface GeneratedImage {
  id: string;
  url: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

export type AppStatus = 'input' | 'processing' | 'completed';
