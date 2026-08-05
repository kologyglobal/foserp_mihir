import type { ExpoConfig, ConfigContext } from 'expo/config'

/**
 * App config — public values only.
 * API base URLs come from EXPO_PUBLIC_* env (see .env.example).
 * No JWT secrets, DB, or SMTP values may be placed here.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development'
  const appVersion = process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.0'
  const buildNumber = process.env.EXPO_PUBLIC_BUILD_NUMBER ?? '1'

  return {
    ...config,
    name: 'FOS ERP',
    slug: 'fos-erp-mobile',
    version: appVersion,
    orientation: 'portrait',
    scheme: 'fos-erp',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.fos.erp.mobile',
      buildNumber,
      infoPlist: {
        NSCameraUsageDescription:
          'Camera is used to scan warehouse barcodes and QR codes, business cards, CRM photos, and documents.',
        NSPhotoLibraryUsageDescription: 'Photo library is used for business card import and CRM attachments.',
        NSMicrophoneUsageDescription: 'Microphone is used to record CRM voice notes on follow-ups and meetings.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.fos.erp.mobile',
      versionCode: Number.parseInt(buildNumber, 10) || 1,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow FOS ERP to use the camera to scan barcodes, QR codes, business cards, and documents.',
          microphonePermission: 'Allow FOS ERP to access the microphone when recording video.',
          recordAudioAndroid: false,
          barcodeScannerEnabled: true,
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow FOS ERP to access photos for CRM attachments.',
          cameraPermission: 'Allow FOS ERP to use the camera for CRM capture and barcode scanning.',
        },
      ],
      [
        'expo-av',
        {
          microphonePermission: 'Allow FOS ERP to record CRM voice notes.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appEnv,
      appVersion,
      buildNumber,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
      defaultTenantSlug: process.env.EXPO_PUBLIC_DEFAULT_TENANT_SLUG ?? '',
      router: {
        origin: false,
      },
    },
  }
}
