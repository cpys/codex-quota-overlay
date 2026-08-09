using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;

internal static class TestRunner
{
    private static int failures;

    private static int Main(string[] args)
    {
        if (args.Length != 2)
        {
            Console.Error.WriteLine("Usage: TestRunner <overlay.exe> <expected-version>");
            return 2;
        }

        Assembly assembly = Assembly.LoadFrom(Path.GetFullPath(args[0]));
        string expectedVersion = args[1];

        Run("assembly version", delegate
        {
            string actual = assembly.GetName().Version.ToString(3);
            Equal(expectedVersion, actual);
        });

        Run("quota response parsing", delegate
        {
            Type snapshotType = RequireType(assembly, "CodexQuotaOverlay.QuotaSnapshot");
            MethodInfo parse = snapshotType.GetMethod("Parse", BindingFlags.Public | BindingFlags.Static);
            Dictionary<string, object> primary = new Dictionary<string, object>
            {
                { "usedPercent", 37.5 },
                { "resetsAt", 1786300800L }
            };
            Dictionary<string, object> credit = new Dictionary<string, object>
            {
                { "status", "available" },
                { "expiresAt", 1786387200L },
                { "title", "Rate-limit reset" }
            };
            Dictionary<string, object> result = new Dictionary<string, object>
            {
                { "rateLimits", new Dictionary<string, object> { { "primary", primary } } },
                { "rateLimitResetCredits", new Dictionary<string, object>
                    {
                        { "availableCount", 2 },
                        { "credits", new object[] { credit } }
                    }
                }
            };

            object snapshot = parse.Invoke(null, new object[] { result });
            NotNull(snapshot);
            Equal(37.5, (double)snapshotType.GetField("UsedPercent").GetValue(snapshot));
            Equal(1786300800L, (long)snapshotType.GetField("ResetsAt").GetValue(snapshot));
            Equal(2, (int)snapshotType.GetField("ResetCount").GetValue(snapshot));
            IList cards = (IList)snapshotType.GetField("ResetCards").GetValue(snapshot);
            Equal(1, cards.Count);
        });

        Run("missing primary bucket", delegate
        {
            Type snapshotType = RequireType(assembly, "CodexQuotaOverlay.QuotaSnapshot");
            MethodInfo parse = snapshotType.GetMethod("Parse", BindingFlags.Public | BindingFlags.Static);
            object snapshot = parse.Invoke(null, new object[]
            {
                new Dictionary<string, object> { { "rateLimits", new Dictionary<string, object>() } }
            });
            Equal(null, snapshot);
        });

        Run("unknown credit expiry", delegate
        {
            Type timeType = RequireType(assembly, "CodexQuotaOverlay.TimeText");
            MethodInfo format = timeType.GetMethod("FormatExpiry", BindingFlags.Public | BindingFlags.Static);
            Equal("到期时间未知", (string)format.Invoke(null, new object[] { 0L }));
        });

        Console.WriteLine(failures == 0 ? "All tests passed." : failures.ToString(CultureInfo.InvariantCulture) + " test(s) failed.");
        return failures == 0 ? 0 : 1;
    }

    private static Type RequireType(Assembly assembly, string name)
    {
        Type type = assembly.GetType(name, false);
        if (type == null)
        {
            throw new InvalidOperationException("Missing type: " + name);
        }
        return type;
    }

    private static void Run(string name, Action test)
    {
        try
        {
            test();
            Console.WriteLine("PASS  " + name);
        }
        catch (Exception ex)
        {
            failures++;
            Console.Error.WriteLine("FAIL  " + name + ": " + ex.GetBaseException().Message);
        }
    }

    private static void NotNull(object value)
    {
        if (value == null)
        {
            throw new InvalidOperationException("Expected non-null value.");
        }
    }

    private static void Equal(object expected, object actual)
    {
        if (!object.Equals(expected, actual))
        {
            throw new InvalidOperationException("Expected " + Format(expected) + ", got " + Format(actual) + ".");
        }
    }

    private static string Format(object value)
    {
        return value == null ? "<null>" : Convert.ToString(value, CultureInfo.InvariantCulture);
    }
}
