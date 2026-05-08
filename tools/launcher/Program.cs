using System.Diagnostics;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Windows.Forms;

namespace WarThunderResearchCalculator;

internal static class Program
{
    private const int Port = 3000;
    private const string Url = "http://localhost:3000";

    [STAThread]
    private static async Task Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var shouldOpenBrowser = !args.Any(arg => string.Equals(arg, "--no-browser", StringComparison.OrdinalIgnoreCase));

        try
        {
            var appDir = FindAppDirectory();
            if (appDir is null)
            {
                ShowError("没有找到 main.js。请把这个启动器放在项目根目录，也就是 main.js 旁边。");
                return;
            }

            if (!IsPortOpen(Port))
            {
                if (!Directory.Exists(Path.Combine(appDir, "node_modules")))
                {
                    ShowError("没有找到 node_modules。请先在项目目录运行 npm install，再双击启动器。");
                    return;
                }

                var nodePath = FindNode(appDir);
                if (nodePath is null)
                {
                    ShowError("没有找到 node.exe。请先安装 Node.js，或把 node.exe 放在启动器旁边。");
                    return;
                }

                StartServer(appDir, nodePath);
            }

            if (!await WaitForServerAsync(TimeSpan.FromSeconds(20)))
            {
                ShowError("服务器没有在 20 秒内启动成功。可以手动运行 npm start 查看具体报错。");
                return;
            }

            if (shouldOpenBrowser)
            {
                OpenBrowser(Url);
            }
        }
        catch (Exception ex)
        {
            ShowError(ex.Message);
        }
    }

    private static string? FindAppDirectory()
    {
        foreach (var startDir in GetCandidateStartDirectories())
        {
            var dir = new DirectoryInfo(startDir);
            while (dir is not null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "main.js")) && File.Exists(Path.Combine(dir.FullName, "package.json")))
                {
                    return dir.FullName;
                }

                dir = dir.Parent;
            }
        }

        return null;
    }

    private static IEnumerable<string> GetCandidateStartDirectories()
    {
        var dirs = new[]
        {
            Path.GetDirectoryName(Environment.ProcessPath),
            AppContext.BaseDirectory,
            Environment.CurrentDirectory,
            Path.GetDirectoryName(Process.GetCurrentProcess().MainModule?.FileName),
        };

        return dirs.Where(dir => !string.IsNullOrWhiteSpace(dir)).Distinct(StringComparer.OrdinalIgnoreCase)!;
    }

    private static string? FindNode(string appDir)
    {
        var localNodes = new[]
        {
            Path.Combine(appDir, "node.exe"),
            Path.Combine(Environment.CurrentDirectory, "node.exe"),
            Path.Combine(Path.GetDirectoryName(Environment.ProcessPath) ?? "", "node.exe"),
            Path.Combine(AppContext.BaseDirectory, "node.exe"),
        };

        foreach (var localNode in localNodes.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (File.Exists(localNode)) return localNode;
        }

        var pathValue = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in pathValue.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            try
            {
                var candidate = Path.Combine(dir.Trim(), "node.exe");
                if (File.Exists(candidate)) return candidate;
            }
            catch
            {
                // Ignore malformed PATH entries.
            }
        }

        return null;
    }

    private static void StartServer(string appDir, string nodePath)
    {
        var logDir = Path.Combine(appDir, "logs");
        Directory.CreateDirectory(logDir);
        var outLog = Path.Combine(logDir, "server.out.log");
        var errLog = Path.Combine(logDir, "server.err.log");

        var startInfo = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = $"/d /c \"\"{nodePath}\" main.js > \"{outLog}\" 2> \"{errLog}\"\"",
            WorkingDirectory = appDir,
            UseShellExecute = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        };

        var process = new Process { StartInfo = startInfo };
        if (!process.Start())
        {
            throw new InvalidOperationException("启动 Node.js 服务失败。");
        }
    }

    private static bool IsPortOpen(int port)
    {
        var properties = IPGlobalProperties.GetIPGlobalProperties();
        return properties.GetActiveTcpListeners().Any(endpoint => endpoint.Port == port);
    }

    private static async Task<bool> WaitForServerAsync(TimeSpan timeout)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var deadline = DateTime.UtcNow + timeout;

        while (DateTime.UtcNow < deadline)
        {
            try
            {
                using var response = await client.GetAsync($"{Url}/api/meta");
                if (response.IsSuccessStatusCode) return true;
            }
            catch (HttpRequestException)
            {
            }
            catch (TaskCanceledException)
            {
            }
            catch (SocketException)
            {
            }

            await Task.Delay(500);
        }

        return false;
    }

    private static void OpenBrowser(string url)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = url,
            UseShellExecute = true,
        });
    }

    private static void ShowError(string message)
    {
        MessageBox.Show(message, "War Thunder 研发计算器启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
