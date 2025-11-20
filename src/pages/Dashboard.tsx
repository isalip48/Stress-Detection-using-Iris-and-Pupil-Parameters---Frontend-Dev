import React, { useState } from "react";
import {
  Camera,
  Upload,
  Eye,
  TrendingUp,
  FileImage,
  Zap,
  Activity,
  Brain,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UserAnalyticsCards } from "@/components/UserAnalyticsCards";
import { UserAnalysisHistory } from "@/components/UserAnalysisHistory";
import { useNavigate } from "react-router-dom"; // <-- 1. Import useNavigate

export function Dashboard() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [prediction, setPrediction] = useState<{
    prediction: string;
    probability: number;
    fullDetails?: any;
  } | null>(null);

  const navigate = useNavigate(); // <-- 2. Initialize useNavigate

  // Helper to determine if image is actually stressed (based on Flask backend logic)
  const isActuallyStressed = (
    pred: { prediction: string; probability: number; fullDetails?: any } | null
  ) => {
    if (!pred || !pred.fullDetails) return false;

    // Use Flask's final stress determination
    const stressDetected = pred.fullDetails.prediction?.stress_detected;
    return stressDetected === true;
  };

  // Transform Flask response to match frontend format
  const transformFlaskResponse = (flaskResponse: any) => {
    const stressDetected = flaskResponse.prediction?.stress_detected || false;
    const stressProbability = flaskResponse.prediction?.stress_probability || 0;

    return {
      prediction: stressDetected ? "stress" : "not_stress",
      probability: stressProbability,
      fullDetails: flaskResponse, // Keep full response for detailed view
    };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
      } else {
        toast.error("Please select a valid image file");
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
    } else {
      toast.error("Please drop a valid image file");
    }
  };

  // Function to upload image to main backend and store it
  const handleImageUpload = async () => {
    if (!selectedFile || !user?.email) {
      toast.error("Please select an image first");
      return;
    }

    setUploading(true);

    try {
      // Create FormData for file upload to main backend
      const formData = new FormData();
      formData.append("username", user.email); // Use email as username
      formData.append("image", selectedFile);

      // Make API call to main backend for storage
      const uploadResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/upload/eye-image`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(
          errorData.error || errorData.message || "Image upload failed"
        );
      }

      const uploadResult = await uploadResponse.json();

      if (uploadResult.status === "success") {
        // Store the upload result temporarily to use it for analysis submission
        localStorage.setItem(
          "latestUploadResult",
          JSON.stringify(uploadResult)
        );

        // After successful upload to main backend, proceed with analysis
        await handleAnalysis();
      } else {
        throw new Error(uploadResult.message || "Image upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Image upload failed. Please try again."
      );
      setUploading(false);
    }
  };

  // Function to submit analysis results to main backend
  const submitAnalysisResults = async (
    uploadResult: any,
    predictionResult: any
  ) => {
    if (!user?.email || !uploadResult || !predictionResult) {
      console.error("Missing data for analysis submission");
      return;
    }

    try {
      // Determine if stress is detected based on prediction and probability
      const hasStress =
        predictionResult.prediction === "stress" &&
        predictionResult.probability > 0.5;

      // Get the image URL from the upload response
      const imageUrl =
        uploadResult.data?.imageUrl || uploadResult.imageUrl || "";

      // Extract pupil diameter and ring count from the full Flask response
      const pupilDiameter = predictionResult.fullDetails?.measurements?.pupil_diameter_mm || 0;
      const ringCount = predictionResult.fullDetails?.measurements?.ring_count || 0;

      // Create the analysis submission payload
      const analysisData = {
        username: user.email,
        hasStress: hasStress,
        imageUrl: imageUrl,
        confidenceLevel: predictionResult.probability,
        pupilDilation: pupilDiameter,
        tensionRings: ringCount,
      };

      // Submit the analysis to the main backend
      const analysisResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/analysis/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(analysisData),
        }
      );

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        console.error("Analysis submission error:", errorData);
        // Don't show this error to user as it's a background operation
      } else {
        const result = await analysisResponse.json();
        console.log("Analysis submitted successfully:", result);
      }
    } catch (error) {
      console.error("Analysis submission error:", error);
      // Don't show this error to user as it's a background operation
    }
  };

  // Function to analyze the image using Flask backend
  const handleAnalysis = async () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }

    setPrediction(null); // Clear previous prediction

    // Store the upload result to use later for analysis submission
    const uploadResultData = JSON.parse(
      localStorage.getItem("latestUploadResult") || "{}"
    );

    try {
      // Create FormData for file upload to Flask backend
      const formData = new FormData();
      formData.append("image", selectedFile);

      // Add user age to the request
      const userAge = user?.age || 30; // Default to 30 if age not available
      formData.append("age", userAge.toString());

      // Make API call to Flask backend for analysis (PORT 5000)
      const response = await fetch(`${import.meta.env.VITE_ML_API_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            "Analysis failed. Please ensure Flask backend is running on port 5000."
        );
      }

      const flaskResult = await response.json();

      // Check if Flask analysis was successful
      if (!flaskResult.success) {
        throw new Error(flaskResult.error || "Flask prediction failed");
      }

      // Transform Flask response to match frontend format
      const transformedResult = transformFlaskResponse(flaskResult);

      // Store prediction result
      setPrediction(transformedResult);

      // Show success message with prediction
      const stressLevel = flaskResult.prediction?.stress_level || "Unknown";
      const stressPercentage = flaskResult.prediction?.stress_percentage || 0;

      if (transformedResult.prediction === "stress") {
        toast.success(
          `Analysis complete! ${stressLevel} detected (${stressPercentage.toFixed(
            1
          )}% confidence)`
        );
      } else {
        toast.success(
          `Analysis complete! ${stressLevel} - You're doing well!`
        );
      }

      // Submit analysis results to main backend
      await submitAnalysisResults(uploadResultData, transformedResult);

      // Clear selected file
      setSelectedFile(null);

      // Clear stored upload result
      localStorage.removeItem("latestUploadResult");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Analysis failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  // Main function to handle upload - this combines both upload and analysis
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select an image first");
      return;
    }

    setUploading(true);
    setPrediction(null); // Clear previous prediction

    try {
      // First upload to main backend for storage
      await handleImageUpload();

      // Analysis is handled within handleImageUpload for proper sequencing
    } catch (error) {
      console.error("Upload process error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Upload process failed. Please try again."
      );
      setUploading(false);
    }
  };

  // --- 3. Update quickActions array ---
  const quickActions = [
    {
      icon: Eye,
      title: "View Latest Results",
      description: "Check your most recent analysis",
      targetTab: "current", // Routes to 'Current' tab
    },
    {
      icon: TrendingUp,
      title: "Analytics Dashboard",
      description: "Explore detailed insights",
      targetTab: "insights", // Routes to 'Insights' tab
    },
    {
      icon: Activity,
      title: "Stress Patterns",
      description: "Understand your trends",
      targetTab: "trends", // Routes to 'Trends' tab
    },
    {
      icon: Brain,
      title: "Wellness Tips",
      description: "Personalized recommendations",
      targetTab: "current", // 'StressRecommendations' is on the 'Current' tab
    },
  ];

  return (
    <div className="min-h-screen pt-24 px-4 pb-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Welcome back,{" "}
                <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
                  {user?.name}
                </span>
                !
              </h1>
              <p className="text-sm md:text-base text-white/60">
                Monitor your stress levels and track your wellness journey with
                precision and clarity.
              </p>
              {user?.age && (
                <p className="text-xs md:text-sm text-white/50">
                  Age: <span className="font-medium">{user.age} years</span>
                </p>
              )}
            </div>
            <Badge
              variant="secondary"
              className="
                px-4 py-2 rounded-full 
                border border-amber-400/40 bg-amber-500/20 text-amber-300 
                shadow-[0_0_18px_rgba(245,158,11,0.35)]
                flex items-center gap-2
              "
            >
              <Zap className="w-4 h-4" />
              Pro Plan
            </Badge>
          </div>
        </div>

        {/* Analytics Cards */}
        <UserAnalyticsCards />

        {/* --- MAIN GRID (Tabs + Sticky Sidebar) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mt-8">
          {/* Main Content Column (Tabs) */}
          <div className="lg:col-span-2 space-y-8">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList
                className="
                  grid w-full grid-cols-2 max-w-md mx-auto 
                  p-1
                  bg-white/5 border border-white/15 rounded-full 
                  backdrop-blur-2xl shadow-[0_14px_35px_rgba(0,0,0,0.45)]
                "
              >
                <TabsTrigger
                  value="upload"
                  className="rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 text-white/70 text-sm md:text-base"
                >
                  Upload &amp; Analyze
                </TabsTrigger>
                <TabsTrigger
                  value="overview"
                  className="rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 text-white/70 text-sm md:text-base"
                >
                  Overview
                </TabsTrigger>
              </TabsList>

              {/* Upload & Analyze Tab Content */}
              <TabsContent value="upload" className="space-y-6 mt-4">
                {/* Upload Card */}
                <Card
                  className="
                    relative group overflow-hidden
                    rounded-2xl border border-white/10
                    bg-gradient-to-br from-white/5 to-white/2
                    backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)]
                    transition-all duration-500
                    hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)]
                    hover:-translate-y-1
                  "
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-primary/10 to-accent/10 transition-all duration-500" />
                  <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center space-x-3 text-2xl">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                      <span className="tracking-tight">Eye Image Analysis</span>
                    </CardTitle>
                    <CardDescription className="text-sm md:text-base text-white/70">
                      Upload a clear, high-quality image of your eye for
                      comprehensive stress level analysis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-6">
                    {/* Dropzone */}
                    <div
                      className={`
                        border-2 border-dashed rounded-2xl p-10 text-center 
                        transition-all duration-300 relative cursor-pointer
                        ${
                          dragActive
                            ? "border-emerald-400 bg-emerald-500/10 scale-[1.01]"
                            : selectedFile
                            ? "border-emerald-300/70 bg-emerald-500/5"
                            : "border-white/20 hover:border-white/40 hover:bg-white/5"
                        }
                      `}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      {selectedFile ? (
                        <div className="space-y-4">
                          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto shadow-[0_18px_45px_rgba(16,185,129,0.65)]">
                            <FileImage className="h-10 w-10 text-white" />
                          </div>
                          <div>
                            <p className="text-lg font-semibold">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs md:text-sm text-white/60">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              • Ready for analysis
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/30 flex items-center justify-center mx-auto">
                            <Upload className="h-10 w-10 text-white" />
                          </div>
                          <div>
                            <p className="text-lg md:text-xl font-semibold">
                              Drop your eye image here
                            </p>
                            <p className="text-xs md:text-sm text-white/60">
                              Or click to select from your device • Supports
                              JPG, PNG
                            </p>
                          </div>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>

                    {/* Hint */}
                    <Alert
                      className="
                        border border-white/15 bg-white/5 backdrop-blur-xl 
                        rounded-2xl text-white
                      "
                    >
                      <Eye className="h-4 w-4" />
                      <AlertDescription className="text-xs md:text-sm text-white/70">
                        For best results, ensure good lighting and focus on the
                        eye area. The image should be clear and well-lit without
                        shadows.
                      </AlertDescription>
                    </Alert>

                    {/* Buttons */}
                    <div className="flex flex-wrap gap-4">
                      <Button
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                        className="
                          flex-1 h-11 md:h-12 text-sm md:text-base font-medium
                          rounded-full bg-gradient-to-r from-green-400 to-emerald-500 
                          text-slate-950 shadow-[0_18px_40px_rgba(34,197,94,0.6)]
                          hover:opacity-90 transition-all
                        "
                      >
                        {uploading ? (
                          <>
                            <Zap className="mr-2 h-4 w-4 animate-pulse" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            Analyze Image
                          </>
                        )}
                      </Button>
                      {selectedFile && (
                        <Button
                          variant="outline"
                          onClick={() => setSelectedFile(null)}
                          className="
                            px-6 rounded-full border-white/30 text-white 
                            hover:bg-white/10 hover:border-white/40
                          "
                        >
                          Clear
                        </Button>
                      )}
                    </div>

                    {/* Fake progress */}
                    {uploading && (
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs text-white/60">
                          <span>Processing image...</span>
                          <span>AI analysis in progress</span>
                        </div>
                        <Progress value={65} className="w-full h-2" />
                        <p className="text-[0.7rem] text-white/50 text-center">
                          Our AI is analyzing pupil dilation, iris tension
                          rings, and age-adjusted stress indicators.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Prediction Results */}
                {prediction && (
                  <Card
                    className={`
                      relative group overflow-hidden mt-2
                      rounded-2xl border 
                      bg-gradient-to-br from-white/5 to-white/2
                      backdrop-blur-xl 
                      transition-all duration-500
                      hover:-translate-y-1
                      ${
                        isActuallyStressed(prediction)
                          ? "border-red-400/40 shadow-[0_12px_40px_rgba(239,68,68,0.4)]"
                          : "border-emerald-300/40 shadow-[0_12px_40px_rgba(16,185,129,0.4)]"
                      }
                    `}
                  >
                    <CardHeader>
                      <CardTitle
                        className={`
                          flex items-center gap-3 text-xl
                          ${
                            isActuallyStressed(prediction)
                              ? "text-red-200"
                              : "text-emerald-200"
                          }
                        `}
                      >
                        <div
                          className={`
                            w-10 h-10 rounded-xl flex items-center justify-center
                            bg-gradient-to-br
                            ${
                              isActuallyStressed(prediction)
                                ? "from-red-500/30 to-red-500/10"
                                : "from-primary/30 to-accent/10"
                            }
                          `}
                        >
                          <Brain className="h-5 w-5" />
                        </div>
                        <span>Analysis Results</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      {/* Main Result Block */}
                      <div
                        className={`
                          p-5 rounded-2xl text-center 
                          border 
                          ${
                            isActuallyStressed(prediction)
                              ? "bg-red-500/10 border-red-400/40"
                              : "bg-emerald-500/10 border-emerald-300/40"
                          }
                        `}
                      >
                        <div
                          className={`
                            text-2xl md:text-3xl font-semibold mb-1
                            ${
                              isActuallyStressed(prediction)
                                ? "text-red-100"
                                : "text-emerald-100"
                            }
                          `}
                        >
                          {isActuallyStressed(prediction)
                            ? "⚠️ STRESS DETECTED"
                            : "✅ NO STRESS"}
                        </div>
                        <div className="text-xs md:text-sm text-white/70">
                          {prediction.fullDetails?.prediction?.stress_level ||
                            "Analysis Complete"}
                        </div>

                        {/* Potential stress warning */}
                        {prediction.fullDetails?.prediction
                          ?.is_potential_stress && (
                          <div className="mt-3 p-2 rounded-xl bg-amber-500/10 border border-amber-300/40 text-xs text-amber-100 text-left">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 mt-0.5" />
                              <div>
                                <div className="font-semibold">
                                  Pupil dilation detected without tension rings
                                </div>
                                <div className="mt-1 text-[0.7rem]">
                                  May indicate early stress – monitor closely
                                  and consider retesting later today.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Subject Info */}
                      {prediction.fullDetails?.subject_info && (
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                          <div className="flex items-center gap-2 mb-3">
                            <Activity className="h-4 w-4 text-primary" />
                            <span className="font-medium text-xs uppercase tracking-wide text-white/65">
                              Subject Information
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <div className="text-white/50">Age</div>
                              <div className="font-semibold text-white">
                                {
                                  prediction.fullDetails.subject_info.age
                                }{" "}
                                years
                              </div>
                            </div>
                            <div>
                              <div className="text-white/50">Age Category</div>
                              <div className="font-semibold text-white">
                                {prediction.fullDetails.subject_info.age_group}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pupil Analysis */}
                      {prediction.fullDetails?.pupil_analysis && (
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium uppercase tracking-wide text-white/65">
                              Pupil Analysis (Dilation Indicator)
                            </span>
                          </div>

                          {/* Image quality notice */}
                          {prediction.fullDetails.prediction
                            ?.needs_better_image && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-300/40 text-xs text-amber-100">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 mt-0.5" />
                                <div>
                                  <div className="font-semibold">
                                    Image Quality Notice
                                  </div>
                                  <div className="mt-1 text-[0.7rem]">
                                    Detected pupil size is very small (
                                    {prediction.fullDetails.pupil_analysis.diameter_mm?.toFixed(
                                      1
                                    )}{" "}
                                    mm). Please upload a clearer image for more
                                    accurate analysis.
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Measured size */}
                          <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/40 border border-white/5 text-xs">
                            <span className="text-white/50">
                              Measured Size
                            </span>
                            <span className="font-semibold text-white">
                              {prediction.fullDetails.pupil_analysis.diameter_mm?.toFixed(
                                2
                              )}{" "}
                              mm
                            </span>
                          </div>

                          {/* Threshold */}
                          <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/40 border border-white/5 text-xs">
                            <span className="text-white/50">
                              {prediction.fullDetails.subject_info?.age < 60
                                ? "Stress Threshold (< 60 years)"
                                : "Stress Threshold (≥ 60 years)"}
                            </span>
                            <span className="font-semibold text-white">
                              {prediction.fullDetails.pupil_analysis.is_dilated
                                ? "> "
                                : "≤ "}
                              {
                                prediction.fullDetails.pupil_analysis
                                  .stress_threshold
                              }{" "}
                              mm
                            </span>
                          </div>

                          {/* Normal range */}
                          <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/40 border border-white/5 text-xs">
                            <span className="text-white/50">
                              Normal Range (
                              {
                                prediction.fullDetails.pupil_analysis
                                  .recommended_range.age_group
                              }
                              )
                            </span>
                            <span className="font-semibold text-white">
                              {
                                prediction.fullDetails.pupil_analysis
                                  .recommended_range.min
                              }{" "}
                              -{" "}
                              {
                                prediction.fullDetails.pupil_analysis
                                  .recommended_range.max
                              }{" "}
                              mm
                            </span>
                          </div>

                          {/* Status */}
                          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs">
                            <div className="text-white/50 mb-1">Status</div>
                            <div
                              className={`font-semibold ${
                                prediction.fullDetails.pupil_analysis.is_dilated
                                  ? "text-orange-200"
                                  : "text-emerald-200"
                              }`}
                            >
                              {prediction.fullDetails.pupil_analysis.status}
                            </div>
                            {prediction.fullDetails.pupil_analysis
                              .is_dilated &&
                              prediction.fullDetails.iris_analysis
                                .tension_rings_count === 0 && (
                                <div className="text-[0.7rem] text-amber-200 mt-1">
                                  ⚠️ Dilation detected but no tension rings –
                                  may indicate early stress.
                                </div>
                              )}
                            {prediction.fullDetails.pupil_analysis
                              .is_dilated &&
                              prediction.fullDetails.iris_analysis
                                .tension_rings_count >= 1 && (
                                <div className="text-[0.7rem] text-red-200 mt-1">
                                  ⚠️ Dilation + tension rings detected – strong
                                  stress indicator.
                                </div>
                              )}
                            {!prediction.fullDetails.pupil_analysis
                              .is_dilated && (
                              <div className="text-[0.7rem] text-emerald-200 mt-1">
                                ✓ Pupil size within normal range for age group.
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Iris Analysis */}
                      {prediction.fullDetails?.iris_analysis && (
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 text-xs">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="font-medium uppercase tracking-wide text-white/65">
                              Iris Analysis (Tension Rings)
                            </span>
                          </div>

                          {/* Ring Count */}
                          <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/40 border border-white/5">
                            <span className="text-white/50">
                              Tension Rings Detected
                            </span>
                            <span className="text-xl font-semibold text-white">
                              {
                                prediction.fullDetails.iris_analysis
                                  .tension_rings_count
                              }
                            </span>
                          </div>

                          {/* Inferred count warning */}
                          {prediction.fullDetails.iris_analysis
                            .ring_count_inferred && (
                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-300/40 text-[0.7rem] text-emerald-100">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 mt-0.5" />
                                <div>
                                  <div className="font-semibold">
                                    AI-Inferred Count
                                  </div>
                                  <div className="mt-1">
                                    Model detected stress patterns (85%+
                                    confidence) that visual detector missed.
                                    Ring count adjusted from{" "}
                                    {
                                      prediction.fullDetails.iris_analysis
                                        .original_ring_count
                                    }{" "}
                                    to{" "}
                                    {
                                      prediction.fullDetails.iris_analysis
                                        .tension_rings_count
                                    }
                                    .
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Interpretation */}
                          <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-[0.7rem]">
                            <div className="text-white/50 mb-1">
                              Interpretation
                            </div>
                            <div className="text-white">
                              {
                                prediction.fullDetails.iris_analysis
                                  .interpretation
                              }
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Recommendation */}
                      <Alert
                        className={`
                          mt-2 rounded-2xl border 
                          ${
                            isActuallyStressed(prediction)
                              ? "border-red-400/40 bg-red-500/10"
                              : "border-emerald-300/40 bg-emerald-500/10"
                          }
                        `}
                      >
                        <Brain className="h-4 w-4" />
                        <AlertDescription className="text-xs md:text-sm text-white/80">
                          {isActuallyStressed(prediction)
                            ? prediction.fullDetails?.pupil_analysis?.is_dilated
                              ? "Pupil dilation and stress indicators detected. Consider taking a break, practicing deep breathing exercises, or doing a brief mindfulness session."
                              : "Stress indicators detected in iris patterns. Consider reducing workload and taking regular breaks to maintain wellness."
                            : "Your stress levels appear within a healthy range. Keep maintaining your current wellness habits and check in regularly."}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Overview / History Tab Content */}
              <TabsContent value="overview" className="space-y-6 mt-4">
                <Card
                  className="
                    relative group overflow-hidden
                    rounded-2xl border border-white/10
                    bg-gradient-to-br from-white/5 to-white/2
                    backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)]
                    transition-all duration-500
                    hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)]
                    hover:-translate-y-1
                  "
                >
                  <CardHeader>
                    <CardTitle className="text-xl md:text-2xl flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Eye className="h-5 w-5 text-primary" />
                      </div>
                      <span>Your Analysis History</span>
                    </CardTitle>
                    <CardDescription className="text-xs md:text-sm text-white/65">
                      View all your previous eye image analyses and stress
                      detection results over time.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UserAnalysisHistory />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* --- Sticky Sidebar Column --- */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 h-fit">
            {/* Quick Actions */}
            <Card
              className="
                relative group overflow-hidden
                rounded-2xl border border-white/10
                bg-gradient-to-br from-white/5 to-white/2
                backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)]
                transition-all duration-500
                hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)]
                hover:-translate-y-1
              "
            >
              <CardHeader>
                <CardTitle className="text-lg md:text-xl text-white/90">
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-white/60">
                  Access your most used features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* --- 4. Update Button onClick --- */}
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="
                      w-full justify-start h-auto p-3.5 rounded-2xl
                      hover:bg-white/10 hover:scale-[1.01]
                      transition-all text-left
                    "
                    onClick={() =>
                      navigate("/results", {
                        state: { defaultTab: action.targetTab },
                      })
                    }
                  >
                    <action.icon className="mr-3 h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium text-sm text-white/90">
                        {action.title}
                      </div>
                      <div className="text-[0.7rem] text-white/55">
                        {action.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Today's Insight */}
            <Card
              className="
                relative group overflow-hidden
                rounded-2xl border border-white/10
                bg-gradient-to-br from-white/5 to-white/2
                backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)]
                transition-all duration-500
                hover:shadow-[0_12px_40px_rgb(0,0,0,0.25)]
                hover:-translate-y-1
              "
            >
              <CardHeader>
                <CardTitle className="text-lg md:text-xl flex items-center gap-3 text-white/90">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <span>Today&apos;s Insight</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-white/80 leading-relaxed text-xs md:text-sm">
                  Your stress levels tend to peak around{" "}
                  <span className="font-semibold text-emerald-200">
                    2–3 PM
                  </span>
                  . Consider taking a 5-minute mindfulness break during this
                  window to help maintain optimal wellness and cognitive
                  performance.
                </p>
                <Badge
                  variant="secondary"
                  className="
                    text-[0.7rem] rounded-full bg-white/10 text-white border border-white/20
                  "
                >
                  Personalized Tip
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}