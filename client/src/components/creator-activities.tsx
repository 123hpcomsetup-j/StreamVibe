import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Zap,
  Coins,
  Save,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Activity {
  id: string;
  name: string;
  tokenCost: number;
  createdAt: string;
}

export default function CreatorActivities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityData, setActivityData] = useState({
    name: "",
    tokenCost: "",
  });

  // Fetch activities
  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/creator/activities"],
  });

  // Create activity mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; tokenCost: number }) => {
      return await apiRequest("POST", "/api/creator/activities", data);
    },
    onSuccess: () => {
      setActivityData({ name: "", tokenCost: "" });
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/creator/activities"] });
      toast({
        title: "Activity Created!",
        description: "Your new activity is now available for viewers to use",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update activity mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; tokenCost: number } }) => {
      return await apiRequest("PATCH", `/api/creator/activities/${id}`, data);
    },
    onSuccess: () => {
      setActivityData({ name: "", tokenCost: "" });
      setEditingActivity(null);
      queryClient.invalidateQueries({ queryKey: ["/api/creator/activities"] });
      toast({
        title: "Activity Updated!",
        description: "Your activity has been successfully updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete activity mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/creator/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/creator/activities"] });
      toast({
        title: "Activity Deleted",
        description: "The activity has been removed from your stream",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activityData.name || !activityData.tokenCost) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const tokenCost = parseInt(activityData.tokenCost);
    if (tokenCost <= 0) {
      toast({
        title: "Invalid Token Cost",
        description: "Token cost must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      name: activityData.name,
      tokenCost,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingActivity || !activityData.name || !activityData.tokenCost) {
      return;
    }

    const tokenCost = parseInt(activityData.tokenCost);
    if (tokenCost <= 0) {
      toast({
        title: "Invalid Token Cost",
        description: "Token cost must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      id: editingActivity.id,
      data: {
        name: activityData.name,
        tokenCost,
      },
    });
  };

  const startEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityData({
      name: activity.name,
      tokenCost: activity.tokenCost.toString(),
    });
  };

  const cancelEdit = () => {
    setEditingActivity(null);
    setActivityData({ name: "", tokenCost: "" });
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading activities...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center">
            <Zap className="mr-2 h-5 w-5 text-blue-500" />
            Stream Activities
          </div>
          <Badge variant="secondary" className="text-slate-300">
            {activities.length}/10
          </Badge>
        </CardTitle>
        <p className="text-slate-400 text-sm">
          Create interactive activities that viewers can purchase with tokens
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Create New Activity Button */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={activities.length >= 10}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Activity</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label className="text-slate-300">Activity Name</Label>
                <Input
                  value={activityData.name}
                  onChange={(e) => setActivityData({ ...activityData, name: e.target.value })}
                  placeholder="e.g., Song Request, Shoutout, Dance"
                  className="bg-slate-800 border-slate-600 text-white"
                  maxLength={50}
                  required
                />
              </div>
              
              <div>
                <Label className="text-slate-300">Token Cost</Label>
                <Input
                  type="number"
                  value={activityData.tokenCost}
                  onChange={(e) => setActivityData({ ...activityData, tokenCost: e.target.value })}
                  placeholder="e.g., 10"
                  className="bg-slate-800 border-slate-600 text-white"
                  min="1"
                  max="1000"
                  required
                />
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {createMutation.isPending ? (
                    "Creating..."
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Activity
                    </>
                  )}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Activities List */}
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-slate-900 p-4 rounded-lg border border-slate-700"
              >
                {editingActivity?.id === activity.id ? (
                  // Edit Mode
                  <form onSubmit={handleUpdate} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        value={activityData.name}
                        onChange={(e) => setActivityData({ ...activityData, name: e.target.value })}
                        className="bg-slate-800 border-slate-600 text-white"
                        maxLength={50}
                        required
                      />
                      <Input
                        type="number"
                        value={activityData.tokenCost}
                        onChange={(e) => setActivityData({ ...activityData, tokenCost: e.target.value })}
                        className="bg-slate-800 border-slate-600 text-white"
                        min="1"
                        max="1000"
                        required
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        type="submit"
                        size="sm" 
                        disabled={updateMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="mr-1 h-3 w-3" />
                        Save
                      </Button>
                      <Button 
                        type="button"
                        size="sm" 
                        variant="outline"
                        onClick={cancelEdit}
                        className="border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        <X className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  // Display Mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-full">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{activity.name}</h4>
                        <p className="text-slate-400 text-sm">
                          Created {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge className="bg-yellow-600 text-white">
                        <Coins className="mr-1 h-3 w-3" />
                        {activity.tokenCost}
                      </Badge>
                      
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(activity)}
                          className="border-slate-600 text-slate-300 hover:bg-slate-800"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteMutation.mutate(activity.id)}
                          disabled={deleteMutation.isPending}
                          className="border-red-600 text-red-400 hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Zap className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No activities created yet</p>
            <p className="text-slate-500 text-sm">
              Create interactive activities for viewers to engage with your stream
            </p>
          </div>
        )}

        {/* Activity Limit Notice */}
        {activities.length >= 10 && (
          <div className="bg-yellow-900/20 border border-yellow-500/50 p-3 rounded-lg">
            <p className="text-yellow-300 text-sm text-center">
              You've reached the maximum limit of 10 activities. Delete some to create new ones.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}