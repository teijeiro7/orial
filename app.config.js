export default {
  expo: {
    name: process.env.EXPO_PUBLIC_APP_NAME || 'Orial',
    slug: 'orial',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    scheme: process.env.EXPO_PUBLIC_APP_SCHEME || 'orial',
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0A1A'
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.orial.app',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              process.env.EXPO_PUBLIC_APP_SCHEME || 'orial',
              process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID 
                ? `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.split('.')[0]}`
                : 'com.googleusercontent.apps.YOUR_CLIENT_ID'
            ]
          }
        ]
      }
    },
    android: {
      package: 'com.orial.app',
      // Temporarily disabled for iOS-only prebuild
      // googleServicesFile: process.env.EXPO_PUBLIC_ANDROID_GOOGLE_SERVICES || './google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0A1A'
      },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: process.env.EXPO_PUBLIC_APP_SCHEME || 'orial'
            }
          ],
          category: ['BROWSABLE', 'DEFAULT']
        }
      ],
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-firebase/messaging',
      [
        'react-native-fbsdk-next',
        {
          appID: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || 'YOUR_FACEBOOK_APP_ID',
          clientToken: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN || 'YOUR_FACEBOOK_CLIENT_TOKEN',
          displayName: process.env.EXPO_PUBLIC_APP_NAME || 'Orial',
          scheme: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID 
            ? `fb${process.env.EXPO_PUBLIC_FACEBOOK_APP_ID}`
            : 'fbYOUR_FACEBOOK_APP_ID',
          advertiserIDCollectionEnabled: false,
          autoLogAppEventsEnabled: false,
          isAutoInitEnabled: true,
          ios: {
            userTrackingPermission: false
          }
        }
      ],
      [
        'expo-router',
        {
          root: './app'
        }
      ],
      [
        'expo-sqlite',
        {
          enableFTS: true,
          useSQLCipher: false,
          android: {
            enableFTS: false,
            useSQLCipher: false
          },
          ios: {
            customBuildFlags: '',
            enableFTS: false
          }
        }
      ],
      'expo-secure-store',
      'expo-notifications',
      'expo-calendar',
      'expo-background-fetch',
      './plugins/withReactNativeDefaultPreference',
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
            deploymentTarget: '15.1',
            clangCxxLanguageStandard: 'c++20'
          }
        }
      ]
    ]
  }
};
