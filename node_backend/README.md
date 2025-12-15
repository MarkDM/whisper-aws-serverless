# Node.js S3 Upload Server

A Node.js Express server for uploading files to AWS S3.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure your AWS credentials and S3 bucket in `.env`:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET_NAME=your-bucket-name
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Health Check
- **GET** `/health`
- Returns server status

### Single File Upload
- **POST** `/upload`
- Content-Type: `multipart/form-data`
- Body: `file` (file field)
- Returns: Upload result with S3 location

### Multiple Files Upload
- **POST** `/upload-multiple`
- Content-Type: `multipart/form-data`
- Body: `files` (array of files, max 10)
- Returns: Array of upload results

## Example Usage

```javascript
// Single file upload
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:3001/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log(result);
```
