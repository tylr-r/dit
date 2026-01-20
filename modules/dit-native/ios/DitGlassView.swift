import ExpoModulesCore
import UIKit

final class DitGlassView: UIView {
  private let blurView = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))
  private let gradientLayer = CAGradientLayer()
  private let contentView = UIView()
  private var intensityValue: Double = 35 {
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

  private func setup() {
    layer.cornerRadius = 24
    layer.masksToBounds = true
    layer.borderWidth = 1
    layer.borderColor = UIColor.white.withAlphaComponent(0.15).cgColor

    gradientLayer.colors = [
      UIColor.white.withAlphaComponent(0.12).cgColor,
      UIColor.white.withAlphaComponent(0.03).cgColor,
    ]
    gradientLayer.startPoint = CGPoint(x: 0.2, y: 0)
    gradientLayer.endPoint = CGPoint(x: 0.8, y: 1)

    blurView.frame = bounds
    blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    contentView.frame = bounds
    contentView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

    layer.addSublayer(gradientLayer)
    addSubview(blurView)
    addSubview(contentView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    gradientLayer.frame = bounds
    blurView.frame = bounds
    contentView.frame = bounds
  }

  func setIntensity(_ value: Double) {
    intensityValue = value
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
