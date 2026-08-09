using System;
using System.Collections;
using System.Collections.Generic;
using System.Configuration;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyTitle("Codex Quota Overlay")]
[assembly: System.Reflection.AssemblyProduct("Codex Quota Overlay")]
[assembly: System.Reflection.AssemblyDescription("Shows Codex quota beside the active conversation title on Windows.")]
[assembly: System.Reflection.AssemblyCompany("cpys")]
[assembly: System.Reflection.AssemblyCopyright("Copyright (c) 2026 cpys and contributors")]
[assembly: System.Reflection.AssemblyVersion(CodexQuotaOverlay.AppInfo.AssemblyVersion)]
[assembly: System.Reflection.AssemblyFileVersion(CodexQuotaOverlay.AppInfo.AssemblyVersion)]
[assembly: System.Reflection.AssemblyInformationalVersion(CodexQuotaOverlay.AppInfo.Version)]

namespace CodexQuotaOverlay
{
    internal static class AppInfo
    {
        internal const string Version = "0.1.0";
        internal const string AssemblyVersion = "0.1.0.0";
        internal const string RepositoryUrl = "https://github.com/cpys/codex-quota-overlay";
        internal const string ReleasesUrl = RepositoryUrl + "/releases";
        internal const string PrivacyUrl = RepositoryUrl + "/blob/main/PRIVACY.md";

        internal static string TelemetryEndpoint
        {
            get { return ConfigurationManager.AppSettings["TelemetryEndpoint"] ?? string.Empty; }
        }
    }

    internal static class Program
    {
        private static Mutex instanceMutex;
        private const string ShutdownEventName = @"Local\CodexQuotaOverlayShutdown";

