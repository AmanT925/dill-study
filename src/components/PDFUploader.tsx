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
    <div className="w-full max-w-5xl mx-auto space-y-8 relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-gradient-primary opacity-20 rounded-full blur-3xl floating-animation"></div>
        <div className="absolute top-32 right-16 w-96 h-96 bg-gradient-secondary opacity-15 rounded-full blur-3xl floating-animation" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 left-32 w-64 h-64 bg-gradient-accent opacity-25 rounded-full blur-3xl floating-animation" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="text-center space-y-6 relative z-10">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold gradient-text leading-tight">
            AI Problem Solver
          </h1>
          <div className="w-24 h-1 bg-gradient-primary mx-auto rounded-full"></div>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Upload your homework PDF and get personalized, step-by-step guidance without spoilers. 
          Experience the future of learning with AI-powered assistance.
        </p>
      </div>

      <Card
        {...getRootProps()}
        className={`
          glass-card relative overflow-hidden border-2 border-dashed transition-all duration-500 cursor-pointer hover-glow
          ${isDragActive 
            ? 'border-neon-purple bg-gradient-glow scale-105 neon-glow' 
            : 'border-white/20 hover:border-neon-purple/60'
          }
          ${isUploading ? 'pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {/* Animated border effect */}
        <div className="absolute inset-0 rounded-lg bg-gradient-primary opacity-0 transition-opacity duration-300" 
             style={{ 
               backgroundSize: '200% 200%',
               animation: isDragActive ? 'gradient-shift 2s ease infinite' : 'none'
             }}>
        </div>
        
        <div className="relative z-10 p-16 text-center space-y-8">
          {isUploading ? (
            <div className="space-y-6">
              <div className="relative">
                <div className="w-24 h-24 mx-auto bg-gradient-primary rounded-full flex items-center justify-center pulse-glow">
                  <Upload className="w-12 h-12 text-white animate-pulse" />
                </div>
                <div className="absolute inset-0 w-24 h-24 mx-auto border-4 border-neon-purple border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Processing your PDF...</h3>
                <p className="text-muted-foreground">Our AI is analyzing your document with precision</p>
                <div className="w-64 h-2 bg-muted/30 rounded-full mx-auto overflow-hidden">
                  <div className="h-full bg-gradient-primary rounded-full animate-pulse" style={{ width: '70%' }}></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative">
                <div className="w-24 h-24 mx-auto bg-gradient-card rounded-full flex items-center justify-center hover-glow">
                  <FileText className="w-12 h-12 text-neon-purple" />
                </div>
                <div className="absolute -inset-2 w-28 h-28 mx-auto border border-neon-purple/30 rounded-full animate-ping"></div>
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-foreground">
                  {isDragActive ? '✨ Drop your PDF here' : '📁 Drag & drop your PDF here'}
                </h3>
                <p className="text-lg text-muted-foreground">
                  or click to select a file • Max 20MB • PDF format
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground/80">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                  <span>Supports: Mathematical equations, diagrams, text</span>
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {isDragActive && (
          <div className="absolute inset-0 bg-gradient-glow border-2 border-neon-purple border-dashed rounded-lg animate-pulse" />
        )}
      </Card>

      <div className="flex flex-col sm:flex-row gap-6 items-center justify-center relative z-10">
        <Button variant="outline" disabled={isUploading} className="glass-card hover-glow border-white/20 hover:border-neon-cyan/60 group">
          <Upload className="w-4 h-4 mr-2 group-hover:text-neon-cyan transition-colors" />
          Import from Google Drive
        </Button>
        <Button variant="outline" disabled={isUploading} className="glass-card hover-glow border-white/20 hover:border-neon-pink/60 group">
          <FileText className="w-4 h-4 mr-2 group-hover:text-neon-pink transition-colors" />
          Import from URL
        </Button>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-3 relative z-10">
        <div className="flex items-start gap-4">
          <div className="w-6 h-6 bg-gradient-accent rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-white" />
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground flex items-center gap-2">
              🔒 Privacy & Data Policy
              <span className="px-2 py-1 bg-secondary/20 text-secondary rounded-full text-xs">Secure</span>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Your PDFs are processed with enterprise-grade security. Audio recordings are optional and can be disabled in settings. 
              All data is encrypted and never shared with third parties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};