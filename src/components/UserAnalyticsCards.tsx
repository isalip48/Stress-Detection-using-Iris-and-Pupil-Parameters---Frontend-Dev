import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, TrendingUp, Clock, Target, RefreshCw } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { User } from "@/types";

/* ————————————————
   TYPE DEFINITIONS
——————————————— */

interface AnalysisData {
  _id: string;
  username: string;
  hasStress: boolean;
  imageUrl: string | null;
  createdAt: string;
}

interface UserAnalytics {
  count: number;
  data: AnalysisData[];
}

interface LatestAnalysis {
  _id: string;
  username: string;
  hasStress: boolean;
  imageUrl: string | null;
  createdAt: string;
}

interface WeeklyTrend {
  week: string;
  total: number;
  stressDetected: number;
  percentage: number;
}

interface HealthSummary {
  summary: {
    totalAnalyses: number;
    stressDetectedCount: number;
    stressPercentage: number;
    latestStatus: string;
    latestAnalysisTime: string;
  };
  weeklyTrends: WeeklyTrend[];
}

interface StatCard {
  icon: any;
  title: string;
  value: string;
  description: string;
  color: string;
  trend: string;
  extraData?: WeeklyTrend[];
}

/* ————————————————
   MAIN COMPONENT
——————————————— */

