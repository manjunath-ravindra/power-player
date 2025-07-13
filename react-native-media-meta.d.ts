declare module 'react-native-media-meta' {
  const MediaMeta: {
    get: (filePath: string) => Promise<{
      duration?: number;
      width?: number;
      height?: number;
      orientation?: number;
      size?: number;
      mimeType?: string;
      bitrate?: number;
      [key: string]: any;
    }>;
  };
  export default MediaMeta;
} 