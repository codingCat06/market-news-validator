# Web Application Installation Guide

## Prerequisites

1. **Node.js** (v16 or higher)
2. **MySQL** (v8.0 or higher)
3. **Python** (v3.8 or higher)
4. **Git**

## Backend Setup

### 1. Navigate to backend directory
```bash
cd web-app/backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up MySQL database
```sql
-- Connect to MySQL and create database
CREATE DATABASE stock_analysis;
USE stock_analysis;

-- Run the schema.sql file
SOURCE schema.sql;
```

### 4. Configure environment variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values
```

Required environment variables:
- `DB_HOST`: MySQL host (usually localhost)
- `DB_PORT`: MySQL port (usually 3306)
- `DB_USER`: MySQL username
- `DB_PASSWORD`: MySQL password
- `DB_NAME`: Database name (stock_analysis)
- `PYTHON_EXECUTABLE`: Path to Python executable
- `PYTHON_SERVICE_PATH`: Path to main.py (../../main.py)

### 5. Start the backend server
```bash
npm start
```

The backend will run on `http://localhost:3001`

## Frontend Setup

### 1. Navigate to frontend directory
```bash
cd web-app/frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the development server
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Python Service Setup

### 1. Install Python dependencies
```bash
cd ../../
pip install -r requirements.txt
```

### 2. Configure API keys
Make sure your Python environment has the necessary API keys configured:
- OpenAI API key for GPT analysis
- ECOS API key for economic indicators
- Any other required API keys

## Testing the Application

1. Open your browser and go to `http://localhost:3000`
2. Enter a stock name (e.g., "삼성전자", "SK하이닉스")
3. Select the analysis period (1-90 days)
4. Click "분석 시작" (Start Analysis)
5. Wait for the analysis to complete
6. View the results including sentiment analysis, news summary, and recommendations

## API Endpoints

### Analysis
- `POST /api/analysis` - Start new analysis
- `GET /api/analysis/:requestId` - Get analysis results

### User History
- `GET /api/user/:userId/history` - Get user analysis history

### System Stats
- `GET /api/stats` - Get system statistics

### Cache Management
- `DELETE /api/cache/expired` - Clear expired cache

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check MySQL is running
   - Verify database credentials in .env
   - Ensure database and tables are created

2. **Python Script Errors**
   - Check Python path in environment variables
   - Verify all Python dependencies are installed
   - Check API keys are configured

3. **Port Conflicts**
   - Backend default: 3001
   - Frontend default: 3000
   - Change ports in package.json if needed

### Logs

- Backend logs: `web-app/backend/logs/`
- Check console output for real-time debugging
- Database logs are stored in the `system_logs` table

## Production Deployment

### Environment Configuration
- Set `NODE_ENV=production`
- Use proper database credentials
- Configure HTTPS
- Set up proper logging
- Configure rate limiting

### Security Considerations
- Enable CORS only for your domain
- Use JWT tokens for authentication
- Implement proper input validation
- Set up firewall rules
- Regular security updates

## Monitoring

The application includes:
- Request logging
- Error tracking
- Performance monitoring
- Database query logging
- Cache hit/miss statistics

Check the `/api/stats` endpoint for system health metrics.
