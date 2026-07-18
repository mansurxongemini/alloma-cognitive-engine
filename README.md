# Alloma AI - Secure Production Architecture

## Security & Configuration Setup

### Environment Variables (Required)

This application uses server-side environment variables for secure API key management. **Never commit `.env` files to version control.**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual API keys in `.env`:
   ```
   VITE_FIREBASE_API_KEY=your_actual_firebase_api_key
   VITE_OPENROUTER_API_KEY=your_actual_openrouter_api_key
   VITE_VECTOR_DB_URL=https://your-vector-db-provider.com/api/v1
   VITE_VECTOR_DB_API_KEY=your_vector_db_api_key
   ```

### Vector Database Integration

The application now supports cloud-based persistent vector storage:

- **Pinecone**: Set `VITE_VECTOR_DB_URL` to your Pinecone endpoint
- **Weaviate**: Configure with your Weaviate Cloud instance URL
- **Qdrant**: Use your Qdrant Cloud API endpoint
- **Milvus**: Connect to your Milvus managed service

### Embedding API Retry Mechanism

The embedding generation includes automatic retry with exponential backoff:
- Maximum 5 retry attempts
- Base delay: 1 second
- Exponential backoff multiplier: 2x
- Failed embeddings update source document status to ERROR
- Error messages are stored in `source_error_message` field

### Document Status Tracking

Uploaded source documents track their processing status:
- `PROCESSING`: Initial state while embeddings are being generated
- `COMPLETED`: All chunks successfully embedded
- `PARTIAL`: Some chunks failed, others succeeded
- `ERROR`: All embedding attempts failed

### Folder-Based Document Organization

Documents are organized in a strict folder-based structure:
- Matching topics are grouped dynamically
- Drag-and-drop support for moving documents between folders
- Absolute vertical constraints prevent UI overlap

## Development

```bash
# Install dependencies (if using bundler)
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Production Deployment

1. Set all required environment variables on your hosting platform
2. Build the application
3. Deploy the built assets
4. Verify API endpoints are accessible

## Security Best Practices

- Never expose API keys in client-side code
- Use HTTPS for all API communications
- Implement proper CORS policies
- Regularly rotate API keys
- Monitor usage and set up alerts
