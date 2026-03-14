import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface Prediction {
  id: number;
  opportunityId: string;
  predictionText: string;
  methodologyNotes: string | null;
  draftedAt: string;
  draftScore: number;
  draftSignalCount: number;
  publishedAt: string | null;
  isPublished: boolean;
  status: string;
  verifiedAt: string | null;
  verificationEvidence: string | null;
  verificationUrl: string | null;
  leadTimeDays: number | null;
  opportunity: any;
}

interface Stats {
  total: number;
  drafts: number;
  pending: number;
  confirmed: number;
  failed: number;
}

export default function Predictions() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [adminKey, setAdminKey] = useState("");
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [verificationForm, setVerificationForm] = useState({
    status: "confirmed",
    evidence: "",
    url: "",
  });

  const fetchPredictions = async () => {
    try {
      const params = new URLSearchParams();
      if (filter === "published") {
        params.set("isPublished", "true");
      } else if (filter === "draft" && adminKey) {
        params.set("includeDrafts", "true");
        params.set("status", "draft");
      } else if (filter !== "all") {
        params.set("status", filter);
      }

      const headers: Record<string, string> = {};
      if (adminKey) {
        headers["X-Admin-Key"] = adminKey;
      }

      const response = await fetch(`/api/predictions?${params}`, { headers });
      const data = await response.json();
      setPredictions(data);
    } catch (error) {
      console.error("Failed to fetch predictions:", error);
    }
  };

  const fetchStats = async () => {
    if (!adminKey) return;

    try {
      const response = await fetch("/api/predictions/stats", {
        headers: { "X-Admin-Key": adminKey },
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPredictions();
      if (adminKey) {
        await fetchStats();
      }
      setLoading(false);
    };

    loadData();
  }, [filter, adminKey]);

  const handleDraft = async () => {
    if (!adminKey) {
      alert("Admin key required");
      return;
    }

    try {
      const response = await fetch("/api/predictions/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      alert(result.message);
      fetchPredictions();
      fetchStats();
    } catch (error) {
      console.error("Failed to draft predictions:", error);
      alert("Failed to draft predictions");
    }
  };

  const handlePromote = async () => {
    if (!adminKey) {
      alert("Admin key required");
      return;
    }

    try {
      const response = await fetch("/api/predictions/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      alert(result.message);
      fetchPredictions();
      fetchStats();
    } catch (error) {
      console.error("Failed to promote predictions:", error);
      alert("Failed to promote predictions");
    }
  };

  const handleVerify = async () => {
    if (!adminKey || !selectedPrediction) {
      alert("Admin key and prediction selection required");
      return;
    }

    try {
      const response = await fetch(
        `/api/predictions/${selectedPrediction.id}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminKey,
          },
          body: JSON.stringify({
            status: verificationForm.status,
            verificationEvidence: verificationForm.evidence,
            verificationUrl: verificationForm.url,
          }),
        }
      );

      const result = await response.json();
      alert(result.message);
      setSelectedPrediction(null);
      fetchPredictions();
      fetchStats();
    } catch (error) {
      console.error("Failed to verify prediction:", error);
      alert("Failed to verify prediction");
    }
  };

  const handlePublish = async (predictionId: number) => {
    if (!adminKey) {
      alert("Admin key required");
      return;
    }

    try {
      const response = await fetch(`/api/predictions/${predictionId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
      });

      const result = await response.json();
      alert(result.message);
      fetchPredictions();
      fetchStats();
    } catch (error) {
      console.error("Failed to publish prediction:", error);
      alert("Failed to publish prediction");
    }
  };

  const handleDiscard = async (predictionId: number) => {
    if (!adminKey) {
      alert("Admin key required");
      return;
    }

    if (!confirm("Are you sure you want to discard this prediction?")) {
      return;
    }

    try {
      const response = await fetch(`/api/predictions/${predictionId}/discard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
      });

      const result = await response.json();
      alert(result.message);
      fetchPredictions();
      fetchStats();
    } catch (error) {
      console.error("Failed to discard prediction:", error);
      alert("Failed to discard prediction");
    }
  };

  const getTimeUntilAutoPublish = (draftedAt: string): string => {
    const drafted = new Date(draftedAt);
    const autoPublishTime = new Date(drafted.getTime() + 72 * 60 * 60 * 1000);
    const now = new Date();
    const hoursLeft = Math.max(
      0,
      Math.floor((autoPublishTime.getTime() - now.getTime()) / (1000 * 60 * 60))
    );
    return `${hoursLeft}h remaining`;
  };

  const getStatusBadge = (prediction: Prediction) => {
    if (prediction.status === "confirmed") {
      return <Badge className="bg-green-600">Confirmed</Badge>;
    }
    if (prediction.status === "failed") {
      return <Badge className="bg-red-600">Failed</Badge>;
    }
    if (prediction.status === "partially_confirmed") {
      return <Badge className="bg-yellow-600">Partial</Badge>;
    }
    if (prediction.status === "pending" && prediction.isPublished) {
      return <Badge className="bg-blue-600">Published</Badge>;
    }
    return <Badge className="bg-gray-600">Draft</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading predictions...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Prediction Registry</h1>
        <p className="text-gray-600">
          3-stage automated prediction lifecycle: Draft → Publish → Verify
        </p>
      </div>

      <div className="mb-6">
        <Input
          type="password"
          placeholder="Enter admin key for management features"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="max-w-md"
        />
      </div>

      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.drafts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Published</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Confirmed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.confirmed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.failed}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {adminKey && (
        <div className="flex gap-4 mb-6">
          <Button onClick={handleDraft}>Run Stage 1: Auto-Draft</Button>
          <Button onClick={handlePromote} variant="secondary">
            Run Stage 2: Auto-Promote
          </Button>
        </div>
      )}

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="pending">Pending Verification</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          <div className="space-y-4">
            {predictions.map((pred) => (
              <Card key={pred.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(pred)}
                        <span className="text-sm text-gray-500">
                          Score: {pred.draftScore} | Signals:{" "}
                          {pred.draftSignalCount}
                        </span>
                        {pred.status === "draft" && !pred.isPublished && (
                          <span className="text-sm text-orange-600 font-medium">
                            {getTimeUntilAutoPublish(pred.draftedAt)}
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-lg">
                        {pred.predictionText}
                      </CardTitle>
                      {pred.opportunity && (
                        <p className="text-sm text-gray-600 mt-1">
                          {pred.opportunity.title}
                        </p>
                      )}
                    </div>
                    {adminKey && (
                      <div className="flex gap-2">
                        {pred.status === "draft" && !pred.isPublished && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handlePublish(pred.id)}
                            >
                              Publish Now
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDiscard(pred.id)}
                            >
                              Discard
                            </Button>
                          </>
                        )}
                        {pred.isPublished && !pred.verifiedAt && (
                          <Button
                            size="sm"
                            onClick={() => setSelectedPrediction(pred)}
                          >
                            Verify
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Drafted:</span>{" "}
                      {new Date(pred.draftedAt).toLocaleDateString()}
                    </div>
                    {pred.publishedAt && (
                      <div>
                        <span className="font-medium">Published:</span>{" "}
                        {new Date(pred.publishedAt).toLocaleDateString()}
                      </div>
                    )}
                    {pred.verifiedAt && (
                      <>
                        <div>
                          <span className="font-medium">Verified:</span>{" "}
                          {new Date(pred.verifiedAt).toLocaleDateString()}
                        </div>
                        {pred.leadTimeDays !== null && (
                          <div>
                            <span className="font-medium">Lead Time:</span>{" "}
                            {pred.leadTimeDays} days
                          </div>
                        )}
                        {pred.verificationEvidence && (
                          <div>
                            <span className="font-medium">Evidence:</span>{" "}
                            {pred.verificationEvidence}
                          </div>
                        )}
                        {pred.verificationUrl && (
                          <div>
                            <a
                              href={pred.verificationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              View Evidence
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {predictions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No predictions found
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {selectedPrediction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Verify Prediction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="font-medium mb-2">
                    {selectedPrediction.predictionText}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <select
                    value={verificationForm.status}
                    onChange={(e) =>
                      setVerificationForm({
                        ...verificationForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full border rounded p-2"
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="partially_confirmed">
                      Partially Confirmed
                    </option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Evidence
                  </label>
                  <Textarea
                    value={verificationForm.evidence}
                    onChange={(e) =>
                      setVerificationForm({
                        ...verificationForm,
                        evidence: e.target.value,
                      })
                    }
                    placeholder="Describe what happened..."
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Evidence URL
                  </label>
                  <Input
                    type="url"
                    value={verificationForm.url}
                    onChange={(e) =>
                      setVerificationForm({
                        ...verificationForm,
                        url: e.target.value,
                      })
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedPrediction(null)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleVerify}>Submit Verification</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
