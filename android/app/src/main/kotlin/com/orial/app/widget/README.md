# Android Widget Setup

## Requirements
- Android SDK 26+ (Android 8.0)
- Jetpack Compose (optional, for Glance API)

## Setup Steps

### 1. Update AndroidManifest.xml
The widget receiver must be declared in `android/app/src/main/AndroidManifest.xml`:

```xml
<receiver
    android:name=".widget.OrialWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/orial_widget_info" />
</receiver>
```

### 2. Verify Files
Ensure these files exist in your Android project:
- `android/app/src/main/kotlin/com/orial/app/widget/OrialWidget.kt`
- `android/app/src/main/res/layout/widget_orial.xml`
- `android/app/src/main/res/drawable/widget_background.xml`
- `android/app/src/main/res/xml/orial_widget_info.xml`

### 3. Build and Run
1. Build the Android app: `npx expo run:android`
2. Long press home screen > Widgets > Find "Orial"
3. Drag widget to home screen

## Widget Features
- Shows today's habit completion count
- Displays streak count with fire emoji
- Shows habit emojis (completed vs incomplete)
- Updates every 30 minutes automatically
- Updates immediately when app writes new data

## Data Flow
```
React Native App
    ↓ (writes to SharedPreferences)
Android Widget
    ↓ (reads from SharedPreferences)
RemoteViews renders UI
```

## Troubleshooting
- If widget doesn't appear: Check that the manifest is properly configured
- If data doesn't update: Verify SharedPreferences name matches (`orial_widget_data`)
- Styling issues: Check that drawable resources are in the correct density folders
