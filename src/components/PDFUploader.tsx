import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface PDFUploaderProps {
  onFileUpload: (file: File) => void;
  isUploading?: boolean;
}

export const PDFUploader: React.FC<PDFUploaderProps> = ({ 
  onFileUpload, 
  isUploading = false 
}) => {
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file only.",
        variant: "destructive",
      });
      return;
    }

    const file = acceptedFiles[0];
    if (file && file.size > 20 * 1024 * 1024) { // 20MB limit
      toast({
        title: "File too large",
        description: "Please upload a PDF smaller than 20MB.",
        variant: "destructive",
      });
      return;
    }

    if (file) {
      onFileUpload(file);
    }
  }, [onFileUpload, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: isUploading
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-40 h-40 sm:w-52 sm:h-52">
          <img src="/ui/logo.png" alt="logo" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold italic text-foreground transform -skew-x-2">
          <span className="bg-gradient-primary bg-clip-text text-transparent">For when you're</span>
          <br />
          <span className="bg-gradient-secondary bg-clip-text text-transparent">in a pickle</span>
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto mt-1">
          Upload homework to reveal hints, get step-by-step solutions, and chat with an AI tutor
        </p>
      </div>

      <Card
        {...getRootProps()}
        className={`
          relative overflow-hidden border-2 border-dashed transition-all duration-300 cursor-pointer
          ${isDragActive 
            ? 'border-primary bg-primary/5 scale-105' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="p-12 text-center space-y-6">
          {isUploading ? (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Processing your PDF...</h3>
                <p className="text-muted-foreground">This may take a few moments</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {isDragActive ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
                </h3>
                <p className="text-muted-foreground">
                  or click to select a file • Max 20MB
                </p>
              </div>
            </div>
          )}
        </div>

        {isDragActive && (
          <div className="absolute inset-0 bg-primary/5 border-2 border-primary border-dashed rounded-lg" />
        )}
      </Card>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
        <Button variant="outline" disabled={isUploading} className="uploader-btn">
          <Upload className="w-4 h-4 mr-2" />
          Import from Google Drive
        </Button>
        <Button variant="outline" disabled={isUploading} className="uploader-btn">
          <FileText className="w-4 h-4 mr-2" />
          Import from URL
        </Button>
      </div>
    </div>
  );
};