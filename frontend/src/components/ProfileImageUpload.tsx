import React, { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Upload, X, Check, Loader2 } from "lucide-react";
import { techniciansApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ProfileImageUploadProps {
  technicianId: string;
  currentImage?: string;
  onClose: () => void;
  onUploaded: (imageData: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const ProfileImageUpload: React.FC<ProfileImageUploadProps> = ({
  technicianId,
  currentImage,
  onClose,
  onUploaded,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Please select a valid image file (JPEG, PNG, GIF, or WebP)";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Image size must be less than 5MB";
    }
    return null;
  };

  const processFile = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      toast({
        title: "Invalid File",
        description: error,
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
    };
    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to read file",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
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
    if (file) {
      processFile(file);
    }
  };

  const handleUpload = async () => {
    if (!preview) return;

    try {
      setUploading(true);
      await techniciansApi.uploadImage(technicianId, preview);
      onUploaded(preview);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
    }
  };

  const handleGallerySelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute("capture");
      fileInputRef.current.click();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Profile Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Preview */}
          <div className="flex justify-center">
            <Avatar className="w-32 h-32 border-4 border-accent/20">
              {preview ? (
                <AvatarImage src={preview} alt="Preview" />
              ) : null}
              <AvatarFallback className="text-3xl bg-muted">
                <Camera className="w-10 h-10 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? "border-accent bg-accent/5"
                : "border-border hover:border-accent/50"
            }`}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop an image here, or
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGallerySelect}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCameraCapture}
                className="sm:hidden"
              >
                <Camera className="w-4 h-4 mr-2" />
                Take Photo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              JPEG, PNG, GIF, or WebP. Max 5MB.
            </p>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!preview || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Photo
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileImageUpload;
