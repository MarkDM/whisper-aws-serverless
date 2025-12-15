import { useState, useRef } from 'react'
import { Upload as UploadIcon } from 'lucide-react'

interface UploadStatus {
  fileName: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

function S3WavUploader() {
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return

    const wavFiles = Array.from(files).filter(file => 
      file.name.toLowerCase().endsWith('.wav')
    )

    if (wavFiles.length === 0) {
      alert('Please select .wav files only')
      return
    }

    const newStatuses: UploadStatus[] = wavFiles.map(file => ({
      fileName: file.name,
      status: 'pending',
      progress: 0,
    }))

    setUploadStatuses(prev => [...prev, ...newStatuses])
    wavFiles.forEach(file => uploadFile(file))
  }

  const uploadFile = async (file: File) => {
    setUploadStatuses(prev =>
      prev.map(status =>
        status.fileName === file.name
          ? { ...status, status: 'uploading' }
          : status
      )
    )

    try {
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100)
          setUploadStatuses(prev =>
            prev.map(status =>
              status.fileName === file.name
                ? { ...status, progress: percentage }
                : status
            )
          )
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          setUploadStatuses(prev =>
            prev.map(status =>
              status.fileName === file.name
                ? { ...status, status: 'success', progress: 100 }
                : status
            )
          )
        } else {
          const errorData = JSON.parse(xhr.responseText)
          setUploadStatuses(prev =>
            prev.map(status =>
              status.fileName === file.name
                ? { 
                    ...status, 
                    status: 'error', 
                    error: errorData.error || 'Upload failed' 
                  }
                : status
            )
          )
        }
      })

      xhr.addEventListener('error', () => {
        setUploadStatuses(prev =>
          prev.map(status =>
            status.fileName === file.name
              ? { 
                  ...status, 
                  status: 'error', 
                  error: 'Network error occurred' 
                }
              : status
          )
        )
      })

      xhr.open('POST', `${API_URL}/upload`)
      xhr.send(formData)
    } catch (error) {
      setUploadStatuses(prev =>
        prev.map(status =>
          status.fileName === file.name
            ? { 
                ...status, 
                status: 'error', 
                error: error instanceof Error ? error.message : 'Upload failed' 
              }
            : status
        )
      )
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const clearCompleted = () => {
    setUploadStatuses(prev => 
      prev.filter(status => status.status === 'uploading' || status.status === 'pending')
    )
  }

  const getStatusStyles = (status: UploadStatus['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-muted text-muted-foreground'
      case 'uploading':
        return 'bg-primary/10 text-primary'
      case 'success':
        return 'bg-green-500/10 text-green-600 dark:text-green-400'
      case 'error':
        return 'bg-destructive/10 text-destructive'
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-4xl font-bold text-center mb-8 text-foreground">
        Upload .WAV Files to S3
      </h1>
      
      <div
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-all duration-300 ease-in-out
          ${isDragging 
            ? 'border-primary bg-primary/5 scale-105' 
            : 'border-border bg-muted/50 hover:border-primary hover:bg-primary/5'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,audio/wav"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-4">
          <UploadIcon className="w-16 h-16 text-primary" />
          <p className="text-lg text-foreground font-medium">
            Drag & drop .wav files here or click to browse
          </p>
          <p className="text-sm text-muted-foreground">
            Multiple files supported
          </p>
        </div>
      </div>

      {uploadStatuses.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-foreground">Upload Status</h2>
            <button 
              onClick={clearCompleted}
              className="px-4 py-2 border border-border rounded-md bg-card text-muted-foreground 
                       hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium"
            >
              Clear Completed
            </button>
          </div>
          
          {uploadStatuses.map((upload, index) => (
            <div 
              key={`${upload.fileName}-${index}`} 
              className="border border-border rounded-lg p-4 mb-3 bg-card shadow-sm"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-card-foreground break-words flex-1">
                  {upload.fileName}
                </span>
                <span 
                  className={`
                    px-3 py-1 rounded-full text-xs font-semibold uppercase ml-4
                    ${getStatusStyles(upload.status)}
                  `}
                >
                  {upload.status}
                </span>
              </div>
              
              {upload.status === 'uploading' && (
                <div className="relative w-full h-6 bg-muted rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full gradient rounded-full transition-all duration-300"
                    style={{ width: `${upload.progress}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
                    {upload.progress}%
                  </span>
                </div>
              )}
              
              {upload.status === 'error' && (
                <p className="text-destructive text-sm mt-2">{upload.error}</p>
              )}
              
              {upload.status === 'success' && (
                <p className="text-green-600 dark:text-green-400 text-sm mt-2">✓ Upload complete</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default S3WavUploader
