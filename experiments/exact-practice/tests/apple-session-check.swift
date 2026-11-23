// Run with tools/check-apple-session.sh. Uses only a unique temporary directory.
import Foundation

final class RecordingNotificationCenter: DitReminderCenter {
    var status = "ask"
    var permissionQueries = 0
    var requests = 0
    var removes = 0
    var plans: [(Double,String)] = []
    var answer: ((String) -> Void)?
    var delayedQuery: ((String) -> Void)?
    var holdQuery = false
    var holdAdd = false
    var addResult: ((Bool) -> Void)?
    func authorization(_ done: @escaping (String) -> Void) {
        permissionQueries += 1
        if holdQuery { delayedQuery = done } else { done(status) }
    }
    func request(_ done: @escaping (String) -> Void) { requests += 1; answer = done }
    func resolve(_ result: String) { status = result; let reply = answer; answer = nil; reply?(result) }
    func remove() { removes += 1 }
    func add(deadline: Double, body: String, done: @escaping (Bool) -> Void) {
        plans.append((deadline,body))
        if holdAdd { addResult = done } else { done(true) }
    }
}

func until(_ predicate: () -> Bool) {
    let deadline = Date().addingTimeInterval(2)
    while !predicate() && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.005)) }
    precondition(predicate(),"missing asynchronous reminder result")
}


final class Fixture {
    let center = RecordingNotificationCenter()
    let directory: URL
    var session: DitAppleSession!
    var props = ["mode":"boot", "reduce-motion":"true", "blocked":"false", "route-boundary":"1",
                 "nux-token":"0", "cancel-token":"0", "warm-token":"0", "pref-token":"0"]
    var values: [String: String] = [:]
    var events: [String] = []
    var timers: [Int: (Double, () -> Void)] = [:]
    var tones: [([[Double]], Float)] = []
    var promptID = 0
    var playOutput: (([[Double]], Float, Int) -> Bool)?
    var readTail: ((Int) -> Double?)?
    var startPassage: (([[Double]], Float, Double) -> Bool)?
    var controlPassage: ((String) -> Bool)?
    var passagePosition: (() -> Double)?
    var stopOutput: (() -> Void)?
    var outputVolume = 0.75
    var migrationHeld = false
    var hapticsEnabled = false
    var hardwareEnabled = false
    var enabled = false
    var nextID = 0
    init(_ directory: URL, _ asset: URL, legacyDirectory: URL? = nil, expectFailure: Bool = false, station: DitStationTransport? = nil, accounts: DitAccountTransport? = nil, accountClock: @escaping () -> Double = { 2000 }) {
        self.directory = directory
        session = DitAppleSession(directory: directory, legacyDirectory: legacyDirectory, onLegacyHold: { [unowned self] in migrationHeld = true }, program: asset, stationTransport:station, accountService:accounts, accountClock:accountClock, notifications: DitReminderNotifications(center: center), outputVolume: { [unowned self] in outputVolume },
            schedule: { [unowned self] ms, run in
                nextID += 1
                let id = nextID
                timers[id] = (ms, run)
                return { [weak self] in self?.timers.removeValue(forKey: id) }
            }, play: { [unowned self] plan, pitch, id in tones.append((plan, pitch)); promptID = id; return playOutput?(plan, pitch, id) ?? true },
            passageStart: { [unowned self] plan,pitch,gap in startPassage?(plan,pitch,gap) ?? false },
            passageControl: { [unowned self] in controlPassage?($0) ?? false },
            passagePosition: { [unowned self] in passagePosition?() ?? -1 },
            promptTailMs: { [unowned self] in readTail?($0) },
            stop: { [unowned self] in stopOutput?() }, warm: {}, cancelInput: {},
            configure: { [unowned self] on, hardware, _, _, haptics in enabled = on; hardwareEnabled = hardware; hapticsEnabled = haptics },
            publish: { [unowned self] event in
                events.append(event)
                if let split = event.firstIndex(of: ":") {
                    values[String(event[..<split])] = String(event[event.index(after: split)...])
                }
            })
        if expectFailure { precondition(session == nil, "unexpectedly created a writable session"); return }
        precondition(session != nil, "bundled adapter did not initialize")
        session.setProps(props)
        session.bootstrap()
        precondition(values["apple-session"] != "failed")
    }
    func set(_ key: String, _ value: String) {
        props[key] = value
        session.setProps(props)
    }
    func command(_ channel: String, _ value: String) {
        if channel == "answer" { props["answer-prompt"] = values["listen-prompt"] ?? "" }
        props[channel == "answer" ? "answer-value" : channel + "-command"] = value
        set(channel + "-token", String(Int(props[channel + "-token"] ?? "0")! + 1))
    }
    func advance(_ delay: Double) {
        guard let (id, task) = timers.first(where: { $0.value.0 == delay }) else { fatalError("missing timer at " + String(delay)) }
        timers.removeValue(forKey: id)
        task.1()
    }
    func expect(_ name: String, _ value: String) {
        precondition(values[name] == value, name + " expected " + value + ", got " + (values[name] ?? "absent"))
    }
    func close() { session.close(); precondition(timers.isEmpty) }
}

