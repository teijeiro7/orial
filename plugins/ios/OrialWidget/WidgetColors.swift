import SwiftUI
import WidgetKit

extension View {
  /// Applies the widget's dark background at the root of the view hierarchy,
  /// covering every branch (data, no-data, placeholder) so the OS never falls
  /// back to a blank/white container. iOS 17+ requires `containerBackground`
  /// on the root view of every branch; earlier versions need an explicit
  /// full-size frame before `.background` so it actually fills the widget.
  @ViewBuilder
  func widgetBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      self.containerBackground(Color.deepNavy, for: .widget)
    } else {
      self
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.deepNavy)
    }
  }
}

extension Color {
  static let deepNavy = Color(red: 8/255, green: 12/255, blue: 24/255)
  static let darkBlue = Color(red: 13/255, green: 27/255, blue: 42/255)
  static let surfaceElevated = Color(red: 28/255, green: 37/255, blue: 57/255)
  static let textPrimary = Color(red: 241/255, green: 245/255, blue: 249/255)
  static let textSecondary = Color(red: 148/255, green: 163/255, blue: 184/255)
  static let violetAccent = Color(red: 124/255, green: 58/255, blue: 237/255)
  static let violetLight = Color(red: 167/255, green: 139/255, blue: 250/255)
  static let cyanAccent = Color(red: 6/255, green: 182/255, blue: 212/255)
  static let cyanLight = Color(red: 103/255, green: 232/255, blue: 249/255)
  static let successGreen = Color(red: 16/255, green: 185/255, blue: 129/255)
  static let warningOrange = Color(red: 245/255, green: 158/255, blue: 11/255)
  static let errorRed = Color(red: 239/255, green: 68/255, blue: 68/255)
}
