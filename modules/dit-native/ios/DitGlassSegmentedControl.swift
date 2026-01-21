import ExpoModulesCore
import UIKit

final class DitGlassSegmentedControlHostView: UIView {
  let onChange = EventDispatcher()

  private var items: [String] = []
  private var selectedIndex: Int = 0

  func setItems(_ items: [String]) {
    self.items = items
    selectedIndex = sanitizedIndex(selectedIndex)
  }

  func setSelectedIndex(_ index: Int) {
    selectedIndex = sanitizedIndex(index)
  }

  private func sanitizedIndex(_ index: Int) -> Int {
    guard !items.isEmpty else {
      return 0
    }
    return min(max(index, 0), items.count - 1)
  }
}

public final class DitGlassSegmentedControlModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DitGlassSegmentedControl")

    View(DitGlassSegmentedControlHostView.self) {
      Events("onValueChange")

      Prop("items") { (view: DitGlassSegmentedControlHostView, items: [String]) in
        view.setItems(items)
      }

      Prop("selectedIndex") { (view: DitGlassSegmentedControlHostView, index: Int) in
        view.setSelectedIndex(index)
      }
    }
  }
}
