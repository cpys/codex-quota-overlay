using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

internal static class ActiveWindowHelper
{
    [StructLayout(LayoutKind.Sequential)]
    private struct Rect { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out Rect rect);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();

    [DllImport("user32.dll", EntryPoint = "SetProcessDpiAwarenessContext")]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr context);

    public static void Main()
    {
        bool created;
        using (Mutex instance = new Mutex(true, "Local\\CodexQuotaOverlay", out created))
        {
            if (!created) return;
            try { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
            catch { try { SetProcessDPIAware(); } catch { } }
            Console.OutputEncoding = new UTF8Encoding(false);
            string previous = null;
            while (true)
            {
                string value = ReadActiveWindow() ?? EmptyWindow();
                if (value != previous)
                {
                    Console.WriteLine(value);
                    Console.Out.Flush();
                    previous = value;
                }
                Thread.Sleep(200);
            }
        }
    }

    private static string EmptyWindow()
    {
        return "{\"platform\":\"windows\",\"id\":0,\"title\":\"\",\"owner\":{" +
            "\"name\":\"\",\"processId\":0,\"path\":\"\"}," +
            "\"bounds\":{\"x\":0,\"y\":0,\"width\":0,\"height\":0}}";
    }

    private static string ReadActiveWindow()
    {
        IntPtr window = GetForegroundWindow();
        Rect rect;
        uint processId;
        if (window == IntPtr.Zero || !GetWindowRect(window, out rect)) return null;
        GetWindowThreadProcessId(window, out processId);
        if (processId == 0) return null;
        try
        {
            using (Process process = Process.GetProcessById((int)processId))
            {
                string filePath = string.Empty;
                try { filePath = process.MainModule.FileName; } catch { }
                return "{\"platform\":\"windows\",\"id\":" + window.ToInt64() +
                    ",\"title\":\"\",\"owner\":{\"name\":\"" + Escape(process.ProcessName) +
                    "\",\"processId\":" + processId + ",\"path\":\"" + Escape(filePath) +
                    "\"},\"bounds\":{\"x\":" + rect.Left + ",\"y\":" + rect.Top +
                    ",\"width\":" + (rect.Right - rect.Left) + ",\"height\":" + (rect.Bottom - rect.Top) + "}}";
            }
        }
        catch { return null; }
    }

    private static string Escape(string value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        StringBuilder output = new StringBuilder(value.Length + 8);
        foreach (char character in value)
        {
            if (character == '\\' || character == '"') output.Append('\\');
            if (character == '\r') output.Append("\\r");
            else if (character == '\n') output.Append("\\n");
            else if (character >= 32) output.Append(character);
        }
        return output.ToString();
    }
}
