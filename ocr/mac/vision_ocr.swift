// Mac OCR helper: renders a PDF's pages and runs Apple Vision text recognition,
// emitting the common OCR JSON contract on stdout. This is the ONLY
// macOS-specific piece; everything downstream is shared TypeScript.
//
// Build a standalone binary:   swiftc -O ocr/mac/vision_ocr.swift -o ocr/mac/vision_ocr
// Or run directly:             swift ocr/mac/vision_ocr.swift <input.pdf> [maxPages]
//
// Output schema (stdout):
// { "engine":"apple-vision", "pages":[ { "index":0,"width":612,"height":792,
//     "lines":[ {"text":"...","x":0.1,"y":0.05,"w":0.3,"h":0.02,"conf":0.99} ] } ] }
// Coordinates are normalized [0,1] with a TOP-LEFT origin (y grows downward).

import Foundation
import PDFKit
import Vision
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write("usage: vision_ocr <input.pdf> [maxPages]\n".data(using: .utf8)!)
    exit(2)
}
let pdfPath = args[1]
let maxPages = args.count > 2 ? (Int(args[2]) ?? Int.max) : Int.max
let renderScale: CGFloat = 3.5 // upscale scans for better recognition

guard let doc = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
    FileHandle.standardError.write("cannot open PDF: \(pdfPath)\n".data(using: .utf8)!)
    exit(1)
}

func render(_ page: PDFPage) -> CGImage? {
    let rect = page.bounds(for: .mediaBox)
    let w = Int(rect.width * renderScale), h = Int(rect.height * renderScale)
    guard w > 0, h > 0,
          let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: renderScale, y: renderScale)
    page.draw(with: .mediaBox, to: ctx)
    return ctx.makeImage()
}

func ocr(_ image: CGImage) -> [[String: Any]] {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = true
    if #available(macOS 13.0, *) { req.revision = VNRecognizeTextRequestRevision3 }
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    try? handler.perform([req])
    let obs = req.results ?? []
    return obs.compactMap { o -> [String: Any]? in
        guard let c = o.topCandidates(1).first else { return nil }
        let b = o.boundingBox // normalized, bottom-left origin
        return [
            "text": c.string,
            "x": b.origin.x,
            "y": 1.0 - (b.origin.y + b.height), // convert to top-left origin
            "w": b.width,
            "h": b.height,
            "conf": c.confidence,
        ]
    }
}

// Temp dir for per-page PNGs, so the pipeline can embed figure pages as images.
let imgDir = NSTemporaryDirectory() + "visionocr_\(ProcessInfo.processInfo.processIdentifier)/"
try? FileManager.default.createDirectory(atPath: imgDir, withIntermediateDirectories: true)

func savePNG(_ image: CGImage, _ path: String) -> Bool {
    guard let dest = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil) else { return false }
    CGImageDestinationAddImage(dest, image, nil)
    return CGImageDestinationFinalize(dest)
}

var pages: [[String: Any]] = []
for i in 0..<min(doc.pageCount, maxPages) {
    guard let page = doc.page(at: i), let img = render(page) else { continue }
    let rect = page.bounds(for: .mediaBox)
    let imgPath = imgDir + "page_\(i).png"
    let saved = savePNG(img, imgPath)
    pages.append([
        "index": i,
        "width": rect.width,
        "height": rect.height,
        "image": saved ? imgPath : "",
        "lines": ocr(img),
    ])
    FileHandle.standardError.write("ocr page \(i + 1)/\(doc.pageCount)\n".data(using: .utf8)!)
}

let out: [String: Any] = ["engine": "apple-vision", "pages": pages]
let data = try JSONSerialization.data(withJSONObject: out, options: [])
FileHandle.standardOutput.write(data)
