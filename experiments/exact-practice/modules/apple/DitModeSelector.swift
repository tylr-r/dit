#if os(iOS)
import UIKit

/// A single mode label in the top bar presents the same four choices as shipped Dit.
final class DitModeSelector: ExactNativeInstance {
    private let button = UIButton(type: .system)
    private let modes = ["Practice", "Freestyle", "Listen", "Conversation"]
    private weak var sheet: UIAlertController?
    override var view: ExactNativeView { button }

    override init(events: ExactNativeEvents) {
        super.init(events: events)
        var style = UIButton.Configuration.plain()
        style.baseForegroundColor = .white.withAlphaComponent(0.9)
        style.image = UIImage(systemName: "chevron.down", withConfiguration: UIImage.SymbolConfiguration(pointSize: 11, weight: .regular))
        style.imagePlacement = .trailing
        style.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 6, bottom: 0, trailing: 6)
        style.imagePadding = 6
        style.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
            var result = attributes
            let font = UIFont.systemFont(ofSize: 20, weight: .medium)
            result.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: font, maximumPointSize: 28)
            return result
        }
        button.configuration = style
        button.titleLabel?.adjustsFontSizeToFitWidth = true
        button.titleLabel?.minimumScaleFactor = 0.85
        button.titleLabel?.numberOfLines = 1
        button.accessibilityHint = "Choose a practice mode"
        button.addAction(UIAction { [weak self] _ in self?.choose() }, for: .touchUpInside)
    }

    override func setProps(_ props: [String: String]) throws {
        let mode = modes.first { $0.lowercased() == props["current-mode"] } ?? "Practice"
        button.configuration?.title = mode
        button.accessibilityLabel = "Mode: " + mode
        button.isEnabled = props["mode-disabled"] != "true"
    }

    private func choose() {
        guard button.isEnabled, button.window != nil, sheet == nil else { return }
        var responder: UIResponder? = button
        while let current = responder, !(current is UIViewController) { responder = current.next }
        guard let controller = responder as? UIViewController, controller.presentedViewController == nil else { return }
        let alert = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
        alert.overrideUserInterfaceStyle = .dark
        for mode in modes {
            alert.addAction(UIAlertAction(title: mode, style: .default) { [weak self] _ in
                self?.events.message(mode.lowercased())
            })
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.modalPresentationStyle = .popover
        alert.popoverPresentationController?.permittedArrowDirections = []
        // Anchoring on iPhone changes the sheet into an inline menu on iOS 26+.
        if button.traitCollection.userInterfaceIdiom == .pad {
            alert.popoverPresentationController?.sourceView = controller.view
            alert.popoverPresentationController?.sourceRect = controller.view.bounds
        }
        sheet = alert
        controller.present(alert, animated: true)
    }

    override func destroy() { sheet?.dismiss(animated: false) }
}
#endif
