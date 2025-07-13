import RNFS from 'react-native-fs';

const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', '3gp', 'mpeg', 'mpg', 'm4v'];

export type VideoFile = {
  name: string;
  path: string;
  isFile: true;
  fileSize?: string;
  resolution?: string;
  duration?: string;
  lastModified?: string;
};

export type FolderNode = {
  name: string;
  path: string;
  isFile: false;
  children: Array<FolderNode | VideoFile>;
};

function isVideoFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return !!ext && VIDEO_EXTENSIONS.includes(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function scanForVideos(
  dirPath: string = RNFS.ExternalStorageDirectoryPath
): Promise<FolderNode> {
  const name = dirPath.split('/').pop() || dirPath;
  const children: Array<FolderNode | VideoFile> = [];
  try {
    const items = await RNFS.readDir(dirPath);
    for (const item of items) {
      if (item.isDirectory()) {
        // Recursively scan subfolders
        const folderNode = await scanForVideos(item.path);
        // Only add folders that contain videos or subfolders
        if (folderNode.children.length > 0) {
          children.push(folderNode);
        }
      } else if (item.isFile() && isVideoFile(item.name)) {
        // Get file stats for additional information
        try {
          const stats = await RNFS.stat(item.path);
          const fileSize = formatFileSize(stats.size);
          const lastModified = new Date(stats.mtime).toLocaleDateString();
          
          children.push({ 
            name: item.name, 
            path: item.path, 
            isFile: true,
            fileSize,
            lastModified,
            resolution: 'Unknown', // Will be updated later if needed
            duration: 'Unknown'    // Will be updated later if needed
          });
        } catch (e) {
          // Fallback if stats can't be read
          children.push({ name: item.name, path: item.path, isFile: true });
        }
      }
    }
  } catch (e) {
    // Ignore folders we can't access
  }
  return { name, path: dirPath, isFile: false, children };
} 