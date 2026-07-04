# Windows OCR helper

A small .NET console app that renders a PDF and runs Windows' built-in OCR
(`Windows.Media.Ocr`) locally, emitting the shared OCR JSON contract. No cloud,
no NuGet packages — just WinRT APIs available on Windows 10/11.

## Prerequisites (on the Windows PC)

1. **Windows 10 (1903+) or Windows 11.**
2. **.NET 8 SDK** — https://dotnet.microsoft.com/download/dotnet/8.0
3. **An English OCR language pack** (usually already present). If OCR fails to
   start: Settings → *Time & Language* → *Language & region* → English →
   *Language options* → install the **Optical character recognition** feature.
4. **Node.js 20+** (to run the wizard) — https://nodejs.org

## Build

```powershell
cd ocr\win
dotnet publish -c Release
copy bin\Release\net8.0-windows10.0.19041.0\publish\WinOcr.exe .\WinOcr.exe
```

That produces `ocr\win\WinOcr.exe`, exactly where the wizard looks for it.

## Test the helper on its own

```powershell
.\WinOcr.exe "C:\path\to\US6421675.pdf" 2 > out.json
```

`out.json` should contain `"engine":"windows-media-ocr"` and per-page `lines`.

## Run the full wizard

From the repo root (after `npm install` once):

```powershell
npx vite-node src\wizard\wizard.ts "C:\path\to\patent.pdf" "C:\path\to\out.docx"
```

The wizard detects Windows, calls `WinOcr.exe`, reconstructs the document,
keeps figure pages as images, runs the text cleanup, and writes the editable
`.docx`.

## Notes / things to verify on the PC

- **`AsStreamForRead`/stream APIs**: the helper avoids them by reading PNG bytes
  through a `DataReader`, which is portable across .NET WinRT versions.
- **Confidence**: Windows OCR doesn't expose per-line confidence, so `conf` is
  reported as `1.0`. The layout pipeline doesn't depend on it.
- **Accuracy**: Windows OCR is good but a notch below Apple Vision on dense
  pages. The repair engine's character cleanup runs regardless; proofread
  patent numbers against the source.
- If `dotnet publish` complains about the Windows SDK target, install the
  **Windows SDK** (or change the TFM's `19041` to a build you have).
