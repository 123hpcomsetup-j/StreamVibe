import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamKey: string;
}

export default function StreamModal({ isOpen, onClose, streamKey }: StreamModalProps) {
  const { toast } = useToast();

  const rtmpUrl = `rtmp://${window.location.hostname}:1935/live`;
  const fullStreamUrl = `${rtmpUrl}/${streamKey}`;
  const playbackUrl = `http://${window.location.hostname}:8000/live/${streamKey}.flv`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stream Configuration</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Use these settings in OBS Studio or your streaming software
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">RTMP Server URL</label>
            <div className="flex items-center space-x-2">
              <input
                className="flex-1 px-3 py-2 text-sm bg-secondary rounded-md"
                value={rtmpUrl}
                readOnly
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(rtmpUrl, "Server URL")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Stream Key</label>
            <div className="flex items-center space-x-2">
              <input
                className="flex-1 px-3 py-2 text-sm bg-secondary rounded-md"
                value={streamKey}
                readOnly
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(streamKey, "Stream key")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Start streaming in OBS, then viewers can watch at:
            </p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 px-3 py-2 text-sm bg-secondary rounded-md">
                {playbackUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(playbackUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}