import WidgetKit
import Foundation

@objc(WidgetManager)
class WidgetManager: NSObject {
  @objc
  func reloadAllTimelines() {
    if #available(iOS 14, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
