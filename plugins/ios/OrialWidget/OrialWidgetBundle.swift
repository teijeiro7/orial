import WidgetKit
import SwiftUI

@main
struct OrialWidgetBundle: WidgetBundle {
  var body: some Widget {
    ForgeWidget()
    PhysicalWidget()
    OverviewWidget()
  }
}
