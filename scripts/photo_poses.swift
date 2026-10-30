// Recovers the camera pose of each room photo with Apple's Object Capture (RealityKit PhotogrammetrySession),
// free and on-device. Run:  swift scripts/photo_poses.swift OUT.json PHOTO [PHOTO ...]
//
// Writes {"ok": true, "poses": [{"file", "rotation": [x,y,z,w], "translation": [x,y,z]}], "unposed": [...],
// "points": N} in Object Capture's own frame (arbitrary origin, scale and orientation; y is up when the photos
// carry gravity, which plain JPEGs don't). Lining that frame up with the room spec is the next step (see
// docs/reference/capture/README.md, Stage A.4); until then the poses are saved for it and for checking overlap.
// Photogrammetry needs heavy overlap (Apple: 70%+ between neighbours, 20+ photos), so a handful of
// unrelated snapshots usually comes back with {"ok": false}; that is expected and not an error for the app.
import Foundation
import RealityKit

let args = CommandLine.arguments.dropFirst()
guard args.count >= 2 else {
    FileHandle.standardError.write("usage: swift photo_poses.swift OUT.json PHOTO [PHOTO ...]\n".data(using: .utf8)!)
    exit(2)
}
let out = URL(fileURLWithPath: args.first!)
let photos = args.dropFirst().map { URL(fileURLWithPath: $0) }

func write(_ obj: [String: Any]) {
    let data = try! JSONSerialization.data(withJSONObject: obj, options: [.prettyPrinted, .sortedKeys])
    try! data.write(to: out)
}

guard PhotogrammetrySession.isSupported else {
    write(["ok": false, "error": "Object Capture isn't supported on this Mac"])
    exit(0)
}

// The session reads a folder, so stage the photos in a temporary one
let stage = FileManager.default.temporaryDirectory.appendingPathComponent("hb-poses-\(UUID().uuidString)")
try FileManager.default.createDirectory(at: stage, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: stage) }
for p in photos {
    try FileManager.default.copyItem(at: p, to: stage.appendingPathComponent(p.lastPathComponent))
}

var config = PhotogrammetrySession.Configuration()
config.featureSensitivity = .high
config.sampleOrdering = .unordered
config.isObjectMaskingEnabled = false  // a room is the scene, not an object to cut out

let started = Date()
var result: [String: Any] = ["ok": false, "photos": photos.count]
do {
    let session = try PhotogrammetrySession(input: stage, configuration: config)
    try session.process(requests: [.poses, .pointCloud])
    outer: for try await output in session.outputs {
        switch output {
        case .requestComplete(_, let res):
            switch res {
            case .poses(let poses):
                var list: [[String: Any]] = []
                var posed = Set<String>()
                for (id, pose) in poses.posesBySample {
                    let file = poses.urlsBySample[id]?.lastPathComponent ?? "sample-\(id)"
                    posed.insert(file)
                    let q = pose.rotation.vector
                    let t = pose.translation
                    list.append(["file": file, "rotation": [q.x, q.y, q.z, q.w], "translation": [t.x, t.y, t.z]])
                }
                result["poses"] = list.sorted { ($0["file"] as! String) < ($1["file"] as! String) }
                result["unposed"] = photos.map { $0.lastPathComponent }.filter { !posed.contains($0) }
                result["ok"] = list.count >= 2
            case .pointCloud(let cloud):
                result["points"] = cloud.points.count
            default:
                break
            }
        case .requestError(_, let error):
            result["error"] = String(describing: error)
        case .processingComplete:
            break outer
        case .invalidSample(let id, let reason):
            var bad = result["invalid"] as? [String] ?? []
            bad.append("\(id): \(reason)")
            result["invalid"] = bad
        default:
            break
        }
    }
} catch {
    result["error"] = String(describing: error)
}
result["seconds"] = Int(Date().timeIntervalSince(started))
write(result)
print("HB:poses \(result["ok"] as? Bool == true ? "ok" : "none") \((result["poses"] as? [Any])?.count ?? 0)/\(photos.count)")
