# OCR helpers

The wizard's only platform-specific component. Each helper takes a PDF, renders
its pages, runs the OS's **local** OCR engine, and prints one JSON object to
stdout. Everything downstream (`src/wizard`) is shared and cross-platform.

| Platform | Helper | OCR engine | Status |
|---|---|---|---|
| macOS | `mac/vision_ocr.swift` | Apple Vision | ✅ built & tested |
| Windows | `win/WinOcr.cs` | Windows.Media.Ocr | ⏳ build on your PC |

Nothing leaves the machine — both engines run offline.

## The JSON contract (stdout)

```jsonc
{
  "engine": "apple-vision" | "windows-media-ocr",
  "pages": [
    {
      "index": 0,
      "width": 612, "height": 792,        // page size in points (aspect only)
      "image": "/tmp/.../page_0.png",     // rendered page PNG (for figure pages)
      "lines": [
        { "text": "…", "x": 0.1, "y": 0.05, "w": 0.3, "h": 0.02, "conf": 0.99 }
      ]
    }
  ]
}
```

Coordinates are normalized `[0,1]` with a **top-left** origin. Progress goes to
stderr; only the JSON goes to stdout.

## macOS

```bash
swiftc -O mac/vision_ocr.swift -o mac/vision_ocr   # or the wizard runs it via `swift`
```

## Windows

See [`win/README.md`](win/README.md). Build once with the .NET 8 SDK, drop
`WinOcr.exe` next to `WinOcr.cs`, and the wizard finds it automatically.
