import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Award,
  Smile, // Added for insights
  Frown, // Added for insights
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import { AnalysisResults } from "@/components/AnalysisResults";
import { StressRecommendations } from "@/components/StressRecommendations";

// --- Imports for data fetching ---
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, getDay } from "date-fns";
import { useLocation } from "react-router-dom"; // <-- 1. Import useLocation

// --- Custom Component for X-Axis Labels ---
const CustomXAxisTick = ({ x, y, payload }: any) => {
  if (!payload.value) return null;

  const date = new Date(payload.value);
  const dateStr = format(date, "MMM d");
  const timeStr = format(date, "h:mm a");

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="middle"
        fill="hsl(var(--muted-foreground))"
        fontSize={12}
      >
        <tspan x={0} dy="0.71em">
          {dateStr}
        </tspan>
        <tspan x={0} dy="1.2em">
          {timeStr}
        </tspan>
      </text>
    </g>
  );
};

// Card style to apply to all cards
const glassCardStyle = `
  relative group overflow-hidden
  rounded-2xl border border-white/10
  bg-gradient-to-br from-white/5 to-white/2
  backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)]
  transition-all duration-500
  hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)]
  hover:-translate-y-1
`;

// --- TypeScript interface for our chart data ---
interface ChartDataItem {
  date: string; // ISO string
  stress: number;
}
interface WeeklyItem {
  day: string;
  stress: number;
  scans: number;
  totalStress: number;
}
interface ProcessedDataItem {
  createdAt: Date;
  stress: number;
  [key: string]: any; // Allow other properties
}