export function UserAnalyticsCards() {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<LatestAnalysis | null>(
    null
  );
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(
    null
  );

  /* ————————————————
     LOAD USER
  ———————————————— */
  useEffect(() => {
    const storedUser = localStorage.getItem("eyeGlazeUser");
    setUser(storedUser ? JSON.parse(storedUser) : null);
  }, []);

  /* ————————————————
     FETCH ANALYTICS
  ———————————————— */
  const fetchUserAnalytics = useCallback(async () => {
    if (!user) return;
    const identifier = user.email || user.name;

    setLoading(true);
    setRefreshing(true);

    try {
      const response = await fetch(
        `https://fancy-avrit-isali-e9a270c8.koyeb.app/api/analysis/user/${identifier}`
      );

      if (!response.ok) throw new Error("Failed to fetch user analytics");

      const data = await response.json();
      setAnalytics(data);

      if (refreshing && !loading) toast.success("Analytics data refreshed");
    } catch {
      if (refreshing && !loading) toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  /* ————————————————
     FETCH LATEST ANALYSIS
  ———————————————— */
  const fetchLatestAnalysis = useCallback(async () => {
    if (!user?.email) return;

    try {
      const res = await fetch(
        `https://fancy-avrit-isali-e9a270c8.koyeb.app/api/analysis/latest/${user.email}`
      );
      const result = await res.json();

      if (result.status === "success") setLatestAnalysis(result.data);
    } catch (e) {
      console.error("Error fetching latest analysis:", e);
    }
  }, [user]);

  /* ————————————————
     FETCH HEALTH SUMMARY
  ———————————————— */
  const fetchHealthSummary = useCallback(async () => {
    if (!user?.email) return;

    try {
      const res = await fetch(
        `https://fancy-avrit-isali-e9a270c8.koyeb.app/api/recommendations/summary/${user.email}`
      );
      const result = await res.json();

      if (result.status === "success") setHealthSummary(result.data);
    } catch (e) {
      console.error("Error fetching health summary:", e);
    }
  }, [user]);

  /* ————————————————
     RUN FETCHERS
  ———————————————— */
  useEffect(() => {
    if (user) {
      fetchUserAnalytics();
      fetchLatestAnalysis();
      fetchHealthSummary();
    }
  }, [user]);

  /* ————————————————
     CALCULATE STATS
  ———————————————— */
  const calculateStats = (): StatCard[] => {
    let total = 0;
    let stressPercent = 0;
    let latestTime = "No Data";
    let latestStatus = "No recent scans";
    let wellnessGoal = 0;
    let trends: WeeklyTrend[] = [];
    let hasStress = false;

    if (healthSummary) {
      const s = healthSummary.summary;
      total = s.totalAnalyses;
      stressPercent = s.stressPercentage;
      latestStatus = s.latestStatus;
      wellnessGoal = 100 - stressPercent;
      trends = healthSummary.weeklyTrends;
      hasStress = latestStatus.toLowerCase().includes("stress");
    }

    if (latestAnalysis?.createdAt) {
      latestTime = formatDistanceToNow(new Date(latestAnalysis.createdAt), {
        addSuffix: true,
      });
    }

    return [
      {
        icon: Eye,
        title: "Total Analyses",
        value: total.toString(),
        description: "Eye scans completed",
        color: "text-primary",
        trend: "New",
      },
      {
        icon: TrendingUp,
        title: "Average Stress",
        value: `${Math.round(stressPercent / 10)}/10`,
        description: "Based on all scans",
        color: "text-primary",
        trend: "+7%",
      },
      {
        icon: Clock,
        title: "Last Analysis",
        value: latestTime,
        description: latestStatus,
        color: "text-primary",
        trend: "Recent",
      },
      {
        icon: Target,
        title: "Wellness Goal",
        value: `${Math.round(wellnessGoal)}%`,
        description: "Progress to target",
        color: "text-primary",
        trend: "-3%",
        extraData: trends,
      },
    ];
  };

  const stats = loading
    ? [
        {
          icon: Eye,
          title: "Total Analyses",
          value: "0",
          description: "Eye scans completed",
          color: "text-primary",
          trend: "New",
        },
        {
          icon: TrendingUp,
          title: "Average Stress",
          value: "0/10",
          description: "Based on all scans",
          color: "text-primary",
          trend: "—",
        },
        {
          icon: Clock,
          title: "Last Analysis",
          value: "No Data",
          description: "No recent scans",
          color: "text-primary",
          trend: "—",
        },
        {
          icon: Target,
          title: "Wellness Goal",
          value: "0%",
          description: "Progress to target",
          color: "text-primary",
          trend: "—",
        },
      ]
    : calculateStats();

  /* ————————————————
     REFRESH HANDLER
  ———————————————— */
  const handleRefresh = () => {
    setRefreshing(true);
    fetchUserAnalytics();
    fetchLatestAnalysis();
    fetchHealthSummary();
  };

  /* ————————————————
     JSX
  ———————————————— */
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Your Analytics</h2>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="flex items-center gap-2 hover:scale-105 transition-all"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <Card
            key={index}
            className="
              relative group overflow-hidden animate-cardFadeUp
              rounded-2xl border border-white/10
              bg-gradient-to-br from-white/5 to-white/2
              backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)]
              transition-all duration-500
              hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)]
              hover:-translate-y-1
            "
            style={{ animationDelay: `${index * 0.12}s` }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-primary/10 to-accent/10 transition-all duration-500" />

            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center
                    bg-gradient-to-br
                    ${
                      stat.color.includes("red")
                        ? "from-red-500/30 to-red-500/10"
                        : "from-primary/30 to-accent/10"
                    }
                    group-hover:scale-110 transition-transform
                  `}
                >
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>

                <CardTitle className="text-base font-semibold text-white/80">
                  {stat.title}
                </CardTitle>
              </div>

              {stat.trend !== "—" && (
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${
                    stat.trend.includes("-")
                      ? "bg-red-500/20 text-red-400 border-red-400/40"
                      : "bg-emerald-500/20 text-emerald-400 border-emerald-400/40"
                  }`}
                >
                  {stat.trend}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="relative flex items-center justify-center min-h-[130px] px-2">
              {/* LAST ANALYSIS SPECIAL */}
              {stat.title === "Last Analysis" && latestAnalysis?.imageUrl ? (
                <>
                  {/* Centered Image */}
                  <div className="relative w-30 h-20 rounded-sm overflow-hidden shadow-lg mb-6">
                    <img
                      src={latestAnalysis.imageUrl}
                      alt="Eye scan"
                      className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700 "
                    />
                    <div className="absolute inset-0 bg-black/30" />
                  </div>

                  {/* Content at the bottom */}
                  <div className="absolute bottom-0 left-2 right-2 text-center">
                    <div className={`text-sm text-gray-400 truncate `}>
                      {formatDistanceToNow(new Date(latestAnalysis.createdAt), {
                        addSuffix: true,
                      })}
                    </div>

                    <div
                      className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
              ${
                latestAnalysis.hasStress
                  ? "bg-red-500/20 text-red-400"
                  : "bg-primary/20 text-primary"
              }`}
                    >
                      {latestAnalysis.hasStress ? " Stress" : "No Stress"}
                    </div>
                  </div>
                </>
              ) : stat.title === "Wellness Goal" &&
                stat.extraData &&
                stat.extraData.length > 0 ? (
                /* WELLNESS GOAL */
                <div className="w-full space-y-2">
                  <div
                    className={`text-4xl font-extrabold tracking-tight ${stat.color}`}
                  >
                    {stat.value}
                  </div>
                  <p className="text-sm text-white/60">{stat.description}</p>

                  <div className="space-y-2 pt-2">
                    {stat.extraData.slice(0, 2).map((week, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs text-white/60">
                          <span>{format(new Date(week.week), "MMM d")}</span>
                          <span className={`font-semibold `}>
                            {week.stressDetected}/{week.total}
                          </span>
                        </div>

                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all rounded-full bg-gradient-to-r from-primary to-accent
                            `}
                            style={{
                              width: `${week.percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* DEFAULT STAT DISPLAY */
                <div className="text-center w-full">
                  <div
                    className={`text-5xl font-extrabold mb-2 ${stat.color} group-hover:scale-105 transition-transform`}
                  >
                    {stat.value}
                  </div>
                  <p className="text-sm text-white/60">{stat.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
