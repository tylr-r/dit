#if os(iOS)
import UIKit

/// Inline, local-hour/minute wheel used by the Apple onboarding reminder.
final class DitReminderWheel: ExactNativeInstance {
    private let picker = UIDatePicker()
    override var view: ExactNativeView { picker }

    override init(events: ExactNativeEvents) {
        super.init(events: events)
        // Both reminder surfaces sit on Dit’s dark card in either system appearance.
        picker.overrideUserInterfaceStyle = .dark
        picker.datePickerMode = .time
        picker.preferredDatePickerStyle = .wheels
        picker.accessibilityLabel = "Reminder time"
        picker.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            let parts = Calendar.current.dateComponents([.hour, .minute], from: self.picker.date)
            if let hour = parts.hour, let minute = parts.minute {
                self.events.message(String(format: "%02d:%02d", hour, minute))
            }
        }, for: .valueChanged)
    }

    override func setProps(_ props: [String: String]) throws {
        picker.isEnabled = props["wheel-disabled"] != "true"
        guard let value = props["clock-time"] else { return }
        let parts = value.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, (0..<24).contains(parts[0]), (0..<60).contains(parts[1]) else { return }
        let calendar = Calendar.current
        let current = calendar.dateComponents([.hour, .minute], from: picker.date)
        guard current.hour != parts[0] || current.minute != parts[1] else { return }
        if let date = calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: picker.date) {
            picker.setDate(date, animated: false)
        }
    }
}
#endif
