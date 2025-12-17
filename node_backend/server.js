import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { SQSClient } from '@aws-sdk/client-sqs';
import { ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const queueUrl = process.env.SQS_QUEUE_URL;

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

let clients = [];
let isPolling = true;


async function reveiveSqSMessages() {
  const params = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,
  };
  try {
    const data = await sqsClient.send(new ReceiveMessageCommand(params));

    if (data.Messages) {

      // console.log('Data received:', data);

      for (const message of data.Messages) {
        console.log('Received message:', message.Body);

        sendSSEEvent(message.Body);

        // Process the message here
        // After processing, delete the message from the queue
        const deleteParams = {
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        };
        await sqsClient.send(new DeleteMessageCommand(deleteParams));
      }
    }
  } catch (error) {
    console.error('Error receiving messages:', error);
  }
}



const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 //Max file size: 100MB,
  },
});


function sendSSEEvent(data) {
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}


app.get('/events', (req, res) => {
  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders();


  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  console.log(`Client connected: ${clientId}. Total clients: ${clients.length}`);

  // Send an initial event to confirm connection
  res.write(`event: connected\ndata: Connected\n\n`);

  req.on("close", () => {
    clients = clients.filter(client => client.id !== clientId);
  });

});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      return res.status(500).json({ error: 'S3 bucket name not configured' });
    }

    //const timestamp = Date.now();
    const originalName = req.file.originalname;
    const fileName = `unprocessed/${originalName}`;

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      },
    });

    upload.on('httpUploadProgress', (progress) => {
      console.log(`Upload progress: ${progress.loaded}/${progress.total}`);
    });

    const result = await upload.done();

    res.json({
      message: 'File uploaded successfully',
      fileName: fileName,
      location: result.Location,
      bucket: bucketName,
      key: fileName,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Failed to upload file',
      details: error.message,
    });
  }
});

async function poll() {
  console.log("Starting SQS polling...");
  while (isPolling) {
    try {
      await reveiveSqSMessages();
    } catch (err) {
      console.error("Error receiving messages:", err);
    }
  }
  console.log("SQS polling stopped.");
}

// Start polling without blocking
setImmediate(() => poll());

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  isPolling = false;
  
  // Close all SSE connections
  console.log(`Closing ${clients.length} SSE client(s)...`);
  clients.forEach(client => {
    client.res.write('event: shutdown\ndata: Server shutting down\n\n');
    client.res.end();
  });
  clients = [];
  
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));