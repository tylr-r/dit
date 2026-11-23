import Foundation

private final class SyntheticUser: DitProgressUser {
    let uid: String
    var token: () async throws -> String
    init(_ uid: String) {
        self.uid = uid
        self.token = { "fixture-" + uid }
    }
    func idToken() async throws -> String { try await token() }
}

private final class SyntheticOwner: DitProgressAuthOwner {
    var databaseRoot = URL(string:"https://demo-dit-parity-default-rtdb.firebaseio.com")!
    private var listener: ((String?) -> Void)?
    var currentProgressUser: DitProgressUser? { didSet { listener?(currentProgressUser?.uid) } }
    func observeIdentity(_ changed: @escaping (String?) -> Void) -> () -> Void {
        listener = changed
        changed(currentProgressUser?.uid)
        return { [weak self] in self?.listener = nil }
    }
}

private enum ExpectedFailure: Error { case offline }

private func result(_ run: (@escaping (DitAccountReply) -> Void) -> Void) -> DitAccountReply {
    var reply: DitAccountReply?
    run { precondition(reply == nil); reply = $0 }
    let deadline = Date().addingTimeInterval(3)
    while reply == nil && Date() < deadline {
        RunLoop.main.run(until:Date().addingTimeInterval(0.001))
    }
    guard let reply else { fatalError("Missing progress completion") }
    return reply
}

private func unavailable(_ reply: DitAccountReply) {
    guard case .unavailable = reply else { fatalError("Expected unavailable progress") }
}

private func checkAuthenticatedProgress() {
    let owner = SyntheticOwner()
    let a = SyntheticUser("synthetic-A"), b = SyntheticUser("synthetic-B")
    var requests = [URLRequest]()
    var respond: (URLRequest) throws -> (Data, URLResponse) = { _ in throw ExpectedFailure.offline }
    let client = DitAuthenticatedProgressDatabase(owner:owner) { request in
        requests.append(request)
        return try respond(request)
    }!
    func response(_ code: Int, _ etag: String?, _ text: String, url: URL? = nil) {
        respond = { request in
            let headers = etag.map { ["ETag":$0] }
            return (Data(text.utf8),HTTPURLResponse(url:url ?? request.url!,statusCode:code,httpVersion:"HTTP/1.1",headerFields:headers)!)
        }
    }
    func read(_ account: String) -> DitAccountReply { result { client.read(account:account,done:$0) } }
    func save(_ revision: String) -> DitAccountReply {
        result { client.save(account:a.uid,replacing:revision,json:#"{"updatedAt":1000,"toneFrequency":660}"#,done:$0) }
    }

    unavailable(read(a.uid))
    owner.currentProgressUser = a
    unavailable(read(b.uid)); unavailable(save("*")); unavailable(save("abc,def"))
    precondition(requests.isEmpty)
    response(200,"null_etag","null")
    guard case .loaded("null_etag",nil) = read(a.uid) else { fatalError("Missing-node revision") }
    let get = requests.last!
    precondition(get.httpMethod == "GET" && get.httpBody == nil)
    precondition(get.url?.path == "/users/synthetic-A/progress.json")
    precondition(get.value(forHTTPHeaderField:"X-Firebase-ETag") == "true")
    precondition(URLComponents(url:get.url!,resolvingAgainstBaseURL:false)?.queryItems ==
                 [URLQueryItem(name:"auth",value:"fixture-synthetic-A")])
    response(200,#""winner""#,"{}")
    guard case .saved(#""winner""#) = save("null_etag") else { fatalError("Save failed") }
    let put = requests.last!
    precondition(put.httpMethod == "PUT" && put.url == get.url)
    precondition(put.value(forHTTPHeaderField:"If-Match") == "null_etag")
    precondition(put.value(forHTTPHeaderField:"Content-Type") == "application/json")
    let payload = try! JSONSerialization.jsonObject(with:put.httpBody!) as! [String:Int]
    precondition(payload == ["updatedAt":1000,"toneFrequency":660])
    response(412,#""other""#,#"{"updatedAt":2000}"#)
    guard case .conflict = save(#""winner""#) else { fatalError("Missing write conflict") }
    response(200,#""other""#,#"{"updatedAt":2000}"#)
    guard case .loaded(#""other""#,let json) = read(a.uid), json == #"{"updatedAt":2000}"#
    else { fatalError("Refresh did not return winner") }
    for (status,etag,body) in [(401,"rev","{}"),(403,"rev","{}"),(200,"","{}"),(200,"*","null"),(200,"rev","[]"),(500,"rev","{}")] {
        response(status,etag,body); unavailable(read(a.uid))
    }
    response(302,"rev","{}"); unavailable(read(a.uid))
    response(200,"rev","{}",url:URL(string:"https://example.invalid/")!); unavailable(read(a.uid))
    respond = { _ in throw ExpectedFailure.offline }; unavailable(read(a.uid))
    let beforeToken = requests.count
    a.token = { throw ExpectedFailure.offline }; unavailable(read(a.uid))
    a.token = { "" }; unavailable(read(a.uid))
    a.token = { owner.currentProgressUser = b; return "obsolete-fixture-A" }; unavailable(read(a.uid))
    precondition(requests.count == beforeToken)
    response(200,"B","{}")
    guard case .loaded("B",_) = read(b.uid) else { fatalError("Independent B read failed") }
    precondition(requests.last?.url?.path == "/users/synthetic-B/progress.json")
    precondition(requests.last?.url?.query == "auth=fixture-synthetic-B")
    respond = { request in
        owner.currentProgressUser = nil
        owner.currentProgressUser = SyntheticUser(b.uid)
        return (Data("{}".utf8),HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:["ETag":"old-B"])!)
    }
    unavailable(read(b.uid))
    for raw in ["http://demo.firebaseio.com","https://example.invalid","https://demo.firebaseio.com.example.invalid",
                "https://demo.firebaseio.com/path","https://demo.firebaseio.com?ns=other","https://x@demo.firebaseio.com"] {
        owner.databaseRoot = URL(string:raw)!
        precondition(DitAuthenticatedProgressDatabase(owner:owner,send:{ _ in fatalError("Unexpected request") }) == nil)
    }
    owner.databaseRoot = URL(string:"https://demo-dit.eu-west1.firebasedatabase.app")!
    precondition(DitAuthenticatedProgressDatabase(owner:owner,send:{ _ in fatalError("Unexpected request") }) != nil)
    print("PASS: authenticated progress request, conditional replacement, conflict refresh, failure and identity isolation (recording HTTP only)")
}

checkAuthenticatedProgress()
