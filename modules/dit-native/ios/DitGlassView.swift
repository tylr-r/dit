import ExpoModulesCore
import UIKit

final class DitGlassView: UIView {
  // Use adaptive system material (adapts to light/dark mode automatically)
  private let blurView = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterial))
  private let contentView = UIView()
  
  // Maps intensity to alpha is a partial override of system behavior, 
  // but preserving for now if user wants to fade it out. 
  // Ideally, we just show/hide.
  private var intensityValue: Double = 100 {
    didSet {
      blurView.alpha = CGFloat(min(max(intensityValue / 100, 0), 1))
    }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    setup()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setup()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    blurView.frame = bounds
  }

  private func setup() {
    // Corner radius handled by parent container clipping or can be set here too,
    // but if absolute filled, usually follows parent.
    // We keep it just in case.
    layer.cornerRadius = 24
    layer.masksToBounds = true
    
    // Border
    layer.borderWidth = 1.0 / UIScreen.main.scale
    layer.borderColor = UIColor.separator.cgColor

    blurView.frame = bounds
    blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    
    addSubview(blurView)
  }

  func setIntensity(_ value: Double) {
    intensityValue = value
  }
  
  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
      super.traitCollectionDidChange(previousTraitCollection)
      // Update border color for dark/light mode changes if needed
      if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
          layer.borderColor = UIColor.separator.cgColor
      }
  }
}

public final class DitGlassViewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DitGlassView")

    View(DitGlassView.self) {
      Prop("intensity") { (view: DitGlassView, intensity: Double) in
        view.setIntensity(intensity)
      }
    }
  }
}
