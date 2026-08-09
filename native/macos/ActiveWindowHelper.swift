import Cocoa
import CoreGraphics
import Foundation

func escaped(_ value: String) -> String {
    let data = try! JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])
    return String(data: data, encoding: .utf8)!
}

func activeWindowJSON() -> String {
    guard let app = NSWorkspace.shared.frontmostApplication else {
        return "{\"platform\":\"macos\",\"id\":0,\"title\":\"\",\"owner\":{" +
            "\"name\":\"\",\"processId\":0,\"bundleId\":\"\",\"path\":\"\"}," +
            "\"bounds\":{\"x\":0,\"y\":0,\"width\":0,\"height\":0}}"
    }
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    let name = app.localizedName ?? ""
    let bundle = app.bundleIdentifier ?? ""
    let executable = app.executableURL?.path ?? ""
    guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]],
          let window = windows.first(where: {
              (($0[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value ?? 0) == app.processIdentifier &&
              (($0[kCGWindowLayer as String] as? NSNumber)?.intValue ?? 1) == 0
          }),
          let boundsDictionary = window[kCGWindowBounds as String] as? NSDictionary,
          let bounds = CGRect(dictionaryRepresentation: boundsDictionary as CFDictionary) else {
        return "{\"platform\":\"macos\",\"id\":0,\"title\":\"\",\"owner\":{" +
            "\"name\":\(escaped(name)),\"processId\":\(app.processIdentifier)," +
            "\"bundleId\":\(escaped(bundle)),\"path\":\(escaped(executable))}," +
            "\"bounds\":{\"x\":0,\"y\":0,\"width\":0,\"height\":0}}"
    }
    let windowNumber = window[kCGWindowNumber as String] as? Int ?? 0
    return "{\"platform\":\"macos\",\"id\":\(windowNumber),\"title\":\"\",\"owner\":{" +
        "\"name\":\(escaped(name)),\"processId\":\(app.processIdentifier)," +
        "\"bundleId\":\(escaped(bundle)),\"path\":\(escaped(executable))}," +
        "\"bounds\":{\"x\":\(Int(bounds.origin.x)),\"y\":\(Int(bounds.origin.y))," +
        "\"width\":\(Int(bounds.width)),\"height\":\(Int(bounds.height))}}"
}

var previous: String? = nil
while true {
    autoreleasepool {
        let current = activeWindowJSON()
        if current != previous {
            print(current)
            fflush(stdout)
            previous = current
        }
    }
    usleep(200_000)
}
