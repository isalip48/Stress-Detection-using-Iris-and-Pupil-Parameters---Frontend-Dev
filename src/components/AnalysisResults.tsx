import { useEffect, useState } from "react";
import { Eye, Brain, Activity, AlertCircle, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// Card style to apply
const glassCardStyle = `
  relative group overflow-hidden
  rounded-2xl border border-white/10
  bg-gradient-to-br from-white/5 to-white/2
  backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)]
  transition-all duration-500
  hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)]
  hover:-translate-y-1
`;

interface User {
  name?: string;
  email: string;
  age?: number;
}

interface LatestAnalysis {
  _id: string;
  username: string;
  hasStress: boolean;
  imageUrl: string | null;
  confidenceLevel: number | null;
  pupilDilation: number | null;
  tensionRings: number | null;
  fullDetails?: any;
  createdAt: string;
}

export function AnalysisResults() {
  const [user, setUser] = useState<User | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<LatestAnalysis | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    return date.toLocaleString("en-US", options);
  };

  const formatLongDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    return date.toLocaleString("en-US", options);
  };

  useEffect(() => {
    const getUserFromStorage = (): User | null => {
      const storedUser = localStorage.getItem("eyeGlazeUser");
      return storedUser ? JSON.parse(storedUser) : null;
    };

    setUser(getUserFromStorage());
  }, []);

  const fetchLatestAnalysis = async (username: string) => {
    try {
      const response = await fetch(
        `http://localhost:5174/api/analysis/latest/${username}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch latest analysis: ${response.status}`);
      }

      const result = await response.json();
      if (result.status === "success" && result.data) {
        setLatestAnalysis(result.data);
      }
    } catch (error) {
      console.error("Error fetching latest analysis:", error);
      toast.error("Could not retrieve latest analysis data");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user?.email) return;

      setLoading(true);

      try {
        await fetchLatestAnalysis(user.email);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  const getStressLevel = (
    hasStress: boolean,
    confidenceLevel: number | null
  ) => {
    if (!hasStress) return "Low";
    if (!confidenceLevel) return "Moderate";
    if (confidenceLevel > 0.7) return "High";
    return "Moderate";
  };

  const getStressBadgeClasses = (hasStress: boolean) => {
    return hasStress
      ? "bg-red-500/20 text-red-400 border-red-400/40"
      : "bg-emerald-500/20 text-emerald-400 border-emerald-400/40";
  };

  if (loading) {
    return (
      <Card className={glassCardStyle}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl text-white">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/10">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <span>Loading Analysis...</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!latestAnalysis) {
    return (
      <Card className={glassCardStyle}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl text-white">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/10">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <span>No Analysis Found</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">
            You haven't completed any eye analyses yet. Complete your first scan
            to see results here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={glassCardStyle}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-2xl text-white">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/10 group-hover:scale-110 transition-transform">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <span>Latest Analysis</span>
            </CardTitle>
            {/* --- MODIFICATION: Removed Analysis ID --- */}
            <CardDescription className="text-white/60 mt-2 ml-14 sm:ml-0">
              {formatDate(latestAnalysis.createdAt)}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={`px-4 py-2 text-sm mt-4 sm:mt-0 ${getStressBadgeClasses(
              latestAnalysis.hasStress
            )}`}
          >
            {getStressLevel(
              latestAnalysis.hasStress,
              latestAnalysis.confidenceLevel
            )}{" "}
            Stress
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column: Stress Level & Image */}
          <div className="space-y-6">
            {/* Eye Scan Image */}
            {latestAnalysis.imageUrl && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white/90">
                  Eye Scan Image
                </h3>
                <div
                  className="relative rounded-lg overflow-hidden border border-white/20"
                  style={{ height: "300px" }}
                >
                  <img
                    src={latestAnalysis.imageUrl}
                    alt="Eye scan"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                </div>
                
                {/* --- MODIFICATION: Alert moved here --- */}
                <Alert
                  className={
                    latestAnalysis.hasStress
                      ? "border-red-400/40 bg-red-500/10 text-red-100"
                      : "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                  }
                >
                  <AlertDescription className="text-white/80">
                    {latestAnalysis.hasStress
                      ? "STRESS DETECTED - Consider taking a break and practicing relaxation techniques"
                      : "NO STRESS - Your stress levels appear within a healthy range"}
                  </AlertDescription>
                </Alert>

                <p className="text-xs text-white/60 mt-2">
                  Analysis based on eye scan taken{" "}
                  {formatLongDate(latestAnalysis.createdAt)}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Detailed Metrics */}
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold text-white/90">
              Detailed Analysis
            </h3>

            {/* Metrics */}
            <div className="space-y-6">
              {/* Pupil Dilation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium text-white/90">
                        Pupil Diameter
                      </span>
                      <p className="text-xs text-white/60">
                        Measured size in millimeters
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-white">
                      {latestAnalysis.pupilDilation != null &&
                      latestAnalysis.pupilDilation !== undefined
                        ? `${latestAnalysis.pupilDilation.toFixed(2)} mm`
                        : "N/A"}
                    </span>
                  </div>
                </div>
                {latestAnalysis.pupilDilation != null &&
                  latestAnalysis.pupilDilation !== undefined && (
                    <Progress
                      value={Math.min(
                        (latestAnalysis.pupilDilation / 8) * 100,
                        100
                      )}
                      className="w-full h-2 bg-white/10 [&>div]:bg-primary"
                    />
                  )}
              </div>

              {/* Tension Rings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium text-white/90">
                        Tension Rings
                      </span>
                      <p className="text-xs text-white/60">
                        Stress indicators in iris
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-white">
                      {latestAnalysis.tensionRings != null &&
                      latestAnalysis.tensionRings !== undefined
                        ? latestAnalysis.tensionRings
                        : "N/A"}
                    </span>
                    <div className="text-xs text-white/60">
                      {latestAnalysis.tensionRings != null &&
                      latestAnalysis.tensionRings !== undefined
                        ? `${
                            latestAnalysis.tensionRings >= 2
                              ? "High"
                              : latestAnalysis.tensionRings === 1
                              ? "Moderate"
                              : "Low"
                          } stress`
                        : ""}
                    </div>
                  </div>
                </div>
                {latestAnalysis.tensionRings != null &&
                  latestAnalysis.tensionRings !== undefined && (
                    <Progress
                      value={Math.min(
                        (latestAnalysis.tensionRings / 3) * 100,
                        100
                      )}
                      className="w-full h-2 bg-white/10 [&>div]:bg-primary"
                    />
                  )}
              </div>

              {/* Confidence Level */}
              {latestAnalysis.confidenceLevel != null &&
                latestAnalysis.confidenceLevel !== undefined && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium text-white/90">
                            Analysis Confidence
                          </span>
                          <p className="text-xs text-white/60">
                            AI prediction accuracy
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-semibold text-white">
                          {(latestAnalysis.confidenceLevel * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={latestAnalysis.confidenceLevel * 100}
                      className="w-full h-2 bg-white/10 [&>div]:bg-primary"
                    />
                  </div>
                )}

              {/* Additional Details from Flask */}
              {latestAnalysis.fullDetails && (
                <div className="mt-6 p-4 rounded-xl bg-slate-900/50 border border-white/10">
                  <h4 className="font-medium mb-3 flex items-center gap-2 text-white/90">
                    <AlertCircle className="h-4 w-4" />
                    Additional Insights
                  </h4>
                  <div className="space-y-2 text-sm">
                    {latestAnalysis.fullDetails.subject_info && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Age Group:</span>
                        <span className="font-medium text-white/90">
                          {latestAnalysis.fullDetails.subject_info.age_group}
                        </span>
                      </div>
                    )}
                    {latestAnalysis.fullDetails.pupil_analysis?.status && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Pupil Status:</span>
                        <span className="font-medium text-white/90">
                          {latestAnalysis.fullDetails.pupil_analysis.status}
                        </span>
                      </div>
                    )}
                    {latestAnalysis.fullDetails.iris_analysis
                      ?.interpretation && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Iris Analysis:</span>
                        <span className="font-medium text-white/90">
                          {
                            latestAnalysis.fullDetails.iris_analysis
                              .interpretation
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}