let asset = URL(fileURLWithPath: CommandLine.arguments[1])
if CommandLine.arguments.count == 4 {
    let phase = CommandLine.arguments[2]
    if phase == "--identity-events" {
        try progressIdentityAcceptance(directory:URL(fileURLWithPath:CommandLine.arguments[3]),asset:asset)
        exit(0)
    }
    precondition(["--http-switch","--http-cold"].contains(phase))
    try authenticatedSessionAcceptance(directory:URL(fileURLWithPath:CommandLine.arguments[3]),asset:asset,cold:phase == "--http-cold")
    exit(0)
}
let fixtureDirectory = ProcessInfo.processInfo.environment["TMPDIR"].map { URL(fileURLWithPath: $0, isDirectory: true) }
    ?? FileManager.default.temporaryDirectory
let root = fixtureDirectory.appendingPathComponent("dit-session-" + UUID().uuidString)
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
func make(_ name: String) -> Fixture { Fixture(root.appendingPathComponent(name), asset) }
func file(_ name: String, _ key: String) -> URL {
    root.appendingPathComponent(name).appendingPathComponent("dit-practice").appendingPathComponent("dit.exact-spike." + key + ".v1")
}
func seed(_ name: String, _ key: String, _ value: String) throws {
    let url = file(name, key)
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try value.write(to: url, atomically: true, encoding: .utf8)
}

if CommandLine.arguments.dropFirst(2).elementsEqual(["--custom-controls"]) {
    checkPassageMotor()
    try checkCustomPassage(verifyRelaunch: false)
    exit(0)
}