        [STAThread]
        private static void Main(string[] args)
        {
            if (args != null && Array.Exists(args, delegate(string value)
                { return string.Equals(value, "--shutdown", StringComparison.OrdinalIgnoreCase); }))
            {
                try
                {
                    using (EventWaitHandle existing = EventWaitHandle.OpenExisting(ShutdownEventName))
                    {
                        existing.Set();
                    }
                }
                catch (WaitHandleCannotBeOpenedException) { }
                return;
            }

            bool created;
            instanceMutex = new Mutex(true, @"Local\CodexQuotaOverlay", out created);
            if (!created)
            {
                return;
            }

            NativeMethods.EnablePerMonitorDpi();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                using (EventWaitHandle shutdownEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShutdownEventName))
                {
                    Application.Run(new OverlayContext(shutdownEvent));
                }
            }
            finally
            {
                instanceMutex.ReleaseMutex();
                instanceMutex.Dispose();
            }
        }
    }

    internal sealed class OverlayContext : ApplicationContext
    {
        private readonly QuotaOverlayForm overlay;
        private readonly System.Windows.Forms.Timer trackingTimer;
        private readonly NotifyIcon trayIcon;
        private readonly TelemetryClient telemetry;
        private readonly EventWaitHandle shutdownEvent;
        private CodexRpcClient rpc;
        private DateTime lastReadUtc = DateTime.MinValue;
        private DateTime codexMissingSinceUtc = DateTime.MinValue;
        private IntPtr mainWindow = IntPtr.Zero;
        private uint mainProcessId;
        private bool exiting;

        public OverlayContext(EventWaitHandle shutdownEvent)
        {
            this.shutdownEvent = shutdownEvent;
            overlay = new QuotaOverlayForm();
            telemetry = new TelemetryClient(AppSettings.Load());

            ContextMenuStrip menu = new ContextMenuStrip();
            ToolStripMenuItem version = new ToolStripMenuItem("Codex Quota Overlay v" + AppInfo.Version);
            version.Enabled = false;
            ToolStripMenuItem refresh = new ToolStripMenuItem("立即刷新");
            refresh.Click += delegate { RequestRefresh(true); };
            ToolStripMenuItem startup = new ToolStripMenuItem("开机自动启动");
            startup.Checked = StartupManager.IsEnabled();
            startup.CheckOnClick = true;
            startup.Click += delegate
            {
                try
                {
                    StartupManager.SetEnabled(startup.Checked);
                }
                catch (Exception ex)
                {
                    startup.Checked = StartupManager.IsEnabled();
                    Log.Write("Unable to change startup setting", ex);
                    MessageBox.Show("无法修改开机启动设置。", "Codex Quota Overlay", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            };
            ToolStripMenuItem telemetryItem = new ToolStripMenuItem("匿名使用统计（每日一次）");
            telemetryItem.Enabled = telemetry.IsConfigured;
            telemetryItem.Checked = telemetry.Enabled;
            telemetryItem.CheckOnClick = true;
            telemetryItem.Click += delegate
            {
                telemetry.SetEnabled(telemetryItem.Checked);
                if (telemetryItem.Checked)
                {
                    telemetry.SendHeartbeatIfDue(true);
                }
            };
            if (!telemetry.IsConfigured)
            {
                telemetryItem.Text += "（当前构建未配置）";
            }
            ToolStripMenuItem privacy = new ToolStripMenuItem("隐私说明");
            privacy.Click += delegate { Shell.OpenUrl(AppInfo.PrivacyUrl); };
            ToolStripMenuItem releases = new ToolStripMenuItem("检查更新");
            releases.Click += delegate { Shell.OpenUrl(AppInfo.ReleasesUrl); };
            ToolStripMenuItem about = new ToolStripMenuItem("关于");
            about.Click += delegate
            {
                MessageBox.Show(
                    "Codex Quota Overlay v" + AppInfo.Version + Environment.NewLine +
                    "在 Codex 会话标题旁显示额度与重置时间。" + Environment.NewLine + Environment.NewLine +
                    "非 OpenAI 官方项目。",
                    "关于 Codex Quota Overlay",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            };
            ToolStripMenuItem exit = new ToolStripMenuItem("退出");
            exit.Click += delegate { ExitApplication(); };
            menu.Items.Add(version);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(refresh);
            menu.Items.Add(startup);
            menu.Items.Add(telemetryItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(privacy);
            menu.Items.Add(releases);
            menu.Items.Add(about);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(exit);

            trayIcon = new NotifyIcon();
            trayIcon.Icon = IconFactory.CreateQuotaIcon();
            trayIcon.Text = "Codex 额度悬浮层";
            trayIcon.ContextMenuStrip = menu;
            trayIcon.Visible = true;

            trackingTimer = new System.Windows.Forms.Timer();
            trackingTimer.Interval = 250;
            trackingTimer.Tick += OnTrackingTick;
            trackingTimer.Start();

            telemetry.EnsureConsent();
            telemetry.SendHeartbeatIfDue(false);
        }

        private void OnTrackingTick(object sender, EventArgs e)
        {
            if (shutdownEvent.WaitOne(0))
            {
                ExitApplication();
                return;
            }

            telemetry.SendHeartbeatIfDue(false);

            IntPtr found;
            uint pid;
            if (NativeMethods.TryFindCodexMainWindow(out found, out pid))
            {
                mainWindow = found;
                mainProcessId = pid;
                codexMissingSinceUtc = DateTime.MinValue;
                EnsureRpcStarted();

                bool foreground = NativeMethods.ForegroundBelongsToProcess(mainProcessId);
                bool usable = foreground && NativeMethods.IsWindowVisible(mainWindow) &&
                              !NativeMethods.IsIconic(mainWindow) && !NativeMethods.IsWindowCloaked(mainWindow);

                if (usable)
                {
                    NativeMethods.RECT bounds;
                    if (NativeMethods.GetWindowRect(mainWindow, out bounds))
                    {
                        overlay.PlaceAgainst(bounds);
                        overlay.ShowPassive();
                    }
                }
                else
                {
                    overlay.HidePassive();
                }

                if (DateTime.UtcNow - lastReadUtc >= TimeSpan.FromSeconds(60))
                {
                    RequestRefresh(false);
                }
            }
            else
            {
                mainWindow = IntPtr.Zero;
                mainProcessId = 0;
                overlay.HidePassive();

                if (codexMissingSinceUtc == DateTime.MinValue)
                {
                    codexMissingSinceUtc = DateTime.UtcNow;
                }
                else if (DateTime.UtcNow - codexMissingSinceUtc >= TimeSpan.FromSeconds(5))
                {
                    StopRpc();
                }
            }
        }

        private void EnsureRpcStarted()
        {
            if (rpc != null && rpc.IsRunning)
            {
                return;
            }

            StopRpc();
            overlay.SetStatus("正在读取额度…");
            try
            {
                rpc = new CodexRpcClient();
                rpc.QuotaReceived += OnQuotaReceived;
                rpc.Failed += OnRpcFailed;
                rpc.Start();
                lastReadUtc = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                Log.Write("Unable to start Codex app-server", ex);
                overlay.SetStatus("额度暂不可用，稍后重试");
                trayIcon.Text = "Codex 额度：暂不可用";
                StopRpc();
            }
        }

        private void RequestRefresh(bool force)
        {
            if (rpc == null || !rpc.IsRunning)
            {
                EnsureRpcStarted();
                return;
            }

            if (!force && DateTime.UtcNow - lastReadUtc < TimeSpan.FromSeconds(20))
            {
                return;
            }

            lastReadUtc = DateTime.UtcNow;
            rpc.RequestRateLimits();
        }

        private void OnQuotaReceived(QuotaSnapshot snapshot)
        {
            if (exiting || overlay.IsDisposed)
            {
                return;
            }

            overlay.BeginInvoke((MethodInvoker)delegate
            {
                overlay.SetQuota(snapshot);
                int remaining = (int)Math.Round(Math.Max(0, Math.Min(100, 100 - snapshot.UsedPercent)), MidpointRounding.AwayFromZero);
                trayIcon.Text = SafeTrayText("Codex 剩余 " + remaining.ToString(CultureInfo.InvariantCulture) + "%");
            });
        }

        private void OnRpcFailed(string message)
        {
            if (exiting || overlay.IsDisposed)
            {
                return;
            }

            overlay.BeginInvoke((MethodInvoker)delegate
            {
                Log.Write(message, null);
                if (!overlay.HasQuota)
                {
                    overlay.SetStatus("额度暂不可用，稍后重试");
                    trayIcon.Text = "Codex 额度：暂不可用";
                }
            });
        }

        private static string SafeTrayText(string value)
        {
            return value.Length <= 63 ? value : value.Substring(0, 63);
        }

        private void StopRpc()
        {
            if (rpc == null)
            {
                return;
            }

            rpc.QuotaReceived -= OnQuotaReceived;
            rpc.Failed -= OnRpcFailed;
            rpc.Dispose();
            rpc = null;
        }

        private void ExitApplication()
        {
            if (exiting)
            {
                return;
            }

            exiting = true;
            trackingTimer.Stop();
            StopRpc();
            overlay.Close();
            trayIcon.Visible = false;
            trayIcon.Dispose();
            telemetry.Dispose();
            trackingTimer.Dispose();
            ExitThread();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && !exiting)
            {
                ExitApplication();
            }
            base.Dispose(disposing);
        }
    }

    internal sealed class QuotaOverlayForm : Form
    {
        private readonly Font primaryFont;
        private readonly Font secondaryFont;
        private string primaryText = "正在读取额度…";
        private readonly List<string> secondaryLines = new List<string>();
        private Color accent = Color.FromArgb(112, 178, 255);
        private float scale = 1.0f;
        private bool hasQuota;

        public bool HasQuota { get { return hasQuota; } }

        public QuotaOverlayForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.FromArgb(33, 35, 42);
            Opacity = 0.97;
            AutoScaleMode = AutoScaleMode.None;
            primaryFont = new Font("Segoe UI Semibold", 12.5f, FontStyle.Regular, GraphicsUnit.Point);
            secondaryFont = new Font("Segoe UI", 8.7f, FontStyle.Regular, GraphicsUnit.Point);

            using (Graphics g = CreateGraphics())
            {
                scale = Math.Max(1.0f, g.DpiX / 96.0f);
            }

            UpdateSizeAndShape();
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= NativeMethods.WS_EX_TOOLWINDOW | NativeMethods.WS_EX_NOACTIVATE |
                              NativeMethods.WS_EX_TRANSPARENT | NativeMethods.WS_EX_LAYERED;
                cp.ClassStyle |= NativeMethods.CS_DROPSHADOW;
                return cp;
            }
        }

        public void SetStatus(string text)
        {
            hasQuota = false;
            primaryText = text;
            secondaryLines.Clear();
            accent = Color.FromArgb(112, 178, 255);
            UpdateSizeAndShape();
            Invalidate();
        }

        public void SetQuota(QuotaSnapshot snapshot)
        {
            hasQuota = true;
            int remaining = (int)Math.Round(Math.Max(0, Math.Min(100, 100 - snapshot.UsedPercent)), MidpointRounding.AwayFromZero);
            primaryText = "剩余 " + remaining.ToString(CultureInfo.InvariantCulture) + "%  ·  " +
                          TimeText.FormatReset(snapshot.ResetsAt);

            if (remaining > 50)
            {
                accent = Color.FromArgb(77, 209, 141);
            }
            else if (remaining > 20)
            {
                accent = Color.FromArgb(246, 190, 72);
            }
            else
            {
                accent = Color.FromArgb(255, 103, 103);
            }

            secondaryLines.Clear();
            if (snapshot.ResetCount > 0)
            {
                primaryText += "  ·  Reset ×" + snapshot.ResetCount.ToString(CultureInfo.InvariantCulture);
                if (snapshot.ResetCards.Count == 0)
                {
                    // The count is authoritative even when the service omits card details.
                }
                else
                {
                    for (int i = 0; i < snapshot.ResetCards.Count; i++)
                    {
                        ResetCard card = snapshot.ResetCards[i];
                        string prefix = snapshot.ResetCards.Count == 1
                            ? "  ·  "
                            : (i == 0 ? "  ·  #1 " : " / #" + (i + 1).ToString(CultureInfo.InvariantCulture) + " ");
                        primaryText += prefix + TimeText.FormatExpiry(card.ExpiresAt);
                    }

                    if (snapshot.ResetCount > snapshot.ResetCards.Count)
                    {
                        primaryText += " / 另 " + (snapshot.ResetCount - snapshot.ResetCards.Count).ToString(CultureInfo.InvariantCulture) + " 张到期时间未知";
                    }
                }
            }

            UpdateSizeAndShape();
            Invalidate();
        }

        public void PlaceAgainst(NativeMethods.RECT owner)
        {
            int ownerWidth = owner.Right - owner.Left;
            int ownerHeight = owner.Bottom - owner.Top;
            int x = owner.Left + (int)Math.Round(ownerWidth * 0.40);
            int referenceHeight = (int)Math.Round(40 * scale);
            int heightAdjustment = Math.Max(0, Height - referenceHeight) / 2;
            int yOffset = Math.Max((int)(48 * scale), Math.Min((int)(96 * scale), (int)Math.Round(ownerHeight * 0.067)))
                          - (int)Math.Round(14 * scale) - heightAdjustment;
            int y = owner.Top + yOffset;

            int rightPadding = (int)(24 * scale);
            if (x + Width > owner.Right - rightPadding)
            {
                x = owner.Right - rightPadding - Width;
            }

            int contentLeft = owner.Left + (int)Math.Round(ownerWidth * 0.205);
            x = Math.Max(x, contentLeft + (int)(170 * scale));
            Location = new Point(x, y);
        }

        public void ShowPassive()
        {
            if (!Visible)
            {
                NativeMethods.ShowWindow(Handle, NativeMethods.SW_SHOWNOACTIVATE);
            }
            NativeMethods.SetWindowPos(Handle, NativeMethods.HWND_TOPMOST, Left, Top, Width, Height,
                NativeMethods.SWP_NOACTIVATE | NativeMethods.SWP_SHOWWINDOW);
        }

        public void HidePassive()
        {
            if (Visible)
            {
                Hide();
            }
        }

        private void UpdateSizeAndShape()
        {
            int horizontalPadding = (int)Math.Round(17 * scale);
            int dotSpace = (int)Math.Round(15 * scale);
            int primaryHeight = TextRenderer.MeasureText(primaryText, primaryFont, Size.Empty, TextFormatFlags.NoPadding).Height;
            int maxWidth = TextRenderer.MeasureText(primaryText, primaryFont, Size.Empty, TextFormatFlags.NoPadding).Width;
            int secondaryHeight = 0;

            foreach (string line in secondaryLines)
            {
                Size measured = TextRenderer.MeasureText(line, secondaryFont, Size.Empty, TextFormatFlags.NoPadding);
                maxWidth = Math.Max(maxWidth, measured.Width);
                secondaryHeight += measured.Height + (int)Math.Round(2 * scale);
            }

            int topBottom = (int)Math.Round(11 * scale);
            int gap = secondaryLines.Count > 0 ? (int)Math.Round(4 * scale) : 0;
            Width = maxWidth + horizontalPadding * 2 + dotSpace;
            Height = topBottom * 2 + primaryHeight + gap + secondaryHeight;

            int radius = Math.Max(12, (int)Math.Round(14 * scale));
            using (GraphicsPath path = RoundedRectangle(new Rectangle(0, 0, Width, Height), radius))
            {
                Region old = Region;
                Region = new Region(path);
                if (old != null)
                {
                    old.Dispose();
                }
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;

            Rectangle rect = new Rectangle(0, 0, Width - 1, Height - 1);
            int radius = Math.Max(12, (int)Math.Round(14 * scale));
            using (GraphicsPath path = RoundedRectangle(rect, radius))
            using (SolidBrush background = new SolidBrush(Color.FromArgb(33, 35, 42)))
            using (Pen border = new Pen(Color.FromArgb(76, 80, 91), Math.Max(1.0f, scale)))
            {
                e.Graphics.FillPath(background, path);
                e.Graphics.DrawPath(border, path);
            }

            int left = (int)Math.Round(17 * scale);
            int top = (int)Math.Round(10 * scale);
            int dot = Math.Max(6, (int)Math.Round(7 * scale));
            int dotTop = top + Math.Max(1, (int)Math.Round(4 * scale));
            using (SolidBrush dotBrush = new SolidBrush(accent))
            {
                e.Graphics.FillEllipse(dotBrush, left, dotTop, dot, dot);
            }

            int textLeft = left + dot + (int)Math.Round(8 * scale);
            Size primarySize = TextRenderer.MeasureText(primaryText, primaryFont, Size.Empty, TextFormatFlags.NoPadding);
            TextRenderer.DrawText(e.Graphics, primaryText, primaryFont,
                new Point(textLeft, top), Color.FromArgb(245, 246, 248),
                TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);

            int y = top + primarySize.Height + (int)Math.Round(4 * scale);
            foreach (string line in secondaryLines)
            {
                TextRenderer.DrawText(e.Graphics, line, secondaryFont,
                    new Point(textLeft, y), Color.FromArgb(177, 181, 191),
                    TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
                y += TextRenderer.MeasureText(line, secondaryFont, Size.Empty, TextFormatFlags.NoPadding).Height +
                     (int)Math.Round(2 * scale);
            }
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == NativeMethods.WM_NCHITTEST)
            {
                m.Result = new IntPtr(NativeMethods.HTTRANSPARENT);
                return;
            }
            if (m.Msg == NativeMethods.WM_MOUSEACTIVATE)
            {
                m.Result = new IntPtr(NativeMethods.MA_NOACTIVATE);
                return;
            }
            base.WndProc(ref m);
        }

        private static GraphicsPath RoundedRectangle(Rectangle bounds, int radius)
        {
            int diameter = radius * 2;
            GraphicsPath path = new GraphicsPath();
            path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
            path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
            path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                primaryFont.Dispose();
                secondaryFont.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    internal sealed class CodexRpcClient : IDisposable
    {
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();
        private readonly object sendLock = new object();
        private Process process;
        private Thread outputThread;
        private int nextRequestId = 10;
        private volatile bool initialized;
        private volatile bool disposed;

        public event Action<QuotaSnapshot> QuotaReceived;
        public event Action<string> Failed;

        public bool IsRunning
        {
            get
            {
                try
                {
                    return !disposed && process != null && !process.HasExited;
                }
                catch
                {
                    return false;
                }
            }
        }

        public void Start()
        {
            string executable = FindCodexExecutable();
            if (executable == null)
            {
                throw new FileNotFoundException("找不到 Codex 用户运行时 codex.exe");
            }

            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = executable;
            info.Arguments = "app-server";
            info.WorkingDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.WindowStyle = ProcessWindowStyle.Hidden;
            info.RedirectStandardInput = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;

            process = new Process();
            process.StartInfo = info;
            process.EnableRaisingEvents = true;
            process.Exited += delegate
            {
                if (!disposed)
                {
                    RaiseFailed("Codex app-server 已退出，将自动重试");
                }
            };
            process.ErrorDataReceived += delegate { };
            process.Start();
            process.BeginErrorReadLine();

            outputThread = new Thread(ReadOutputLoop);
            outputThread.IsBackground = true;
            outputThread.Name = "Codex quota RPC reader";
            outputThread.Start();

            Send(new Dictionary<string, object>
            {
                { "method", "initialize" },
                { "id", 0 },
                { "params", new Dictionary<string, object>
                    {
                        { "clientInfo", new Dictionary<string, object>
                            {
                                { "name", "codex_quota_overlay" },
                                { "title", "Codex Quota Overlay" },
                                { "version", AppInfo.Version }
                            }
                        }
                    }
                }
            });
        }

        public void RequestRateLimits()
        {
            if (!initialized || !IsRunning)
            {
                return;
            }

            int id = Interlocked.Increment(ref nextRequestId);
            Send(new Dictionary<string, object>
            {
                { "method", "account/rateLimits/read" },
                { "id", id }
            });
        }

        private void ReadOutputLoop()
        {
            try
            {
                string line;
                while (!disposed && process != null && (line = process.StandardOutput.ReadLine()) != null)
                {
                    HandleMessage(line);
                }
            }
            catch (Exception ex)
            {
                if (!disposed)
                {
                    Log.Write("Codex app-server output failed", ex);
                    RaiseFailed("读取 Codex 额度失败，将自动重试");
                }
            }
        }

        private void HandleMessage(string line)
        {
            Dictionary<string, object> message;
            try
            {
                message = json.DeserializeObject(line) as Dictionary<string, object>;
            }
            catch
            {
                return;
            }

            if (message == null)
            {
                return;
            }

            object idValue;
            if (message.TryGetValue("id", out idValue) && Convert.ToInt32(idValue, CultureInfo.InvariantCulture) == 0)
            {
                object error;
                if (message.TryGetValue("error", out error))
                {
                    RaiseFailed("Codex app-server 初始化失败");
                    return;
                }

                initialized = true;
                Send(new Dictionary<string, object>
                {
                    { "method", "initialized" },
                    { "params", new Dictionary<string, object>() }
                });
                RequestRateLimits();
                return;
            }

            string method = GetString(message, "method");
            if (method == "account/rateLimits/updated")
            {
                RequestRateLimits();
                return;
            }

            Dictionary<string, object> result = GetDictionary(message, "result");
            if (result != null && result.ContainsKey("rateLimits"))
            {
                QuotaSnapshot snapshot = QuotaSnapshot.Parse(result);
                if (snapshot != null)
                {
                    Action<QuotaSnapshot> handler = QuotaReceived;
                    if (handler != null)
                    {
                        handler(snapshot);
                    }
                }
                return;
            }

            if (message.ContainsKey("error"))
            {
                RaiseFailed("Codex 返回了额度读取错误");
            }
        }

        private void Send(Dictionary<string, object> message)
        {
            if (disposed || process == null)
            {
                return;
            }

            string line = json.Serialize(message);
            lock (sendLock)
            {
                try
                {
                    process.StandardInput.WriteLine(line);
                    process.StandardInput.Flush();
                }
                catch (Exception ex)
                {
                    if (!disposed)
                    {
                        Log.Write("Codex app-server send failed", ex);
                        RaiseFailed("无法向 Codex 请求额度");
                    }
                }
            }
        }

        private void RaiseFailed(string message)
        {
            Action<string> handler = Failed;
            if (handler != null)
            {
                handler(message);
            }
        }

        private static string FindCodexExecutable()
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string root = Path.Combine(local, "OpenAI", "Codex", "bin");
            if (!Directory.Exists(root))
            {
                return null;
            }

            FileInfo newest = null;
            foreach (string directory in Directory.GetDirectories(root))
            {
                string candidate = Path.Combine(directory, "codex.exe");
                if (!File.Exists(candidate))
                {
                    continue;
                }
                FileInfo info = new FileInfo(candidate);
                if (newest == null || info.LastWriteTimeUtc > newest.LastWriteTimeUtc)
                {
                    newest = info;
                }
            }
            return newest == null ? null : newest.FullName;
        }

        internal static Dictionary<string, object> GetDictionary(Dictionary<string, object> source, string key)
        {
            object value;
            return source != null && source.TryGetValue(key, out value) ? value as Dictionary<string, object> : null;
        }

        internal static string GetString(Dictionary<string, object> source, string key)
        {
            object value;
            return source != null && source.TryGetValue(key, out value) && value != null ? Convert.ToString(value, CultureInfo.InvariantCulture) : null;
        }

        public void Dispose()
        {
            if (disposed)
            {
                return;
            }
            disposed = true;
            initialized = false;

            try
            {
                if (process != null && !process.HasExited)
                {
                    process.Kill();
                    process.WaitForExit(2000);
                }
            }
            catch { }

            if (process != null)
            {
                process.Dispose();
                process = null;
            }
        }
    }

    internal sealed class QuotaSnapshot
    {
        public double UsedPercent;
        public long ResetsAt;
        public int ResetCount;
        public readonly List<ResetCard> ResetCards = new List<ResetCard>();

        public static QuotaSnapshot Parse(Dictionary<string, object> result)
        {
            Dictionary<string, object> limits = CodexRpcClient.GetDictionary(result, "rateLimits");
            Dictionary<string, object> primary = CodexRpcClient.GetDictionary(limits, "primary");
            if (primary == null)
            {
                return null;
            }

            QuotaSnapshot snapshot = new QuotaSnapshot();
            snapshot.UsedPercent = GetDouble(primary, "usedPercent");
            snapshot.ResetsAt = GetLong(primary, "resetsAt");

            Dictionary<string, object> reset = CodexRpcClient.GetDictionary(result, "rateLimitResetCredits");
            if (reset != null)
            {
                snapshot.ResetCount = GetInt(reset, "availableCount");
                object rows;
                if (reset.TryGetValue("credits", out rows) && rows != null)
                {
                    IEnumerable enumerable = rows as IEnumerable;
                    if (enumerable != null)
                    {
                        foreach (object row in enumerable)
                        {
                            Dictionary<string, object> cardData = row as Dictionary<string, object>;
                            if (cardData == null || CodexRpcClient.GetString(cardData, "status") != "available")
                            {
                                continue;
                            }
                            ResetCard card = new ResetCard();
                            card.ExpiresAt = GetLong(cardData, "expiresAt");
                            card.Title = CodexRpcClient.GetString(cardData, "title");
                            snapshot.ResetCards.Add(card);
                        }
                    }
                }
            }
            return snapshot;
        }

        private static int GetInt(Dictionary<string, object> source, string key)
        {
            object value;
            return source != null && source.TryGetValue(key, out value) && value != null ? Convert.ToInt32(value, CultureInfo.InvariantCulture) : 0;
        }

        private static long GetLong(Dictionary<string, object> source, string key)
        {
            object value;
            return source != null && source.TryGetValue(key, out value) && value != null ? Convert.ToInt64(value, CultureInfo.InvariantCulture) : 0;
        }

        private static double GetDouble(Dictionary<string, object> source, string key)
        {
            object value;
            return source != null && source.TryGetValue(key, out value) && value != null ? Convert.ToDouble(value, CultureInfo.InvariantCulture) : 0;
        }
    }

    internal sealed class ResetCard
    {
        public long ExpiresAt;
        public string Title;
    }

    internal static class TimeText
    {
        private static readonly DateTime UnixEpoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        public static string FormatReset(long unixSeconds)
        {
            return Format(unixSeconds, "重置");
        }

        public static string FormatExpiry(long unixSeconds)
        {
            return unixSeconds <= 0 ? "到期时间未知" : Format(unixSeconds, "到期");
        }

        private static string Format(long unixSeconds, string suffix)
        {
            if (unixSeconds <= 0)
            {
                return suffix + "时间未知";
            }
            DateTime local = UnixEpoch.AddSeconds(unixSeconds).ToLocalTime();
            DateTime today = DateTime.Now.Date;
            string day;
            if (local.Date == today)
            {
                day = "今天";
            }
            else if (local.Date == today.AddDays(1))
            {
                day = "明天";
            }
            else
            {
                day = local.ToString("M月d日", CultureInfo.GetCultureInfo("zh-CN"));
            }
            return day + " " + local.ToString("HH:mm", CultureInfo.InvariantCulture) + " " + suffix;
        }
    }

    internal static class IconFactory
    {
        public static Icon CreateQuotaIcon()
        {
            using (Bitmap bitmap = new Bitmap(32, 32))
            using (Graphics g = Graphics.FromImage(bitmap))
            using (SolidBrush background = new SolidBrush(Color.FromArgb(60, 195, 125)))
            using (SolidBrush foreground = new SolidBrush(Color.White))
            using (Font font = new Font("Segoe UI", 16, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.Transparent);
                g.FillEllipse(background, 1, 1, 30, 30);
                StringFormat format = new StringFormat();
                format.Alignment = StringAlignment.Center;
                format.LineAlignment = StringAlignment.Center;
                g.DrawString("%", font, foreground, new RectangleF(0, 0, 32, 30), format);
                IntPtr handle = bitmap.GetHicon();
                try
                {
                    return (Icon)Icon.FromHandle(handle).Clone();
                }
                finally
                {
                    NativeMethods.DestroyIcon(handle);
                }
            }
        }
    }

    internal sealed class AppSettings
    {
        private static readonly object Sync = new object();

        public string InstallationId;
        public bool? TelemetryEnabled;
        public string LastHeartbeatUtc;

        public static AppSettings Load()
        {
            AppSettings settings = null;
            try
            {
                string path = SettingsPath();
                if (File.Exists(path))
                {
                    settings = new JavaScriptSerializer().Deserialize<AppSettings>(File.ReadAllText(path, Encoding.UTF8));
                }
            }
            catch (Exception ex)
            {
                Log.Write("Unable to read settings", ex);
            }

            if (settings == null)
            {
                settings = new AppSettings();
            }
            Guid parsed;
            if (string.IsNullOrEmpty(settings.InstallationId) || !Guid.TryParse(settings.InstallationId, out parsed))
            {
                settings.InstallationId = Guid.NewGuid().ToString("D");
                settings.Save();
            }
            return settings;
        }

        public void Save()
        {
            try
            {
                lock (Sync)
                {
                    string path = SettingsPath();
                    Directory.CreateDirectory(Path.GetDirectoryName(path));
                    File.WriteAllText(path, new JavaScriptSerializer().Serialize(this), new UTF8Encoding(false));
                }
            }
            catch (Exception ex)
            {
                Log.Write("Unable to save settings", ex);
            }
        }

        private static string SettingsPath()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CodexQuotaOverlay",
                "settings.json");
        }
    }

    internal sealed class TelemetryClient : IDisposable
    {
        private readonly AppSettings settings;
        private readonly HttpClient http;
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();
        private DateTime nextAttemptUtc = DateTime.MinValue;
        private int sending;
        private bool disposed;

        public TelemetryClient(AppSettings settings)
        {
            this.settings = settings;
            http = new HttpClient();
            http.Timeout = TimeSpan.FromSeconds(5);
            http.DefaultRequestHeaders.UserAgent.ParseAdd("CodexQuotaOverlay/" + AppInfo.Version);
            try { ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12; } catch { }
        }

        public bool IsConfigured
        {
            get
            {
                Uri endpoint;
                return Uri.TryCreate(AppInfo.TelemetryEndpoint, UriKind.Absolute, out endpoint) &&
                       string.Equals(endpoint.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
            }
        }

        public bool Enabled { get { return IsConfigured && settings.TelemetryEnabled == true; } }

        public void EnsureConsent()
        {
            if (!IsConfigured || settings.TelemetryEnabled.HasValue)
            {
                return;
            }

            DialogResult result = MessageBox.Show(
                "是否允许每天发送一次匿名使用心跳？" + Environment.NewLine + Environment.NewLine +
                "仅包含随机安装 ID、应用版本、Windows 版本和界面语言；不包含 Codex 账户、额度、重置卡、会话内容或文件路径。你可以随时在托盘菜单中关闭。",
                "帮助改进 Codex Quota Overlay",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question,
                MessageBoxDefaultButton.Button2);
            SetEnabled(result == DialogResult.Yes);
        }

        public void SetEnabled(bool enabled)
        {
            settings.TelemetryEnabled = enabled;
            if (!enabled)
            {
                settings.LastHeartbeatUtc = null;
            }
            settings.Save();
        }

        public void SendHeartbeatIfDue(bool force)
        {
            if (disposed || !Enabled || DateTime.UtcNow < nextAttemptUtc)
            {
                return;
            }

            DateTime last;
            if (!force && DateTime.TryParse(
                    settings.LastHeartbeatUtc,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
                    out last) && DateTime.UtcNow - last.ToUniversalTime() < TimeSpan.FromHours(24))
            {
                return;
            }

            if (Interlocked.CompareExchange(ref sending, 1, 0) != 0)
            {
                return;
            }

            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    Dictionary<string, object> payload = new Dictionary<string, object>();
                    payload["schemaVersion"] = 1;
                    payload["event"] = "daily_active";
                    payload["installationId"] = settings.InstallationId;
                    payload["appVersion"] = AppInfo.Version;
                    payload["platform"] = "windows";
                    payload["osVersion"] = Environment.OSVersion.Version.ToString();
                    payload["locale"] = CultureInfo.CurrentUICulture.Name;
                    payload["sentAt"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);

                    using (StringContent content = new StringContent(json.Serialize(payload), Encoding.UTF8, "application/json"))
                    using (HttpResponseMessage response = http.PostAsync(AppInfo.TelemetryEndpoint, content).GetAwaiter().GetResult())
                    {
                        if (!response.IsSuccessStatusCode)
                        {
                            throw new InvalidOperationException("Telemetry endpoint returned HTTP " + (int)response.StatusCode);
                        }
                    }

                    settings.LastHeartbeatUtc = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
                    settings.Save();
                    nextAttemptUtc = DateTime.MinValue;
                }
                catch (Exception ex)
                {
                    nextAttemptUtc = DateTime.UtcNow.AddHours(1);
                    Log.Write("Anonymous heartbeat failed", ex);
                }
                finally
                {
                    Interlocked.Exchange(ref sending, 0);
                }
            });
        }

        public void Dispose()
        {
            disposed = true;
            http.Dispose();
        }
    }

    internal static class StartupManager
    {
        private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string ValueName = "CodexQuotaOverlay";

        public static bool IsEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RunKey, false))
                {
                    string value = key == null ? null : key.GetValue(ValueName) as string;
                    return !string.IsNullOrEmpty(value);
                }
            }
            catch
            {
                return false;
            }
        }

        public static void SetEnabled(bool enabled)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(RunKey))
            {
                if (enabled)
                {
                    string executable = Assembly.GetExecutingAssembly().Location;
                    key.SetValue(ValueName, "\"" + executable + "\"");
                }
                else
                {
                    key.DeleteValue(ValueName, false);
                }
            }
        }
    }

    internal static class Shell
    {
        public static void OpenUrl(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                Log.Write("Unable to open URL", ex);
            }
        }
    }

    internal static class Log
    {
        private static readonly object Sync = new object();

        public static void Write(string message, Exception error)
        {
            try
            {
                string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CodexQuotaOverlay");
                Directory.CreateDirectory(directory);
                string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) + "  " + message;
                if (error != null)
                {
                    line += "  " + error.GetType().Name + ": " + error.Message;
                }
                lock (Sync)
                {
                    File.AppendAllText(Path.Combine(directory, "overlay.log"), line + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch { }
        }
    }

    internal static class NativeMethods
    {
        internal const int WS_EX_TRANSPARENT = 0x00000020;
        internal const int WS_EX_TOOLWINDOW = 0x00000080;
        internal const int WS_EX_LAYERED = 0x00080000;
        internal const int WS_EX_NOACTIVATE = 0x08000000;
        internal const int CS_DROPSHADOW = 0x00020000;
        internal const int WM_NCHITTEST = 0x0084;
        internal const int HTTRANSPARENT = -1;
        internal const int WM_MOUSEACTIVATE = 0x0021;
        internal const int MA_NOACTIVATE = 3;
        internal const int SW_SHOWNOACTIVATE = 4;
        internal const uint SWP_NOACTIVATE = 0x0010;
        internal const uint SWP_SHOWWINDOW = 0x0040;
        internal static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        private const int DWMWA_CLOAKED = 14;

        internal delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [StructLayout(LayoutKind.Sequential)]
        internal struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [DllImport("user32.dll")]
        internal static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

        [DllImport("user32.dll")]
        internal static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        internal static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        internal static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

        [DllImport("user32.dll")]
        internal static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        internal static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        [DllImport("user32.dll")]
        internal static extern bool ShowWindow(IntPtr hWnd, int command);

        [DllImport("user32.dll")]
        internal static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

        [DllImport("dwmapi.dll")]
        private static extern int DwmGetWindowAttribute(IntPtr hWnd, int attribute, out int value, int size);

        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [DllImport("user32.dll", EntryPoint = "SetProcessDpiAwarenessContext")]
        private static extern bool SetProcessDpiAwarenessContext(IntPtr value);

        [DllImport("user32.dll")]
        internal static extern bool DestroyIcon(IntPtr icon);

        internal static void EnablePerMonitorDpi()
        {
            try
            {
                if (SetProcessDpiAwarenessContext(new IntPtr(-4)))
                {
                    return;
                }
            }
            catch { }
            try { SetProcessDPIAware(); } catch { }
        }

        internal static bool IsWindowCloaked(IntPtr window)
        {
            try
            {
                int cloaked;
                return DwmGetWindowAttribute(window, DWMWA_CLOAKED, out cloaked, sizeof(int)) == 0 && cloaked != 0;
            }
            catch
            {
                return false;
            }
        }

        internal static bool ForegroundBelongsToProcess(uint processId)
        {
            IntPtr foreground = GetForegroundWindow();
            uint foregroundProcess;
            GetWindowThreadProcessId(foreground, out foregroundProcess);
            return foregroundProcess == processId;
        }

        internal static bool TryFindCodexMainWindow(out IntPtr bestWindow, out uint bestProcessId)
        {
            IntPtr selected = IntPtr.Zero;
            uint selectedPid = 0;
            long selectedArea = 0;

            EnumWindows(delegate(IntPtr window, IntPtr ignored)
            {
                if (!IsWindowVisible(window) || IsWindowCloaked(window))
                {
                    return true;
                }

                uint pid;
                GetWindowThreadProcessId(window, out pid);
                if (pid == 0)
                {
                    return true;
                }

                try
                {
                    using (Process candidate = Process.GetProcessById((int)pid))
                    {
                        if (!string.Equals(candidate.ProcessName, "ChatGPT", StringComparison.OrdinalIgnoreCase))
                        {
                            return true;
                        }
                        string executable = candidate.MainModule == null ? null : candidate.MainModule.FileName;
                        if (string.IsNullOrEmpty(executable) ||
                            (executable.IndexOf("OpenAI.Codex_", StringComparison.OrdinalIgnoreCase) < 0 &&
                             executable.IndexOf("\\Codex\\", StringComparison.OrdinalIgnoreCase) < 0))
                        {
                            return true;
                        }
                    }
                }
                catch
                {
                    return true;
                }

                RECT rect;
                if (!GetWindowRect(window, out rect))
                {
                    return true;
                }
                int width = rect.Right - rect.Left;
                int height = rect.Bottom - rect.Top;
                if (width < 700 || height < 500)
                {
                    return true;
                }
                long area = (long)width * height;
                if (area > selectedArea)
                {
                    selected = window;
                    selectedPid = pid;
                    selectedArea = area;
                }
                return true;
            }, IntPtr.Zero);

            bestWindow = selected;
            bestProcessId = selectedPid;
            return selected != IntPtr.Zero;
        }
    }
}
