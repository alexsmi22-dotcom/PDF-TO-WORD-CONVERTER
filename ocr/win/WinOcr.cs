// Windows OCR helper: renders a PDF's pages (Windows.Data.Pdf) and runs the
// built-in Windows OCR engine (Windows.Media.Ocr), emitting the SAME JSON
// contract as the macOS Vision helper. Everything is local — no cloud.
//
// Build (on Windows, with the .NET 8 SDK):
//   cd ocr/win
//   dotnet publish -c Release
//   copy bin\Release\net8.0-windows10.0.19041.0\publish\WinOcr.exe .\WinOcr.exe
//
// Run:  WinOcr.exe <input.pdf> [maxPages]   (JSON to stdout, progress to stderr)
//
// Output schema (identical to the Mac helper):
// { "engine":"windows-media-ocr", "pages":[ { "index":0,"width":612,"height":792,
//     "image":"C:\\...\\page_0.png",
//     "lines":[ {"text":"...","x":0.1,"y":0.05,"w":0.3,"h":0.02,"conf":1.0} ] } ] }
// Coordinates are normalized [0,1], top-left origin.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.Data.Pdf;
using Windows.Globalization;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage;
using Windows.Storage.Streams;

internal static class WinOcr
{
    private const double RenderScale = 3.0; // upscale scans for better recognition

    private static async Task<int> Main(string[] args)
    {
        if (args.Length < 1)
        {
            Console.Error.WriteLine("usage: WinOcr <input.pdf> [maxPages]");
            return 2;
        }
        string pdfPath = Path.GetFullPath(args[0]);
        int maxPages = args.Length > 1 && int.TryParse(args[1], out int m) ? m : int.MaxValue;

        OcrEngine? engine = OcrEngine.TryCreateFromUserProfileLanguages()
                            ?? OcrEngine.TryCreateFromLanguage(new Language("en-US"));
        if (engine == null)
        {
            Console.Error.WriteLine("No Windows OCR language is installed. Add an English "
                + "language pack: Settings > Time & Language > Language, add English and its "
                + "optional 'Optical character recognition' feature.");
            return 1;
        }

        StorageFile file = await StorageFile.GetFileFromPathAsync(pdfPath);
        PdfDocument pdf = await PdfDocument.LoadFromFileAsync(file);

        string imgDir = Path.Combine(Path.GetTempPath(),
            "winocr_" + Process.GetCurrentProcess().Id);
        Directory.CreateDirectory(imgDir);

        var pages = new List<object>();
        uint count = Math.Min(pdf.PageCount, (uint)Math.Min((long)maxPages, pdf.PageCount));
        for (uint i = 0; i < count; i++)
        {
            using PdfPage page = pdf.GetPage(i);
            var pageSize = page.Size;

            // Render the page to a bitmap stream at higher resolution.
            using var renderStream = new InMemoryRandomAccessStream();
            var opts = new PdfPageRenderOptions
            {
                DestinationWidth = (uint)(pageSize.Width * RenderScale),
                DestinationHeight = (uint)(pageSize.Height * RenderScale),
            };
            await page.RenderToStreamAsync(renderStream, opts);

            renderStream.Seek(0);
            BitmapDecoder decoder = await BitmapDecoder.CreateAsync(renderStream);
            SoftwareBitmap bitmap = await decoder.GetSoftwareBitmapAsync(
                BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);
            double bw = bitmap.PixelWidth, bh = bitmap.PixelHeight;

            // Save a PNG of the page so the pipeline can embed figure pages.
            string imgPath = Path.Combine(imgDir, $"page_{i}.png");
            await SavePngAsync(bitmap, imgPath);

            // OCR.
            OcrResult result = await engine.RecognizeAsync(bitmap);
            var lines = new List<object>();
            foreach (OcrLine line in result.Lines)
            {
                if (line.Words.Count == 0) continue;
                double minX = double.MaxValue, minY = double.MaxValue, maxX = 0, maxY = 0;
                foreach (OcrWord word in line.Words)
                {
                    var r = word.BoundingRect;
                    minX = Math.Min(minX, r.X);
                    minY = Math.Min(minY, r.Y);
                    maxX = Math.Max(maxX, r.X + r.Width);
                    maxY = Math.Max(maxY, r.Y + r.Height);
                }
                lines.Add(new
                {
                    text = line.Text,
                    x = minX / bw,
                    y = minY / bh,
                    w = (maxX - minX) / bw,
                    h = (maxY - minY) / bh,
                    conf = 1.0, // Windows OCR does not expose per-line confidence
                });
            }

            pages.Add(new
            {
                index = (int)i,
                width = pageSize.Width,
                height = pageSize.Height,
                image = imgPath,
                lines,
            });
            Console.Error.WriteLine($"ocr page {i + 1}/{pdf.PageCount}");
        }

        var outObj = new { engine = "windows-media-ocr", pages };
        string json = JsonSerializer.Serialize(outObj);
        // Write raw UTF-8 bytes to stdout so the JSON is not re-encoded.
        using var stdout = Console.OpenStandardOutput();
        byte[] bytes = Encoding.UTF8.GetBytes(json);
        stdout.Write(bytes, 0, bytes.Length);
        return 0;
    }

    private static async Task SavePngAsync(SoftwareBitmap bitmap, string path)
    {
        using var stream = new InMemoryRandomAccessStream();
        BitmapEncoder encoder = await BitmapEncoder.CreateAsync(BitmapEncoder.PngEncoderId, stream);
        encoder.SetSoftwareBitmap(bitmap);
        await encoder.FlushAsync();

        stream.Seek(0);
        var reader = new DataReader(stream);
        await reader.LoadAsync((uint)stream.Size);
        byte[] buffer = new byte[stream.Size];
        reader.ReadBytes(buffer);
        File.WriteAllBytes(path, buffer);
    }
}
