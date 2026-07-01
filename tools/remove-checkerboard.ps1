param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not ('CheckerboardBackgroundRemover' -as [type])) {
    Add-Type -ReferencedAssemblies 'System.Drawing' -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class CheckerboardBackgroundRemover
{
    public static void Remove(string inputPath, string outputPath)
    {
        using (var source = new Bitmap(inputPath))
        using (var output = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(output))
            {
                graphics.DrawImageUnscaled(source, 0, 0);
            }

            var rect = new Rectangle(0, 0, output.Width, output.Height);
            var data = output.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);

            try
            {
                int width = output.Width;
                int height = output.Height;
                int stride = data.Stride;
                byte[] pixels = new byte[stride * height];
                Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);

                bool[] removable = new bool[width * height];
                bool[] background = new bool[width * height];
                var queue = new Queue<int>();

                for (int y = 0; y < height; y++)
                {
                    int row = y * stride;
                    for (int x = 0; x < width; x++)
                    {
                        int offset = row + x * 4;
                        int b = pixels[offset];
                        int g = pixels[offset + 1];
                        int r = pixels[offset + 2];
                        int max = Math.Max(r, Math.Max(g, b));
                        int min = Math.Min(r, Math.Min(g, b));

                        // The fake transparency consists of bright, nearly neutral
                        // checkerboard pixels. The ivory card and gold trim are warmer,
                        // so the chroma guard keeps them intact.
                        removable[y * width + x] = min >= 215 && (max - min) <= 9;
                    }
                }

                Action<int> seed = index =>
                {
                    if (removable[index] && !background[index])
                    {
                        background[index] = true;
                        queue.Enqueue(index);
                    }
                };

                for (int x = 0; x < width; x++)
                {
                    seed(x);
                    seed((height - 1) * width + x);
                }

                for (int y = 0; y < height; y++)
                {
                    seed(y * width);
                    seed(y * width + width - 1);
                }

                int[] dx = { -1, 0, 1, -1, 1, -1, 0, 1 };
                int[] dy = { -1, -1, -1, 0, 0, 1, 1, 1 };

                while (queue.Count > 0)
                {
                    int index = queue.Dequeue();
                    int x = index % width;
                    int y = index / width;

                    for (int direction = 0; direction < dx.Length; direction++)
                    {
                        int nx = x + dx[direction];
                        int ny = y + dy[direction];
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height)
                            continue;

                        int neighbor = ny * width + nx;
                        if (removable[neighbor] && !background[neighbor])
                        {
                            background[neighbor] = true;
                            queue.Enqueue(neighbor);
                        }
                    }
                }

                for (int y = 0; y < height; y++)
                {
                    int row = y * stride;
                    for (int x = 0; x < width; x++)
                    {
                        int index = y * width + x;
                        pixels[row + x * 4 + 3] = background[index] ? (byte)0 : (byte)255;
                    }
                }

                Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
            }
            finally
            {
                output.UnlockBits(data);
            }

            string directory = Path.GetDirectoryName(outputPath);
            if (!String.IsNullOrEmpty(directory))
                Directory.CreateDirectory(directory);

            output.Save(outputPath, ImageFormat.Png);
        }
    }
}
'@
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
[CheckerboardBackgroundRemover]::Remove($resolvedInput, $resolvedOutput)
Write-Output "Saved transparent image to $resolvedOutput"