let fresh = make("beginner")
fresh.expect("nux-status","pending")
precondition(fresh.hapticsEnabled)
fresh.expect("nux-step","welcome")
fresh.expect("nux-owned","1")
fresh.expect("scope-selection","tier-3")
fresh.expect("speed","12")
fresh.expect("effectiveSpeed","8")
fresh.expect("pitch","600")
precondition(fresh.values["study-pool"]!.split(separator:",").count == 26)
precondition(fresh.values["course-packs"]!.split(separator:";").count == 14)
fresh.expect("course-current","1")
fresh.expect("course-reached","1")
precondition(!fresh.enabled && fresh.tones.isEmpty && fresh.events.last == "nux-status:pending")
precondition(!FileManager.default.fileExists(atPath: file("beginner","practice").path))
fresh.set("mode","nux")
for cmd in ["start","beginner","continue","continue","continue"] { fresh.command("nux",cmd) }
fresh.outputVolume = 0.04
fresh.command("nux","play")
fresh.expect("nux-sound","low")
fresh.command("nux","continue")
fresh.expect("nux-step","sound_check")
fresh.outputVolume = 0.05
fresh.command("nux","play")
fresh.expect("nux-sound","heard")
fresh.command("nux","continue")
fresh.expect("nux-step","button_tutorial")
precondition(fresh.tones.count == 2 && fresh.tones[0].0 == [[0,100]] && fresh.tones[0].1 == 600 && fresh.enabled && !fresh.hardwareEnabled)
fresh.command("pref","haptics-off")
precondition(!fresh.hapticsEnabled)
for ch in "..-" { fresh.session.input("symbol",String(ch)) }
fresh.close()
let resume = make("beginner")
resume.expect("nux-status","pending")
resume.expect("nux-step","welcome")
resume.expect("nux-profile","beginner")
precondition(!resume.hapticsEnabled)
resume.expect("nux-taps","2")
resume.expect("nux-holds","1")
resume.set("mode","nux")
resume.command("nux","resume")
precondition(resume.enabled)
resume.set("blocked","true")
resume.session.input("symbol",".")
resume.expect("nux-taps","2")
resume.set("blocked","false")
for ch in ".--" { resume.session.input("symbol",String(ch)) }
resume.advance(600)
resume.expect("nux-step","beginner_stages")
resume.command("nux","continue")
resume.command("nux","continue")
resume.expect("nux-step","reminder")
do {
    precondition(resume.center.requests == 0 && resume.center.plans.isEmpty)
    resume.command("nux","reminder-skip")
    precondition(resume.center.requests == 0 && resume.center.plans.isEmpty)
}
resume.expect("nux-status","completed")
resume.expect("nux-enter","guided")
resume.expect("scope-selection","tier-1")
resume.expect("ifr","false")
resume.expect("reviewMisses","false")
resume.set("mode","guided")
resume.expect("guide-target","E")
precondition(resume.tones.count == 1 && resume.tones[0].0 == [[0,100]])
resume.set("warm-token","1")
precondition(resume.tones.last?.0 == [[0,100]])
resume.session.input("sequence",".")
resume.expect("guide-feedback","Correct")
precondition(!resume.enabled)
resume.advance(1000)
precondition(resume.enabled)
resume.close()
let guided = make("beginner")
guided.expect("nux-enter","guided")
guided.expect("nux-status","completed")
guided.set("mode","guided")
guided.session.input("sequence",".")
guided.advance(1000)
guided.expect("guide-target","T")
guided.set("mode","freestyle")
guided.close()
let method = make("beginner")
method.expect("nux-enter","guided")
method.set("mode","guided")
method.command("pref","course-open")
method.set("mode","practice")
method.close()
let open = make("beginner")
precondition(open.values["nux-enter"] == nil)
open.close()
print("PASS fresh launch, silent gated hydration, sound plan, tutorial lock, pending resume, beginner defaults and partial E/T across three contexts")

let skip = make("skipped")
skip.set("mode","nux")
skip.command("nux","skip")
skip.expect("nux-status","skipped")
skip.set("mode","practice")
skip.command("pref","scope-custom:E")
skip.expect("target","E")
skip.expect("scope-letters","E")
skip.session.interrupt(true)
skip.session.input("sequence",".")
skip.expect("score","0")
skip.session.interrupt(false)
skip.session.input("sequence",".")
skip.expect("score","1")
skip.expect("history","1")
skip.close()
let returning = make("skipped")
returning.expect("nux-status","skipped")
returning.expect("score","1")
returning.expect("history","1")
returning.expect("scope-letters","E")
returning.set("mode","conversation")
returning.session.input("sequence",".")
precondition(!returning.enabled && returning.tones.isEmpty)
returning.expect("score","1")
returning.close()
print("PASS explicit skip, real sequence grading, interruption lock, persisted score/history/scope, silent conversation entry")

