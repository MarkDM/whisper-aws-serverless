import { useState, useRef, useEffect } from 'react'
import { Upload as UploadIcon, ChevronDown, ChevronUp } from 'lucide-react'

interface UploadStatus {
  fileName: string
  status: 'pending' | 'uploading' | 'success' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
  transcript?: string
  isExpanded?: boolean
  audioUrl?: string
}

function S3WavUploader() {
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/events`)

    eventSource.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      console.log('SSE message received:', data)

      // Parse the message body if it's a string
      let messageData = data;
      if (typeof data === 'string') {
        try {
          messageData = JSON.parse(data);
        } catch (e) {
          console.error('Failed to parse message data:', e);
          return;
        }
      }

      const { filename, status, transcript } = messageData;

      if (status === 'Transcription started') {
        // Update status to processing when transcription starts
        setUploadStatuses(prev =>
          prev.map(item => {
            const itemName = item.fileName.split('.')[0];
            const msgName = filename.split('/').pop().split('.')[0];
            return itemName === msgName || item.fileName === filename
              ? { ...item, status: 'processing' }
              : item;
          })
        );
      } else if (status === 'Transcription completed' && transcript) {
        // Update status to completed and add transcript
        setUploadStatuses(prev =>
          prev.map(item => {
            const itemName = item.fileName.split('.')[0];
            return itemName === filename || item.fileName === filename
              ? { ...item, status: 'completed', transcript, isExpanded: false }
              : item;
          })
        );
      }
    }

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error)
      eventSource.close()
    }
    return () => {
      eventSource.close()
    }
  }, [])


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
      audioUrl: URL.createObjectURL(file),
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
    setUploadStatuses(prev => {
      // Revoke object URLs for items being removed
      prev.forEach(status => {
        if (status.status !== 'uploading' && status.status !== 'pending' && status.status !== 'processing' && status.audioUrl) {
          URL.revokeObjectURL(status.audioUrl)
        }
      })
      return prev.filter(status => status.status === 'uploading' || status.status === 'pending' || status.status === 'processing')
    })
  }

  const toggleExpand = (fileName: string) => {
    setUploadStatuses(prev =>
      prev.map(item =>
        item.fileName === fileName
          ? { ...item, isExpanded: !item.isExpanded }
          : item
      )
    );
  };

  const getStatusStyles = (status: UploadStatus['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-muted text-muted-foreground'
      case 'uploading':
        return 'bg-primary/10 text-primary'
      case 'success':
        return 'bg-green-500/10 text-green-600 dark:text-green-400'
      case 'processing':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      case 'completed':
        return 'bg-green-500/10 text-green-600 dark:text-green-400'
      case 'error':
        return 'bg-destructive/10 text-destructive'
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-4xl font-bold text-center mb-8 text-foreground">
        Whisper audio transcription
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
                <span className="font-medium text-card-foreground wrap-break-word flex-1">
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
                <div className="mt-2">
                  <p className="text-green-600 dark:text-green-400 text-sm mb-2">✓ Upload complete</p>
                  {upload.audioUrl && (
                    <audio controls className="w-full mt-2" preload="metadata">
                      <source src={upload.audioUrl} type="audio/wav" />
                      Your browser does not support the audio element.
                    </audio>
                  )}
                </div>
              )}

              {upload.status === 'processing' && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-blue-600 dark:text-blue-400 text-sm">Processing transcription...</p>
                </div>
              )}

              {upload.status === 'completed' && upload.transcript && (
                <div className="mt-3">
                  {upload.audioUrl && (
                    <audio controls className="w-full mb-3" preload="metadata">
                      <source src={upload.audioUrl} type="audio/wav" />
                      Your browser does not support the audio element.
                    </audio>
                  )}
                  <div className="border border-border rounded-md overflow-hidden">
                    <button
                      onClick={() => toggleExpand(upload.fileName)}
                      className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-medium text-foreground">Transcription</span>
                      {upload.isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    {upload.isExpanded && (
                      <div className="p-4 bg-card">
                        <p className="text-sm text-card-foreground whitespace-pre-wrap leading-relaxed">
                          {upload.transcript}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default S3WavUploader
