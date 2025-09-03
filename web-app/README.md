# Stock Analysis Web Application

A full-stack web application for analyzing Korean stock market sentiment using news data and AI-powered analysis.

## Features

- **Real-time Stock Analysis**: Analyze sentiment from recent news articles
- **Interactive Dashboard**: Modern React-based user interface with Material-UI
- **Analysis History**: Track and review past analysis results
- **Sentiment Visualization**: Charts and graphs showing positive/negative/neutral sentiment distribution
- **Database Storage**: Persistent storage using MySQL for analysis results and caching
- **RESTful API**: Node.js backend with comprehensive API endpoints

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for UI components
- **Recharts** for data visualization
- **Axios** for API communication

### Backend
- **Node.js** with Express.js
- **MySQL** for data persistence
- **Winston** for logging
- **Cron** for scheduled tasks

### Analysis Engine
- **Python 3.8+** for core analysis logic
- **OpenAI GPT** for sentiment analysis
- **Korean news APIs** for data collection
- **Economic indicators** integration

## Project Structure

```
web-app/
├── frontend/                 # React TypeScript application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── App.tsx          # Main application component
│   │   └── index.tsx        # Application entry point
│   └── package.json
├── backend/                  # Node.js API server
│   ├── server.js            # Express server
│   ├── database.js          # Database abstraction layer
│   ├── utils/               # Utility functions
│   └── package.json
├── schema.sql               # MySQL database schema
├── .env.example            # Environment variables template
└── INSTALL.md              # Installation instructions
```

## Quick Start

### Prerequisites
- Node.js 16+
- MySQL 8.0+
- Python 3.8+

### Installation

1. **Clone and setup the project**
   ```bash
   cd web-app
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Setup Database**
   ```sql
   CREATE DATABASE stock_analysis;
   USE stock_analysis;
   SOURCE schema.sql;
   ```

4. **Setup Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

5. **Install Python Dependencies**
   ```bash
   cd ../../
   pip install -r requirements.txt
   ```

### Running the Application

1. **Start Backend API**
   ```bash
   cd web-app/backend
   npm start
   ```

2. **Start Frontend**
   ```bash
   cd web-app/frontend
   npm start
   ```

3. **Access the Application**
   - Open http://localhost:3000 in your browser
   - API server runs on http://localhost:3001

## API Endpoints

### Analysis
- `POST /api/analysis` - Start new stock analysis
- `GET /api/analysis/:requestId` - Get analysis results

### History
- `GET /api/user/:userId/history` - Get user analysis history

### System
- `GET /api/stats` - Get system statistics
- `GET /health` - Health check

## Usage

1. **Start Analysis**
   - Enter a Korean stock name (e.g., "삼성전자", "SK하이닉스")
   - Select analysis period (1-90 days)
   - Click "분석 시작" (Start Analysis)

2. **View Results**
   - Real-time progress updates
   - Sentiment distribution charts
   - Detailed analysis report
   - Overall sentiment score

3. **Browse History**
   - View past analysis results
   - Expandable details for each analysis
   - Pagination support

## Configuration

### Environment Variables

#### Backend (.env)
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=stock_analysis

# Python Integration
PYTHON_EXECUTABLE=python
PYTHON_SERVICE_PATH=../../main.py

# Server
PORT=3001
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:3001
```

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm start    # Create React App dev server
```

### Database Migrations
The schema.sql file contains the complete database structure. For production deployments, consider using proper migration tools.

## Production Deployment

1. **Environment Setup**
   - Set `NODE_ENV=production`
   - Configure production database
   - Set up HTTPS
   - Configure proper logging

2. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   ```

3. **Security Considerations**
   - Enable CORS only for your domain
   - Set up proper input validation
   - Configure rate limiting
   - Regular security updates

## Monitoring and Logging

- Backend logs: `backend/logs/`
- Database activity logged in `system_logs` table
- API request/response logging
- Performance monitoring through `/api/stats`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
