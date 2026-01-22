import ExpoModulesCore
import UIKit

final class DitGlassSegmentedControlHostView: UIView {
  let onValueChange = EventDispatcher()
  
  private let segmentedControl = UISegmentedControl(items: [])
  
  private var items: [String] = []
  private var selectedIndex: Int = 0

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupView()
  }
  
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
  
  // MARK: - Public setters called by Expo
  
  func setItems(_ newItems: [String]) {
    items = newItems
    updateSegments()
  }
  
  func setSelectedIndex(_ index: Int) {
    selectedIndex = index
    applySelectedIndex()
  }

  private func setupView() {
    // Force specific style for visibility on dark background
    segmentedControl.overrideUserInterfaceStyle = .dark
    segmentedControl.selectedSegmentTintColor = .white
    
    let normalAttributes: [NSAttributedString.Key: Any] = [
      .foregroundColor: UIColor.lightGray
    ]
    let selectedAttributes: [NSAttributedString.Key: Any] = [
      .foregroundColor: UIColor.black
    ]
    
    segmentedControl.setTitleTextAttributes(normalAttributes, for: .normal)
    segmentedControl.setTitleTextAttributes(selectedAttributes, for: .selected)

    segmentedControl.frame = bounds

    // Default to static mode labels in case Expo prop binding is unavailable.
    segmentedControl.insertSegment(withTitle: "Practice", at: 0, animated: false)
    segmentedControl.insertSegment(withTitle: "Freestyle", at: 1, animated: false)
    segmentedControl.insertSegment(withTitle: "Listen", at: 2, animated: false)
    segmentedControl.selectedSegmentIndex = 0

    addSubview(segmentedControl)
    segmentedControl.addTarget(self, action: #selector(valueChanged), for: .valueChanged)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    segmentedControl.frame = bounds
    applySelectedIndex()
  }
  
  private func updateSegments() {
    segmentedControl.removeAllSegments()
    for (index, item) in items.enumerated() {
      segmentedControl.insertSegment(withTitle: item, at: index, animated: false)
    }

    applySelectedIndex()

    // Force layout after updating items
    segmentedControl.frame = bounds
    segmentedControl.setNeedsLayout()
    segmentedControl.layoutIfNeeded()
  }

  private func applySelectedIndex() {
    guard segmentedControl.numberOfSegments > 0 else {
      return
    }
    if selectedIndex >= 0 && selectedIndex < segmentedControl.numberOfSegments {
      segmentedControl.selectedSegmentIndex = selectedIndex
      return
    }
    segmentedControl.selectedSegmentIndex = UISegmentedControl.noSegment
  }
  
  @objc private func valueChanged() {
    selectedIndex = segmentedControl.selectedSegmentIndex
    onValueChange(["value": selectedIndex])
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