export function Results() {
  const { user } = useAuth();
  const [_selectedPeriod, _setSelectedPeriod] = useState("7d");
  const location = useLocation(); // <-- 2. Get location

  // State for real data
  const [historicalData, setHistoricalData] = useState<ChartDataItem[]>([]);
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<WeeklyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 3. Get the default tab from navigation state
  const defaultTab = location.state?.defaultTab;

  // Add useEffect to fetch and process data
  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    const fetchTrends = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_API_URL}/api/analysis/user/${user.email}`
        );
        if (!res.ok) {
          throw new Error("Failed to fetch analysis trends");
        }
        const result = await res.json();

        if (result.status === "success" && result.data.length > 0) {
          const processedData: ProcessedDataItem[] = result.data
            .map((item: any) => {
              let stressScore = 2.0;
              if (item.hasStress) {
                stressScore = 5.0;
                if (item.confidenceLevel) {
                  stressScore = item.confidenceLevel * 10;
                }
              }
              return {
                ...item,
                createdAt: new Date(item.createdAt), // Store as Date object
                stress: parseFloat(stressScore.toFixed(1)),
              };
            })
            .reverse(); // Sort oldest to newest

          const chartData: ChartDataItem[] = processedData.map(
            (item: ProcessedDataItem) => ({
              date: item.createdAt.toISOString(),
              stress: item.stress,
            })
          );
          setHistoricalData(chartData);

          const daysOfWeek: WeeklyItem[] = [
            { day: "Sun", stress: 0, scans: 0, totalStress: 0 },
            { day: "Mon", stress: 0, scans: 0, totalStress: 0 },
            { day: "Tue", stress: 0, scans: 0, totalStress: 0 },
            { day: "Wed", stress: 0, scans: 0, totalStress: 0 },
            { day: "Thu", stress: 0, scans: 0, totalStress: 0 },
            { day: "Fri", stress: 0, scans: 0, totalStress: 0 },
            { day: "Sat", stress: 0, scans: 0, totalStress: 0 },
          ];

          processedData.forEach((item: ProcessedDataItem) => {
            const dayIndex = getDay(item.createdAt);
            daysOfWeek[dayIndex].scans += 1;
            daysOfWeek[dayIndex].totalStress += item.stress;
          });

          const formattedWeeklyData = daysOfWeek.map((day) => ({
            ...day,
            stress:
              day.scans > 0
                ? parseFloat((day.totalStress / day.scans).toFixed(1))
                : 0,
          }));
          setWeeklyBreakdown(formattedWeeklyData);
        } else {
          toast.info("No analysis data found to build trends.");
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to load trends");
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, [user]);

  // Calculate Dynamic Stats for Insights
  const weeklyStats = useMemo(() => {
    if (historicalData.length === 0 || weeklyBreakdown.length === 0) {
      return null;
    }

    const totalScans = weeklyBreakdown.reduce((acc, day) => acc + day.scans, 0);
    if (totalScans === 0) return null;

    const totalStress = weeklyBreakdown.reduce(
      (acc, day) => acc + day.totalStress,
      0
    );
    const avgStress = totalStress / totalScans;
    const mostStressfulDay = weeklyBreakdown.reduce(
      (max, day) => (day.stress > max.stress ? day : max),
      weeklyBreakdown[0]
    );

    // Assuming a stress score < 5 is "stress-free"
    const stressFreeScans = historicalData.filter(
      (d) => d.stress < 5
    ).length;

    // Trend calculation
    let trend = null;
    if (historicalData.length > 1) {
      const startStress = historicalData[0].stress;
      const endStress = historicalData[historicalData.length - 1].stress;
      if (endStress < startStress) {
        trend = {
          type: "positive",
          text: "Your stress levels are trending down this week. Keep it up!",
        };
      } else if (endStress > startStress) {
        trend = {
          type: "negative",
          text: "Your stress levels are trending up. Be mindful of triggers.",
        };
      } else {
        trend = {
          type: "neutral",
          text: "Your stress levels are stable this week.",
        };
      }
    }

    return {
      totalScans,
      avgStress,
      mostStressfulDay: mostStressfulDay,
      stressFreeScans,
      trend,
    };
  }, [historicalData, weeklyBreakdown]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-4 pb-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="container mx-auto max-w-7xl text-center">
          <p className="text-xl text-white/80">Loading your results...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mt-6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 px-4 pb-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
                  Stress Analysis
                </span>{" "}
                Results
              </h1>
              <p className="text-sm md:text-base text-white/60">
                Comprehensive insights into your stress patterns and wellness
                metrics
              </p>
            </div>
            <Badge
              variant="outline"
              className="px-4 py-2 rounded-full border-white/20 bg-white/5 text-white/80"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Last 7 days
            </Badge>
          </div>
        </div>

        {/* --- 4. Pass defaultTab to defaultValue --- */}
        <Tabs
          defaultValue={defaultTab || "current"}
          className="space-y-8"
        >
          <TabsList
            className="
              grid w-full grid-cols-3 max-w-md mx-auto 
              p-1
              bg-white/5 border border-white/15 rounded-full 
              backdrop-blur-2xl shadow-[0_14px_35px_rgba(0,0,0,0.45)]
            "
          >
            <TabsTrigger
              value="current"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 text-white/70 text-sm md:text-base"
            >
              Current
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 text-white/70 text-sm md:text-base"
            >
              Trends
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 text-white/70 text-sm md:text-base"
            >
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-8">
            <AnalysisResults />
            <StressRecommendations />
          </TabsContent>

          <TabsContent value="trends" className="space-y-8">
            {/* Stress Trend Chart */}
            <Card className={glassCardStyle}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/10 group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <span>Stress Level Trends</span>
                </CardTitle>
                <CardDescription className="text-white/60">
                  Your average daily stress score over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historicalData.length > 1 ? (
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historicalData}>
                        <defs>
                          <linearGradient
                            id="stressGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="hsl(var(--primary))"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="hsl(var(--primary))"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          tick={<CustomXAxisTick />}
                          height={40}
                          interval="preserveStartEnd"
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          labelFormatter={(label) =>
                            format(new Date(label), "MMM d, h:mm a")
                          }
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem",
                            color: "hsl(var(--popover-foreground))",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="stress"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          fill="url(#stressGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-white/60 text-center py-10">
                    Not enough data to show trends. Keep logging your scans!
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Weekly Breakdown (Now uses real data) */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className={glassCardStyle}>
                <CardHeader>
                  <CardTitle className="text-xl">
                    Average Daily Stress
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Average stress score by day of the week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyBreakdown}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="day"
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem",
                          }}
                        />
                        <Bar
                          dataKey="stress"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className={glassCardStyle}>
                <CardHeader>
                  <CardTitle className="text-xl">Daily Scans</CardTitle>
                  <CardDescription className="text-white/60">
                    Total scans by day of the week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyBreakdown}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="day"
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar
                          dataKey="scans"
                          fill="hsl(var(--accent))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* --- MODIFIED: Insights Tab --- */}
          <TabsContent value="insights" className="space-y-6">
            {weeklyStats ? (
              <>
                {/* Insights Cards */}
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card className={`${glassCardStyle} border-green-500/30`}>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-xl text-green-400">
                        <TrendingDown className="h-5 w-5" />
                        <span>Positive Trends</span>
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Areas where you're making great progress
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {weeklyStats.trend?.type === "positive" && (
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-green-400/20 flex items-center justify-center">
                            <TrendingDown className="w-4 h-4 text-green-400" />
                          </div>
                          <span className="text-sm text-white/90">
                            {weeklyStats.trend.text}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-green-400/20 flex items-center justify-center">
                          <Smile className="w-4 h-4 text-green-400" />
                        </div>
                        <span className="text-sm text-white/90">
                          You logged{" "}
                          <span className="font-bold text-green-300">
                            {weeklyStats.stressFreeScans}
                          </span>{" "}
                          stress-free scans this week.
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${glassCardStyle} border-yellow-500/30`}>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-xl text-yellow-400">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Areas for Improvement</span>
                      </CardTitle>
                      <CardDescription className="text-white/60">
                        Opportunities to optimize your wellness
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {weeklyStats.trend?.type === "negative" && (
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-yellow-400/20 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-yellow-400" />
                          </div>
                          <span className="text-sm text-white/90">
                            {weeklyStats.trend.text}
                          </span>
                        </div>
                      )}
                      {weeklyStats.mostStressfulDay.stress > 0 && (
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-yellow-400/20 flex items-center justify-center">
                            <Frown className="w-4 h-4 text-yellow-400" />
                          </div>
                          <span className="text-sm text-white/90">
                            Your most stressful day this week was{" "}
                            <span className="font-bold text-yellow-300">
                              {weeklyStats.mostStressfulDay.day}
                            </span>
                            .
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* --- MODIFIED: Wellness Score Card --- */}
                <Card className={glassCardStyle}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/10 group-hover:scale-110 transition-transform">
                        <Award className="h-5 w-5 text-primary" />
                      </div>
                      <span>Weekly Summary</span>
                    </CardTitle>
                    <CardDescription className="text-white/60">
                      Your key metrics from all scans this week
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="text-center space-y-4">
                        <div className="text-6xl font-bold text-primary">
                          {weeklyStats.avgStress.toFixed(1)}
                        </div>
                        <div className="text-lg text-white/60">
                          Weekly Avg. Stress
                        </div>
                        <Badge
                          variant="outline"
                          className={`px-4 py-2 rounded-full ${
                            weeklyStats.avgStress < 5
                              ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
                              : "border-yellow-400/40 bg-yellow-500/20 text-yellow-300"
                          }`}
                        >
                          {weeklyStats.avgStress < 5
                            ? "Good"
                            : "Moderate"}
                        </Badge>
                      </div>
                      <div className="space-y-6">
                        <div className="text-center">
                          <Progress
                            value={weeklyStats.avgStress * 10} // Assumes max score is 10
                            className="h-6 mb-3 bg-white/10 [&>div]:bg-primary"
                          />
                          <div className="flex justify-between text-sm text-white/60">
                            <span>Low Stress</span>
                            <span>High Stress</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between text-white/90">
                            <span className="text-sm">Total Scans:</span>
                            <span className="text-sm font-medium">
                              {weeklyStats.totalScans}
                            </span>
                          </div>
                          <div className="flex justify-between text-white/90">
                            <span className="text-sm">
                              Most Stressful Day:
                            </span>
                            <span className="text-sm font-medium">
                              {weeklyStats.mostStressfulDay.day} (Avg:{" "}
                              {weeklyStats.mostStressfulDay.stress})
                            </span>
                          </div>
                          <div className="flex justify-between text-white/90">
                            <span className="text-sm">
                              "Stress-Free" Scans:
                            </span>
                            <span className="text-sm font-medium">
                              {weeklyStats.stressFreeScans}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <p className="text-white/60 text-center py-10">
                Not enough data to show insights. Complete a few more scans!
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}