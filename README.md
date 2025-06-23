# Threadifier

Transform legal documents into engaging X (Twitter) threads with AI-powered analysis and built-in posting capabilities.

## Features

- 📄 **PDF Processing**: Upload legal documents and automatically extract text
- 🤖 **AI-Powered Analysis**: Uses Anthropic's Claude to create engaging threads
- ✏️ **Visual Editing**: Annotate and crop document pages with built-in image editor
- 🐦 **Direct X Posting**: Post threads directly to X (Twitter) with images
- 💾 **Thread Management**: Save drafts, organize with custom statuses
- 🎨 **Customization**: Set character limits, hashtags, emojis, and custom instructions
- 👤 **User Profiles**: Personalized settings and social media connections
- 🌙 **Dark Mode**: Eye-friendly dark theme support

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase account (for authentication and storage)
- Anthropic API key (for AI analysis)
- X Developer account (optional, for posting to X)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/threadifier.git
cd threadifier
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your `.env.local` file with:
   - Anthropic API key
   - Firebase configuration
   - X API credentials (optional)

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Configuration

### Required Environment Variables

```env
# Anthropic API Key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

### Optional: X (Twitter) Integration

To enable direct posting to X, see [X_SETUP_GUIDE.md](./X_SETUP_GUIDE.md) for detailed instructions.

## Usage

1. **Upload a PDF**: Drag and drop or click to upload a legal document
2. **Customize Settings**: Adjust character limit, number of posts, and add custom instructions
3. **Generate Thread**: Click "Generate Thread" to create an AI-powered thread
4. **Edit and Enhance**: 
   - Edit individual posts
   - Add images from document pages
   - Annotate images with the built-in editor
5. **Save or Post**: Save as draft or post directly to X

## Features in Detail

### Thread Editor
- Drag-and-drop reordering
- Individual post editing
- Image attachment for each post
- Character count tracking
- Copy individual posts or entire thread

### Image Editor
- Crop with preset aspect ratios (including X-optimized ratios)
- Draw annotations
- Add text overlays
- Real-time X image quality validation

### Thread Management
- Custom status workflows (Draft, Review, Ready, Posted, etc.)
- Sort by date, name, or status
- Quick status updates
- Thread templates and custom prompts

### AI Customization
- Global AI instructions for consistent output
- Per-thread custom instructions
- Save and reuse prompt templates
- Adjust tone, style, and focus

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage
- **AI**: Anthropic Claude API
- **Social Media**: X API v2

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

This project is licensed under the MIT License.

## Support

For issues and feature requests, please use the GitHub issues tracker.