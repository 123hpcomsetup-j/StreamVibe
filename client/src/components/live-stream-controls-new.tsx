import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface LiveStreamControlsProps {
  streamId?: string;
  onStreamStart?: (streamId: string) => void;
  onStreamStop?: () => void;
}

export default function LiveStreamControls({ streamId, onStreamStart, onStreamStop }: LiveStreamControlsProps) {
  const { toast } = useToast();

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
          Legacy WebRTC Component Disabled
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-slate-400 space-y-4">
          <p>
            This component has been replaced by Agora.io streaming for better performance and reliability.
          </p>
          <p>
            For live streaming, please use the AgoraStreamCreator component instead.
          </p>
          <Button 
            onClick={() => toast({ title: "Component Disabled", description: "Please use AgoraStreamCreator for live streaming." })}
            variant="outline"
            className="w-full"
          >
            Use Agora Components Instead
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}