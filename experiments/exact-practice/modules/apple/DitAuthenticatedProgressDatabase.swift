import Foundation

/// The trusted auth owner supplies its configured database and a stable user handle
/// for each sign-in. On sign-out/switch it replaces the handle, even for the same UID.
/// Identity access and observer delivery occur on the main queue.
protocol DitProgressAuthOwner: DitAccountIdentityObserver {
    var databaseRoot: URL { get }
    var currentProgressUser: DitProgressUser? { get }
}

protocol DitProgressUser: AnyObject {
    var uid: String { get }
    /// Obtain the current Firebase ID token for this user through the auth SDK.
    @MainActor func idToken() async throws -> String
}

private final class DitDatabaseRedirectPolicy: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

/// Optional authenticated Realtime Database client for DitAppleSession(accountService:).
/// Construct only with the identity owner for the explicitly configured database.
final class DitAuthenticatedProgressDatabase: DitProgressDatabaseClient {
    typealias Send = @MainActor (URLRequest) async throws -> (Data, URLResponse)
    private let owner: DitProgressAuthOwner
    private let root: URLComponents
    private let send: Send

    init?(owner: DitProgressAuthOwner, send: @escaping Send) {
        guard let root = URLComponents(url:owner.databaseRoot,resolvingAgainstBaseURL:false),
              root.scheme == "https", let host = root.host,
              host.range(of:#"^[a-z0-9-]+(?:\.firebaseio\.com|\.[a-z0-9-]+\.firebasedatabase\.app)$"#,
                         options:.regularExpression) != nil,
              root.port == nil, root.user == nil, root.password == nil,
              ["","/"].contains(root.percentEncodedPath), root.query == nil, root.fragment == nil
        else { return nil }
        self.root = root
        self.owner = owner
        self.send = send
    }

    convenience init?(owner: DitProgressAuthOwner) {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieStorage = nil
        config.urlCredentialStorage = nil
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForResource = 20
        let session = URLSession(configuration:config)
        let redirects = DitDatabaseRedirectPolicy()
        self.init(owner:owner,send:{ request in try await session.data(for:request,delegate:redirects) })
    }

    var progressIdentity: (account: String, uid: String)? {
        owner.currentProgressUser.map { ($0.uid,$0.uid) }
    }

    func observeIdentity(_ changed: @escaping (String?) -> Void) -> () -> Void {
        owner.observeIdentity(changed)
    }

    /// Accept exactly one concrete revision, including Firebase's missing-node ETag.
    private func validRevision(_ revision: String) -> Bool {
        let bare = revision.hasPrefix("\"") && revision.hasSuffix("\"") ? revision.dropFirst().dropLast() : revision[...]
        return !bare.isEmpty && bare.utf8.allSatisfy { (33...126).contains($0) && ![34,42,44].contains($0) }
    }

    private func request(_ path: String, revision: String? = nil, body: Data? = nil,
                         done: @escaping (Int, String?, Data) -> Void) {
        dispatchPrecondition(condition:.onQueue(.main))
        let failed = { done(0,nil,Data()) }
        guard let user = owner.currentProgressUser, progressPath(for:user.uid) == path,
              revision.map(validRevision) ?? true else { failed(); return }
        Task { @MainActor in
            func isCurrent() -> Bool { owner.currentProgressUser === user && owner.databaseRoot == root.url }
            do {
                guard isCurrent() else { failed(); return }
                let token = try await user.idToken()
                guard isCurrent(), !token.isEmpty else { failed(); return }
                var target = root
                target.path = "/" + path + ".json"
                target.queryItems = [URLQueryItem(name:"auth",value:token)]
                guard let url = target.url else { failed(); return }
                var request = URLRequest(url:url,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:15)
                request.httpMethod = revision == nil ? "GET" : "PUT"
                request.setValue("true",forHTTPHeaderField:"X-Firebase-ETag")
                if let revision {
                    request.setValue(revision,forHTTPHeaderField:"If-Match")
                    request.setValue("application/json",forHTTPHeaderField:"Content-Type")
                    request.httpBody = body
                }
                let (data,response) = try await send(request)
                guard isCurrent(), let http = response as? HTTPURLResponse,
                      http.url == url else { failed(); return }
                let etag = http.value(forHTTPHeaderField:"ETag").flatMap { validRevision($0) ? $0 : nil }
                done(http.statusCode,etag,data)
            } catch { failed() }
        }
    }

    func readNode(at path: String, done: @escaping (DitProgressNode) -> Void) {
        request(path) { status,etag,data in
            guard status == 200, let etag,
                  let value = try? JSONSerialization.jsonObject(with:data,options:.fragmentsAllowed),
                  value is NSNull || value is [String:Any] else { done(.unavailable); return }
            done(.snapshot(revision:etag,value:value))
        }
    }

    func replaceNode(at path: String, matching revision: String, value: [String:Any],
                     done: @escaping (DitProgressWrite) -> Void) {
        guard JSONSerialization.isValidJSONObject(value),
              let body = try? JSONSerialization.data(withJSONObject:value) else { done(.unavailable); return }
        request(path,revision:revision,body:body) { status,etag,_ in
            if status == 412 { done(.conflict) }
            else if status == 200, let etag { done(.saved(revision:etag)) }
            else { done(.unavailable) }
        }
    }
}