let defaults = #"{"version":1,"settings":{},"scores":{},"history":[]}"#
try seed("defaults","practice",defaults)
let nominal = make("defaults")
nominal.expect("nux-status","pending")
nominal.expect("scope-selection","tier-3")
nominal.close()
let bytes = try String(contentsOf: file("defaults","practice"), encoding:.utf8)
precondition(bytes == defaults)
let positive = #"{"version":1,"settings":{"pitch":680},"scores":{"T":4},"history":[]}"#
try seed("legacy","practice",positive)
let legacy = make("legacy")
legacy.expect("nux-status","skipped")
legacy.expect("nux-storage","saved")
legacy.expect("score","4")
legacy.expect("pitch","680")
legacy.close()
try seed("legacy","onboarding",#"{"version":1,"status":"pending","step":"profile","profile":"known"}"#)
let explicit = make("legacy")
explicit.expect("nux-status","pending")
explicit.expect("nux-step","welcome")
explicit.expect("score","4")
explicit.close()
let known = make("known")
known.set("mode","nux")
for cmd in ["start","known","continue","continue","continue","play","continue"] { known.command("nux",cmd) }
for ch in "...---" { known.session.input("symbol",String(ch)) }
known.advance(600)
known.expect("nux-step","reminder")
known.command("nux","reminder-time:06:35")
known.command("nux","reminder-enable")
precondition(known.center.requests == 1 && known.center.plans.isEmpty)
known.center.resolve("granted")
until { known.values["nux-step"] == "known_tour" }
known.expect("reminder-enabled","1")
known.expect("reminder-time","06:35")
precondition(known.center.plans.count == 1 && known.center.plans[0].1 == "Ready for a quick Morse session?")
known.session.foreground()
precondition(known.center.plans.count == 2 && known.center.requests == 1)
known.expect("nux-step","known_tour")
for _ in 0..<3 { known.command("nux","tour-next") }
known.expect("nux-status","completed")
known.expect("nux-enter","practice")
known.expect("scope-selection","tier-3")
known.set("mode","practice")
precondition(known.enabled && known.tones.count == 2)
known.close()
print("PASS known tour to ordinary first prompt; guided method survives Freestyle and explicit Open survives relaunch")

let futureField = #"{"version":1,"settings":{"pitch":700,"unknownOption":"future"},"scores":{"E":2},"history":[]}"#
try seed("extension","practice",futureField)
let extended = make("extension")
extended.expect("storage","newer")
extended.expect("score","2")
extended.expect("pitch","700")
extended.set("mode","practice")
extended.command("pref","pitch-up")
extended.close()
let original = try String(contentsOf:file("extension","practice"), encoding:.utf8)
precondition(original == futureField)
let future = #"{"version":8,"doNotReplace":true}"#
for key in ["onboarding","practice","guided"] { try seed("future",key,future) }
let protected = make("future")
protected.expect("nux-storage","unsupported")
protected.expect("storage","newer")
protected.set("mode","practice")
protected.command("pref","pitch-up")
protected.command("nux","replay")
protected.command("nux","start")
protected.close()
for key in ["onboarding","practice","guided"] {
    let bytes = try String(contentsOf:file("future",key), encoding:.utf8)
    precondition(bytes == future)
}
try "blocked".write(to:root.appendingPathComponent("unavailable"), atomically:true, encoding:.utf8)
let unavailable = make("unavailable")
unavailable.expect("nux-status","pending")
unavailable.set("mode","nux")
unavailable.command("nux","start")
unavailable.expect("nux-storage","unavailable")
unavailable.close()
print("PASS defaults-only and meaningful prior progress, explicit pending precedence, future snapshot byte protection and unavailable directory")

let returnedKnown = make("known")
returnedKnown.expect("reminder-enabled","1")
returnedKnown.expect("reminder-time","06:35")
precondition(returnedKnown.center.requests == 0)
returnedKnown.set("mode","practice")
returnedKnown.set("settings-open","true")
returnedKnown.set("blocked","true")
returnedKnown.command("pref","reminder-off")
returnedKnown.expect("reminder-enabled","0")
returnedKnown.command("pref","reminder-on")
precondition(returnedKnown.center.requests == 1)
returnedKnown.center.resolve("denied")
until { returnedKnown.values["reminder-busy"] == "0" }
returnedKnown.expect("reminder-enabled","0")
returnedKnown.expect("reminder-time","06:35")
returnedKnown.close()

let recorder = RecordingNotificationCenter()
recorder.status = "granted"
recorder.holdAdd = true
let scheduler = DitReminderNotifications(center: recorder)
var statuses: [String] = []
scheduler.sync(deadline: 2_000_000_000_000,body:"first") { statuses.append($0) }
scheduler.sync(deadline: 2_000_000_100_000,body:"second") { statuses.append($0) }
scheduler.sync(deadline: 0,body:"") { statuses.append($0) }
precondition(recorder.removes == 1 && recorder.plans.count == 1)
recorder.addResult?(true)
precondition(recorder.removes == 2 && recorder.plans.count == 1 && statuses == ["off"])
recorder.status = "denied"
scheduler.authorize(wanted:{ true }) { statuses.append($0) }
precondition(statuses.last == "denied" && recorder.requests == 0)
recorder.holdQuery = true
var wanted = true
scheduler.authorize(wanted:{ wanted }) { _ in preconditionFailure("stale permission result") }
wanted = false
recorder.delayedQuery?("ask")
precondition(recorder.requests == 0)
print("PASS injected notification center: one explicit permission request, selected time across relaunch, disabled on denial, silent foreground checks, and in-flight add followed by disable")
