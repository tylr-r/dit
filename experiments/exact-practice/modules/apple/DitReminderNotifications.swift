import Foundation

/// An injected notification center keeps authorization and OS side effects out of fixtures.
protocol DitReminderCenter {
    func authorization(_ done: @escaping (String) -> Void)
    func request(_ done: @escaping (String) -> Void)
    func remove()
    func add(deadline: Double, body: String, done: @escaping (Bool) -> Void)
}

/// Main-thread coordinator. A superseded asynchronous add must finish before a
/// newer disable or replacement touches the same pending notification identifier.
final class DitReminderNotifications {
    private let center: DitReminderCenter
    private var revision = 0
    private var running = false
    private var next: (() -> Void)?

    init(center: DitReminderCenter) { self.center = center }

    func authorize(wanted: @escaping () -> Bool, done: @escaping (String) -> Void) {
        center.authorization { [self] status in
            guard wanted() else { return }
            if status == "ask" {
                center.request { result in if wanted() { done(result) } }
            } else { done(status) }
        }
    }

    func sync(deadline: Double, body: String, done: @escaping (String) -> Void) {
        revision += 1
        let current = revision
        next = { [self] in
            center.remove()
            guard deadline > 0 else { finish(current, "off", done); return }
            center.authorization { [self] status in
                guard current == revision else { finish(current, "stale", done); return }
                guard status == "granted" else { finish(current, status == "error" ? "error" : "denied", done); return }
                center.add(deadline: deadline, body: body) { [self] ok in
                    finish(current, ok ? "scheduled" : "error", done)
                }
            }
        }
        drain()
    }

    private func drain() {
        guard !running, let task = next else { return }
        next = nil
        running = true
        task()
    }

    private func finish(_ current: Int, _ status: String, _ done: (String) -> Void) {
        running = false
        if current == revision { done(status) }
        drain()
    }
}

#if os(iOS)
import UserNotifications

final class DitSystemReminderCenter: DitReminderCenter {
    static let service = DitReminderNotifications(center: DitSystemReminderCenter())
    private let center = UNUserNotificationCenter.current()
    private let identifier = "dit-daily-reminder"

    func authorization(_ done: @escaping (String) -> Void) {
        center.getNotificationSettings { settings in
            let status: String
            switch settings.authorizationStatus {
            case .authorized: status = "granted"
            case .denied: status = "denied"
            case .notDetermined, .provisional, .ephemeral: status = "ask"
            @unknown default: status = "error"
            }
            DispatchQueue.main.async { done(status) }
        }
    }

    func request(_ done: @escaping (String) -> Void) {
        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            DispatchQueue.main.async {
                if error != nil { done("error") }
                else if !granted { done("denied") }
                else { self.authorization { done($0 == "granted" ? "granted" : "denied") } }
            }
        }
    }

    func remove() { center.removePendingNotificationRequests(withIdentifiers: [identifier]) }

    func add(deadline: Double, body: String, done: @escaping (Bool) -> Void) {
        let content = UNMutableNotificationContent()
        content.title = "Dit"
        content.body = body
        content.sound = nil
        let delay = max(1, (deadline / 1000 - Date().timeIntervalSince1970).rounded())
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
        center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)) { error in
            DispatchQueue.main.async { done(error == nil) }
        }
    }
}
#endif
