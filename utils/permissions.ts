import { Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, PermissionStatus, Permission } from 'react-native-permissions';

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version, 10);

  let permission: Permission;
  if (apiLevel >= 33) {
    // Android 13+ (API 33+)
    permission = PERMISSIONS.ANDROID.READ_MEDIA_VIDEO;
  } else {
    // Android 12 and below
    permission = PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
  }

  let status: PermissionStatus = await check(permission);

  if (status === RESULTS.DENIED || status === RESULTS.LIMITED) {
    status = await request(permission);
  }

  return status === RESULTS.GRANTED;
} 