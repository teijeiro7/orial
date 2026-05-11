# iOS Widget Setup

## Requirements
- Xcode 14.0+
- iOS 14.0+ (WidgetKit requirement)

## Setup Steps

### 1. Configure App Groups
1. Open `ios/Orial.xcworkspace` in Xcode
2. Select the main app target (Orial)
3. Go to "Signing & Capabilities"
4. Click "+ Capability" and add "App Groups"
5. Click the "+" button and create a group: `group.com.orial.app.widget`
6. Repeat for the Widget Extension target (once created)

### 2. Create Widget Extension Target
1. In Xcode, select File > New > Target
2. Choose "Widget Extension" under iOS
3. Name it "OrialWidget"
4. Make sure "Include Configuration Intent" is UNCHECKED
5. Click Finish, then "Activate" when prompted

### 3. Add Widget Files
1. Copy `ios/OrialWidget/OrialWidget.swift` to the widget target
2. Copy `ios/OrialWidget/OrialWidgetBundle.swift` to the widget target
3. Ensure both files are added to the "OrialWidget" target (check Target Membership)

### 4. Build and Run
1. Select the main app scheme
2. Build and run on a physical device (widgets don't work reliably on simulator)
3. Long press home screen > Add Widget > Find "Orial"

## Widget Sizes
- **Small (2x2)**: Shows today's progress + streak
- **Medium (4x2)**: Shows habit grid with completion status
- **Large (4x4)**: Full habit grid with progress ring

## Data Flow
```
React Native App
    ↓ (writes to UserDefaults with App Group)
iOS Widget
    ↓ (reads from UserDefaults)
WidgetKit renders UI
```
