import Foundation
import UIKit
import Capacitor

@objc(LocketNativePlugin)
public class LocketNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocketNativePlugin"
    public let jsName = "LocketNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "uploadBinary", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uploadMultipart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchBinaryBase64", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveToPhotos", returnType: CAPPluginReturnPromise)
    ]

    private var pendingPhotoSavers: [PhotoSaveHelper] = []

    @objc func uploadBinary(_ call: CAPPluginCall) {
        guard let urlStr = call.getString("url"), let url = URL(string: urlStr) else {
            call.reject("Thiếu hoặc sai định dạng URL upload.")
            return
        }
        let base64Body = call.getString("base64Body") ?? ""
        guard let bodyData = Data(base64Encoded: base64Body, options: .ignoreUnknownCharacters) else {
            call.reject("Dữ liệu ảnh base64 không hợp lệ.")
            return
        }

        let method = call.getString("method") ?? "PUT"
        var request = URLRequest(url: url, timeoutInterval: 90)
        request.httpMethod = method
        request.httpBody = bodyData

        if let headers = call.getObject("headers") {
            for (k, v) in headers {
                if let strVal = v as? String {
                    request.setValue(strVal, forHTTPHeaderField: k)
                }
            }
        }

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            let httpRes = response as? HTTPURLResponse
            let status = httpRes?.statusCode ?? 0
            let bodyText = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            var resHeaders: [String: String] = [:]
            if let allHeaders = httpRes?.allHeaderFields {
                for (k, v) in allHeaders {
                    resHeaders[String(describing: k)] = String(describing: v)
                }
            }
            call.resolve([
                "status": status,
                "body": bodyText,
                "headers": resHeaders
            ])
        }.resume()
    }

    @objc func uploadMultipart(_ call: CAPPluginCall) {
        guard let urlStr = call.getString("url"), let url = URL(string: urlStr) else {
            call.reject("Thiếu URL upload multipart.")
            return
        }
        let base64Body = call.getString("base64Body") ?? ""
        guard let fileData = Data(base64Encoded: base64Body, options: .ignoreUnknownCharacters) else {
            call.reject("Dữ liệu ảnh base64 không hợp lệ.")
            return
        }

        let fieldName = call.getString("fieldName") ?? "files"
        let fileName = call.getString("fileName") ?? "input.jpg"
        let mimeType = call.getString("mimeType") ?? "image/jpeg"
        let boundary = "----LocketBoundary\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))"

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        var request = URLRequest(url: url, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let bodyText = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            call.resolve([
                "status": status,
                "body": bodyText
            ])
        }.resume()
    }

    @objc func fetchBinaryBase64(_ call: CAPPluginCall) {
        guard let urlStr = call.getString("url"), let url = URL(string: urlStr) else {
            call.reject("Thiếu URL tải ảnh.")
            return
        }
        var request = URLRequest(url: url, timeoutInterval: 90)
        request.httpMethod = "GET"
        if let headers = call.getObject("headers") {
            for (k, v) in headers {
                if let strVal = v as? String {
                    request.setValue(strVal, forHTTPHeaderField: k)
                }
            }
        }

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            let httpRes = response as? HTTPURLResponse
            let status = httpRes?.statusCode ?? 0
            let mime = httpRes?.mimeType ?? "image/jpeg"
            let base64 = data?.base64EncodedString() ?? ""
            call.resolve([
                "status": status,
                "mimeType": mime,
                "base64": base64
            ])
        }.resume()
    }

    @objc func saveToPhotos(_ call: CAPPluginCall) {
        let base64Body = call.getString("base64Body") ?? ""
        guard let data = Data(base64Encoded: base64Body, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data) else {
            call.reject("Không thể giải mã ảnh để lưu.")
            return
        }

        DispatchQueue.main.async {
            let helper = PhotoSaveHelper()
            self.pendingPhotoSavers.append(helper)
            helper.save(image: image) { [weak self] err in
                self?.pendingPhotoSavers.removeAll { $0 === helper }
                if let err = err {
                    call.reject(err.localizedDescription)
                } else {
                    call.resolve(["saved": true])
                }
            }
        }
    }
}

private class PhotoSaveHelper: NSObject {
    private var completion: ((Error?) -> Void)?

    func save(image: UIImage, completion: @escaping (Error?) -> Void) {
        self.completion = completion
        UIImageWriteToSavedPhotosAlbum(
            image,
            self,
            #selector(image(_:didFinishSavingWithError:contextInfo:)),
            nil
        )
    }

    @objc private func image(_ image: UIImage, didFinishSavingWithError error: Error?, contextInfo: UnsafeRawPointer?) {
        completion?(error)
        completion = nil
    }
}

