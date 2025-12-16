# Whisper AWS Serverless Audio Transcription

A full-stack serverless audio transcription system using OpenAI's Whisper model, deployed on AWS infrastructure. Upload WAV files and get real-time transcription updates through a modern web interface.


**Workflow:**
1. User uploads WAV file through React web app
2. Node.js backend uploads file to S3 bucket (`unprocessed/` folder)
3. S3 triggers Lambda function automatically
4. Lambda downloads audio, processes it with Whisper model
5. Lambda sends status updates to SQS queue
6. Node backend polls SQS and broadcasts updates via Server-Sent Events (SSE)
7. Frontend displays real-time transcription status and results

## Components

### Web App (`web-app/`)
- **Tech Stack**: React, TypeScript, Vite, TailwindCSS
- **Features**:
  - Drag-and-drop WAV file upload
  - Real-time progress tracking
  - SSE-based live updates
  - Audio playback and transcript display
  - Dark mode support

### Node Backend (`node_backend/`)
- **Tech Stack**: Node.js, Express
- **Responsibilities**:
  - Handle file uploads to S3
  - Poll SQS for transcription updates
  - Broadcast SSE events to connected clients
  - CORS management for frontend

### Whisper Lambda (`whisper-lambda/`)
- **Tech Stack**: Python, [whisper.cpp](https://github.com/ggml-org/whisper.cpp), Docker
- **Features**:
  - Runs in AWS Lambda container
  - Uses whisper.cpp for efficient C++ inference
  - Supports multiple model sizes (tiny, base, small, etc.)
  - Sends progress updates via SQS

## Prerequisites

- **AWS Account** with appropriate permissions
- **AWS CLI** configured
- **Docker** (for building Lambda container)
- **Node.js** 18+ and npm
- **Python** 3.x (for local Lambda testing)

### AWS Resources Required
- S3 bucket for audio storage
- Lambda function with container support
- SQS queue for message passing
- ECR repository for Lambda container image
- IAM roles with appropriate permissions

## Setup

### 1. AWS Infrastructure Setup

#### Create S3 Bucket
```bash
aws s3 mb s3://your-whisper-bucket-name
```

#### Create SQS Queue
```bash
aws sqs create-queue --queue-name whisper-transcription-queue
```

#### Create ECR Repository
```bash
aws ecr create-repository --repository-name whisper.audio.transcription
```

### 2. Lambda Setup

Navigate to the `whisper-lambda/` directory:

```bash
cd whisper-lambda
```

**Build and Push Docker Image:**
```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build the container
docker build -t whisper.audio.transcription .

# Tag the image
docker tag whisper.audio.transcription:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/whisper.audio.transcription:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/whisper.audio.transcription:latest
```

**Create Lambda Function:**
- Use the ECR image URI
- Set memory to at least 2048 MB
- Set timeout to 5 minutes (or higher for larger files)
- Add environment variable: `SQS_QUEUE_URL=<your-queue-url>`
- Configure S3 trigger on `unprocessed/` prefix

**Required IAM Permissions:**
- `s3:GetObject` and `s3:PutObject`
- `sqs:SendMessage`

### 3. Node Backend Setup

Navigate to the `node_backend/` directory:

```bash
cd node_backend
npm install
```

**Create `.env` file:**
```env
PORT=3001
CORS_ORIGIN=http://localhost:5173
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
S3_BUCKET_NAME=<your-bucket-name>
SQS_QUEUE_URL=<your-sqs-queue-url>
```

**Start the backend:**
```bash
npm start
```

### 4. Web App Setup

Navigate to the `web-app/` directory:

```bash
cd web-app
npm install
```

**Create `.env` file:**
```env
VITE_API_URL=http://localhost:3001
```

**Start the development server:**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

1. Open the web app in your browser
2. Drag and drop a WAV file (or click to browse)
3. Watch real-time upload progress
4. Once uploaded, the transcription starts automatically
5. View the completed transcript and play back the audio

## Configuration

### Whisper Model Selection

The Lambda function uses the "tiny" model by default for fast processing. To use a different model, modify [transcript.py](whisper-lambda/transcript.py#L74):

```python
def process_audio(wav_file, model_name="tiny"):  # Change "tiny" to "base", "small", etc.
```

Available models:
- `tiny` - Fastest, lowest accuracy (~75MB)
- `base` - Good balance (~142MB)
- `small` - Better accuracy (~466MB)
- `medium` - High accuracy (~1.5GB)
- `large` - Best accuracy (~2.9GB)

Note: Larger models require more Lambda memory and longer timeout settings.

## Troubleshooting

### Lambda timeout issues
- Increase Lambda timeout (max 15 minutes)
- Use a smaller Whisper model
- Increase Lambda memory allocation

### SQS messages not received
- Verify SQS queue URL in both Lambda and Node backend
- Check IAM permissions for SQS operations
- Ensure Node backend is polling correctly

### CORS errors
- Verify `CORS_ORIGIN` in Node backend `.env`
- Check that frontend and backend URLs match

### S3 trigger not firing
- Verify S3 event notification is configured
- Check Lambda permissions for S3
- Ensure files are uploaded to `unprocessed/` prefix

## License

MIT

## Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) - The original Whisper model
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) - High-performance C++ implementation used in this project for efficient inference
