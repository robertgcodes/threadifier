# Firebase Storage CORS Setup

## Issue
The Firebase Storage bucket needs to be initialized and CORS configured to allow uploads from localhost:3000.

## Current Status
- Project exists: `threadifier` (441684229833)
- Storage bucket configured in env: `threadifier.firebasestorage.app`
- **Problem**: Storage bucket not yet initialized

## Solution Steps

### Step 1: Initialize Firebase Storage
1. Go to [Firebase Console](https://console.firebase.google.com/project/threadifier)
2. Navigate to **Storage** in the left sidebar
3. Click **Get Started** if Storage isn't enabled
4. Choose **Start in production mode** or **Test mode** (recommend Test mode for development)
5. Select your preferred location (recommend `us-central1` for performance)

### Step 2: Apply CORS Configuration
Once Storage is initialized, run:

```bash
# Make sure you're using Python 3.12 (already set up)
export PATH="$HOME/.pyenv/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv init -)"

# Apply CORS configuration (try after Storage is initialized)
gsutil cors set cors.json gs://threadifier.firebasestorage.app
```

### Step 3: Alternative - Manual CORS Setup
If gsutil still doesn't work, you can set CORS via Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/storage/browser?project=threadifier)
2. Find your storage bucket
3. Click on bucket → Permissions → CORS
4. Add the CORS configuration from `cors.json`

### Step 4: Test the Fix
After CORS is configured, test image upload in the app. You should see successful uploads instead of CORS errors.

## Current CORS Configuration (cors.json)
```json
[
  {
    "origin": [
      "http://localhost:3000",
      "https://localhost:3000", 
      "https://threadifier.vercel.app",
      "https://*.vercel.app"
    ],
    "method": [
      "GET",
      "POST", 
      "PUT",
      "DELETE",
      "OPTIONS"
    ],
    "maxAgeSeconds": 3600,
    "responseHeader": [
      "Content-Type",
      "Access-Control-Allow-Origin",
      "Access-Control-Allow-Methods", 
      "Access-Control-Allow-Headers"
    ]
  }
]
```

## Expected Result
After setup, image uploads should work without CORS errors, and you'll see successful upload messages like:
- "📤 Uploading images to cloud storage..."
- "✅ Images uploaded successfully"