# Homepage Media Integration Guide

## Overview
This guide explains how to add images and videos to the Threadifier homepage once you have created them.

## 1. Storing Media Files

### Option A: Public Folder (Recommended for Static Assets)
Place your media files in the `public` folder:
```
threadifier/
├── public/
│   ├── images/
│   │   ├── hero-demo.png
│   │   ├── x-preview-demo.png
│   │   ├── instagram-preview-demo.png
│   │   └── feature-screenshots/
│   │       ├── thread-editor.png
│   │       ├── ai-suggestions.png
│   │       └── analytics-dashboard.png
│   └── videos/
│       ├── product-demo.mp4
│       └── how-it-works.mp4
```

### Option B: External Hosting (Recommended for Large Files)
- **Videos**: Upload to YouTube, Vimeo, or Cloudinary
- **Images**: Use Cloudinary, Imgix, or your existing CDN

## 2. Adding Hero Section Video

Replace the current hero section with a video background:

```tsx
// In Homepage.tsx, update the Hero Section:
<section className="relative overflow-hidden pt-20 pb-32">
  {/* Video Background */}
  <div className="absolute inset-0 z-0">
    <video
      autoPlay
      loop
      muted
      playsInline
      className="w-full h-full object-cover"
    >
      <source src="/videos/hero-background.mp4" type="video/mp4" />
    </video>
    <div className="absolute inset-0 bg-black/50" /> {/* Overlay for text readability */}
  </div>
  
  <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {/* Existing hero content */}
  </div>
</section>
```

## 3. Adding Product Demo Video

Add an embedded demo video after the hero section:

```tsx
// Add this new section after the hero section:
<section id="demo" className="py-20 bg-gray-50 dark:bg-gray-800">
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="text-center mb-12">
      <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        See Threadifier in Action
      </h3>
      <p className="text-xl text-gray-600 dark:text-gray-300">
        Watch how easy it is to transform your content
      </p>
    </div>
    
    {/* YouTube Embed */}
    <div className="relative pb-[56.25%] h-0 overflow-hidden rounded-xl shadow-2xl">
      <iframe
        className="absolute top-0 left-0 w-full h-full"
        src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
        title="Threadifier Demo"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
    
    {/* Or Local Video */}
    <video
      controls
      className="w-full rounded-xl shadow-2xl"
      poster="/images/video-thumbnail.png"
    >
      <source src="/videos/product-demo.mp4" type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  </div>
</section>
```

## 4. Adding Feature Screenshots

Update the features section with actual screenshots:

```tsx
// Update the features array in Homepage.tsx:
const features = [
  {
    title: "AI-Powered Thread Creation",
    description: "Advanced AI models analyze your content and create perfectly structured threads",
    icon: <Sparkles className="w-6 h-6" />,
    screenshot: "/images/feature-screenshots/ai-creation.png"
  },
  // ... other features
];

// Then in the features section rendering:
{features.map((feature, index) => (
  <div key={index} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl hover:shadow-lg transition-shadow">
    <div className="text-blue-600 dark:text-blue-400 mb-4">{feature.icon}</div>
    <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h4>
    <p className="text-gray-600 dark:text-gray-300 mb-4">{feature.description}</p>
    {feature.screenshot && (
      <img 
        src={feature.screenshot} 
        alt={feature.title}
        className="w-full h-40 object-cover rounded-lg mt-4"
      />
    )}
  </div>
))}
```

## 5. Adding Platform Preview Images

Replace the platform icons with actual preview images:

```tsx
// In the Platform Icons section:
<div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
  <div className="relative group cursor-pointer">
    <img 
      src="/images/x-preview-demo.png" 
      alt="X (Twitter) Thread Preview"
      className="w-full rounded-xl shadow-lg transition-transform group-hover:scale-105"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="absolute bottom-4 left-4 text-white">
        <Twitter className="w-8 h-8 mb-2" />
        <p className="font-semibold">X (Twitter) Threads</p>
      </div>
    </div>
  </div>
  
  <div className="relative group cursor-pointer">
    <img 
      src="/images/instagram-preview-demo.png" 
      alt="Instagram Carousel Preview"
      className="w-full rounded-xl shadow-lg transition-transform group-hover:scale-105"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="absolute bottom-4 left-4 text-white">
        <Instagram className="w-8 h-8 mb-2" />
        <p className="font-semibold">Instagram Carousels</p>
      </div>
    </div>
  </div>
</div>
```

## 6. Adding Testimonial Videos/Images

Add a testimonials section with user avatars:

```tsx
// Add this new section after industries:
<section className="py-20 bg-white dark:bg-gray-900">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="text-center mb-16">
      <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        Loved by Content Creators
      </h3>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {testimonials.map((testimonial, index) => (
        <div key={index} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl">
          <div className="flex items-center mb-4">
            <img 
              src={testimonial.avatar} 
              alt={testimonial.name}
              className="w-12 h-12 rounded-full mr-4"
            />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 italic">"{testimonial.quote}"</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

## 7. Optimizing Images

### Using Next.js Image Component:
```tsx
import Image from 'next/image';

// Replace <img> tags with Next.js Image component:
<Image 
  src="/images/hero-demo.png" 
  alt="Threadifier Demo"
  width={800}
  height={600}
  className="rounded-xl shadow-2xl"
  priority // Use for above-the-fold images
/>
```

### Image Optimization Tips:
1. Use WebP format for better compression
2. Provide multiple sizes for responsive images
3. Use lazy loading for below-the-fold images
4. Compress images before uploading (use tools like TinyPNG)

## 8. Adding Background Patterns/Graphics

Add subtle background graphics to sections:

```tsx
// Add to any section:
<section className="relative py-20">
  {/* Background Pattern */}
  <div className="absolute inset-0 opacity-5">
    <img 
      src="/images/patterns/grid-pattern.svg" 
      alt=""
      className="w-full h-full object-cover"
    />
  </div>
  
  <div className="relative z-10">
    {/* Section content */}
  </div>
</section>
```

## 9. Performance Considerations

1. **Lazy Load Videos**: Only load videos when they're in viewport
2. **Use Thumbnails**: Show video thumbnails before playing
3. **Optimize File Sizes**: 
   - Videos: Use MP4 with H.264 codec
   - Images: Max 200KB for hero images, 100KB for features
4. **Use CDN**: Consider Cloudflare or Vercel's built-in CDN

## 10. Accessibility

Always include:
- `alt` attributes for images
- `title` for videos
- Captions/subtitles for videos
- Ensure sufficient contrast for text over images/videos

## Example Implementation

After creating your media files, update the Homepage component:

```tsx
// At the top of Homepage.tsx:
import Image from 'next/image';

// Then use throughout the component:
<div className="relative h-96 rounded-xl overflow-hidden">
  <Image 
    src="/images/threadifier-demo.png"
    alt="Threadifier transforming a document into a thread"
    fill
    className="object-cover"
  />
</div>
```

## File Naming Convention

Use descriptive, SEO-friendly names:
- ✅ `threadifier-ai-suggestions-feature.png`
- ❌ `img1.png`
- ✅ `how-to-create-twitter-threads-demo.mp4`
- ❌ `video.mp4`