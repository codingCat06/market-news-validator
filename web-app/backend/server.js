const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

const Database = require('./database');
const logger = require('./utils/logger');
const { collectAndAnalyzeStock } = require('./services/stockAnalysis');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? ['https://yourdomain.com'] 
            : ['http://localhost:3000'],
        methods: ["GET", "POST"]
    }
});

// Global io 설정 (다른 모듈에서 사용할 수 있도록)
global.io = io;

const PORT = process.env.PORT || 3001;

// Initialize database
const db = new Database();

// WebSocket connection handling
io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);
    console.log(`🔗 WebSocket 클라이언트 연결: ${socket.id}`);
    console.log(`📊 총 연결된 클라이언트 수: ${io.engine.clientsCount}`);
    
    // 클라이언트가 특정 requestId 룸에 조인
    socket.on('join-analysis', (requestId) => {
        if (requestId) {
            socket.join(`analysis-${requestId}`);
            console.log(`📥 클라이언트 ${socket.id}가 분석 룸에 조인: analysis-${requestId}`);
            
            // 룸 내 클라이언트 수 확인
            const roomClients = io.sockets.adapter.rooms.get(`analysis-${requestId}`);
            const clientCount = roomClients ? roomClients.size : 0;
            console.log(`📊 analysis-${requestId} 룸의 클라이언트 수: ${clientCount}`);
            
            // 조인 완료 확인 전송
            socket.emit('joined-analysis', requestId);
            console.log(`✅ 클라이언트 ${socket.id}에게 조인 완료 확인 전송: ${requestId}`);
        } else {
            console.log(`❌ 클라이언트 ${socket.id}가 유효하지 않은 requestId로 조인 시도: ${requestId}`);
        }
    });
    
    // 클라이언트가 특정 requestId 룸에서 나감
    socket.on('leave-analysis', (requestId) => {
        if (requestId) {
            socket.leave(`analysis-${requestId}`);
            console.log(`📤 클라이언트 ${socket.id}가 분석 룸에서 나감: analysis-${requestId}`);
            
            // 나가기 완료 확인 전송
            socket.emit('left-analysis', requestId);
        }
    });
    
    socket.on('disconnect', (reason) => {
        logger.info(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`);
        console.log(`❌ WebSocket 클라이언트 연결 해제: ${socket.id}, 이유: ${reason}`);
        console.log(`📊 남은 연결된 클라이언트 수: ${io.engine.clientsCount}`);
    });
    
    socket.on('connect_error', (error) => {
        logger.error(`WebSocket connection error: ${error.message}`);
        console.log(`💥 WebSocket 연결 오류: ${error.message}`);
    });
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 타임아웃 설정 (5분)
app.use((req, res, next) => {
    res.setTimeout(300000, () => {
        console.log('Request timeout');
        res.status(408).send('Request timeout');
    });
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('🔍 API Called: GET /health');
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Analysis endpoint
app.post('/api/analysis', async (req, res) => {
    console.log('📊 API Called: POST /api/analysis');
    console.log('📝 Request Body:', JSON.stringify(req.body, null, 2));
    
    try {
        const { stockName, daysBack = 7, requestId: clientRequestId } = req.body;
        
        if (!stockName) {
            console.log('❌ Bad Request: Stock name is required');
            return res.status(400).json({ error: 'Stock name is required' });
        }

        // Validate daysBack
        const days = parseInt(daysBack);
        if (isNaN(days) || days < 1 || days > 90) {
            console.log('❌ Bad Request: Invalid days back value:', daysBack);
            return res.status(400).json({ error: 'Days back must be between 1 and 90' });
        }

        console.log(`🎯 Starting analysis for stock: ${stockName}, days: ${days}`);
        if (clientRequestId) {
            console.log(`🆔 Using client-provided requestId: ${clientRequestId}`);
        }

        // Calculate dates
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        console.log(`📅 Analysis period: ${startDateStr} to ${endDateStr}`);

        // Create analysis request (클라이언트가 제공한 requestId 사용 또는 새로 생성)
        let requestId;
        if (clientRequestId) {
            requestId = clientRequestId;
            console.log(`🆔 Using client-provided requestId: ${requestId}`);
            // 클라이언트가 제공한 requestId로 분석 요청 레코드 생성
            try {
                await db.createAnalysisRequestWithId(requestId, stockName, startDateStr, endDateStr);
                console.log('✅ Analysis request created with client-provided requestId');
            } catch (creationError) {
                console.log('❌ Failed to create analysis request with client requestId:', creationError.message);
                // 클라이언트 requestId로 생성 실패하면 새로 생성
                requestId = await db.createAnalysisRequest(stockName, startDateStr, endDateStr);
                console.log(`🆔 Generated new requestId due to creation error: ${requestId}`);
            }
        } else {
            requestId = await db.createAnalysisRequest(stockName, startDateStr, endDateStr);
            console.log(`🆔 Generated new requestId: ${requestId}`);
        }

        // 진행상황 전송 함수 - requestId 기반 룸으로 전송
        const sendProgress = (stepId, label, status, message = '', details = []) => {
            console.log(`📡 Sending progress: ${stepId} - ${status} - ${message}`);
            const progressData = {
                requestId,
                stepId,
                label,
                status,
                message,
                timestamp: new Date().toISOString()
            };
            
            if (details.length > 0) {
                progressData.details = details;
            }
            
            const roomName = `analysis-${requestId}`;
            const roomClients = io.sockets.adapter.rooms.get(roomName);
            const clientCount = roomClients ? roomClients.size : 0;
            
            // 클라이언트 수에 관계없이 메시지 전송 (클라이언트가 나중에 들어올 수 있음)
            io.to(roomName).emit('progress', progressData);
            
            if (clientCount > 0) {
                console.log(`📊 진행상황 전송 완료: ${clientCount}개 클라이언트에게 전송 (룸: ${roomName})`);
            } else {
                console.log(`📤 진행상황 전송: 룸(${roomName})에 클라이언트가 없지만 메시지 전송함 (나중에 조인할 수 있음)`);
            }
            
            // 콘솔에서 상세 로그 출력
            //console.log(`🔍 [${stepId}] ${label}: ${message}`);
            if (details.length > 0) {
                details.forEach((detail, index) => {
                    console.log(`   ${index + 1}. ${detail}`);
                });
            }
        };

        // 실시간 로그 전송 함수 추가 - requestId 기반 룸으로 전송
        const sendRealtimeLog = (stepId, message, type = 'info') => {
            const logEntry = {
                requestId,
                stepId,
                timestamp: new Date().toISOString(),
                message,
                type
            };
            
            // console.log(`📡 실시간 로그 전송: [${stepId}] ${message}`);
            console.log(`🔍 로그 상세: requestId=${requestId}, type=${type}`);
            
            if (io) {
                const roomName = `analysis-${requestId}`;
                
                // 룸 내 클라이언트 수 확인
                const roomClients = io.sockets.adapter.rooms.get(roomName);
                const clientCount = roomClients ? roomClients.size : 0;
                
                // 특정 requestId 룸으로만 전송
                io.to(roomName).emit('realtime-log', logEntry);
                console.log(`✅ 실시간 로그 전송 완료: ${clientCount}개 클라이언트에게 전송 (룸: ${roomName})`);
                
                if (clientCount === 0) {
                    console.log(`⚠️ 경고: ${roomName} 룸에 연결된 클라이언트가 없습니다`);
                }
            } else {
                console.log('❌ io 객체가 없어서 실시간 로그 전송 실패');
            }
        };

        // 분석 시작 알림
        sendProgress('init', '분석 요청 초기화', 'success', `${stockName} 분석 요청이 성공적으로 초기화되었습니다`, [
            'API 엔드포인트 연결 완료',
            '요청 데이터 검증 완료', 
            '분석 세션 생성 완료'
        ]);

        await db.addLog(requestId, 'INFO', 'API', `Analysis request created for ${stockName}`);

        // Update status to processing
        await db.updateAnalysisStatus(requestId, 'processing');


        // Run JavaScript analysis - Python 분석 완료까지 대기
        console.log('🚀 Starting JavaScript analysis...');
        sendProgress('processing', '분석 처리 시작', 'success', '분석 엔진 초기화가 완료되었습니다', [
            '분석 엔진 초기화 완료',
            '작업 큐 등록 완료',
            '리소스 할당 완료'
        ]);
        
        console.log('⏳ Python 분석 완료까지 대기...');
        const analysisResult = await runJavaScriptAnalysis(stockName, startDateStr, endDateStr, requestId, sendProgress, sendRealtimeLog);
        
        console.log('📊 분석 결과 수신:', analysisResult.success ? 'SUCCESS' : 'FAILED');
        // console.log('🔍 분석 데이터 확인:', {
        //     success: analysisResult.success,
        //     hasData: !!analysisResult.data,
        //     dataKeys: analysisResult.data ? Object.keys(analysisResult.data) : []
        // });
        
        // 처리 완료만 간단히 로그
        
        if (analysisResult.success) {
            console.log('✅ 모든 Python 분석이 완료됨 - 결과 저장 시작');
            
            // 이제 분석이 완전히 끝났으므로 데이터베이스 저장 시작
            console.log('💾 데이터베이스 저장 시작...');
            sendProgress('save', '결과 저장', 'loading', '분석 결과를 데이터베이스에 저장하고 있습니다', [
                '데이터베이스 연결 중',
                '분석 결과 검증 중',
                '데이터 저장 시작'
            ]);
            
            try {
                await saveAnalysisToDatabase(requestId, analysisResult.data.analysis, null);
                console.log('💾 데이터베이스 저장 완료');
                
                sendProgress('save', '결과 저장', 'success', '분석 결과가 성공적으로 저장되었습니다', [
                    '데이터베이스 연결 완료',
                    '분석 결과 검증 완료',
                    '데이터 저장 완료',
                    '인덱스 업데이트 완료'
                ]);
            } catch (saveError) {
                console.log('❌ 데이터베이스 저장 실패:', saveError.message);
                
                sendProgress('save', '결과 저장', 'error', `저장 실패: ${saveError.message}`);
                throw saveError;
            }
            
            // 상태 업데이트
            console.log('📝 분석 상태 업데이트 중...');
            
            await db.updateAnalysisStatus(requestId, 'completed', new Date());
            console.log('✅ 분석 상태가 완료로 업데이트됨');
            
            sendProgress('complete', '분석 완료', 'success', '모든 분석이 성공적으로 완료되었습니다', [
                '최종 결과 검증 완료',
                '데이터베이스 저장 완료',
                '응답 데이터 생성 완료',
                '세션 정리 완료'
            ]);
            
            await db.addLog(requestId, 'INFO', 'API', 'Analysis completed successfully');

            console.log('📤 성공 응답 전송');
            
            res.json({
                success: true,
                requestId: requestId,
                data: analysisResult.data
            });
        } else {
            console.log('❌ Analysis failed:', analysisResult.error);
            sendProgress('analysis', '데이터 수집 및 분석', 'error', `분석 실패: ${analysisResult.error}`);
            await db.updateAnalysisStatus(requestId, 'failed');
            await db.addLog(requestId, 'ERROR', 'JAVASCRIPT', analysisResult.error);
            
            res.status(500).json({
                success: false,
                error: analysisResult.error,
                requestId: requestId
            });
        }

    } catch (error) {
        console.log('💥 Analysis endpoint error:', error.message);
        logger.error('Analysis endpoint error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get analysis result endpoint
app.get('/api/analysis/:requestId', async (req, res) => {
    console.log('📋 API Called: GET /api/analysis/:requestId');
    console.log('🆔 Request ID:', req.params.requestId);
    
    try {
        const { requestId } = req.params;

        console.log(`🔍 Looking up analysis request: ${requestId}`);
        const request = await db.getAnalysisRequest(requestId);
        if (!request) {
            console.log('❌ Analysis request not found:', requestId);
            return res.status(404).json({ error: 'Analysis request not found' });
        }

        console.log('📊 Fetching analysis results and news data...');
        const results = await db.getAnalysisResults(requestId);
        const newsData = await db.getNewsData(requestId);

        // console.log('🔍 Analysis results from database:', results);
        console.log('📈 Results statistics:', {
            positive_count: results?.positive_count || 0,
            negative_count: results?.negative_count || 0,
            neutral_count: results?.neutral_count || 0,
            overall_sentiment: results?.overall_sentiment || 'unknown',
            overall_score: results?.overall_score || 0
        });
        console.log('📰 News data count:', newsData?.length || 0);

        console.log('📤 Sending analysis results response');
        res.json({
            request: request,
            results: results,
            newsData: newsData
        });

    } catch (error) {
        console.log('💥 Get analysis error:', error.message);
        logger.error('Get analysis error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get analysis history (공통)
app.get('/api/history', async (req, res) => {
    console.log('� API Called: GET /api/history');
    console.log('📊 Query params:', req.query);
    
    try {
        const { limit = 20, offset = 0 } = req.query;

        console.log(`📋 Fetching analysis history: limit=${limit}, offset=${offset}`);
        const history = await db.getAnalysisHistory(
            parseInt(limit), 
            parseInt(offset)
        );

        console.log(`📤 Sending ${history.length} history records`);
        res.json(history);

    } catch (error) {
        console.log('💥 Get history error:', error.message);
        logger.error('Get history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get system statistics
app.get('/api/stats', async (req, res) => {
    console.log('📈 API Called: GET /api/stats');
    console.log('📊 Query params:', req.query);
    
    try {
        const { days = 30 } = req.query;
        
        console.log(`📊 Fetching stats for ${days} days`);
        const stats = await db.getAnalysisStats(parseInt(days));
        const recentLogs = await db.getRecentLogs(50);

        console.log('📤 Sending system statistics response');
        res.json({
            stats: stats,
            recentLogs: recentLogs
        });

    } catch (error) {
        console.log('💥 Get stats error:', error.message);
        logger.error('Get stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cache management endpoints
app.delete('/api/cache/expired', async (req, res) => {
    console.log('🗑️ API Called: DELETE /api/cache/expired');
    
    try {
        console.log('🧹 Clearing expired cache...');
        await db.clearExpiredCache();
        console.log('✅ Expired cache cleared successfully');
        res.json({ message: 'Expired cache cleared successfully' });
    } catch (error) {
        console.log('💥 Clear cache error:', error.message);
        logger.error('Clear cache error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Function to run JavaScript analysis
async function runJavaScriptAnalysis(stockName, startDate, endDate, requestId, sendProgress = null, sendRealtimeLog = null) {
    try {
        console.log(`🔬 Starting JavaScript analysis for ${stockName} from ${startDate} to ${endDate}`);
        if (sendRealtimeLog) sendRealtimeLog('processing', `🔬 Starting JavaScript analysis for ${stockName} from ${startDate} to ${endDate}`);
        
        logger.info(`Starting JavaScript analysis for ${stockName} from ${startDate} to ${endDate}`);
        
        // 뉴스 수집 시작 알림
        console.log('📰 Starting news collection...');
        if (sendRealtimeLog) sendRealtimeLog('news-collection', '📰 Starting news collection...');
        
        if (sendProgress) {
            sendProgress('news-collection', '뉴스 수집', 'loading', '관련 뉴스를 수집하고 있습니다', [
                '뉴스 소스 연결 중',
                '키워드 검색 시작',
                '데이터 필터링 준비'
            ]);
        }
        
        // 직접 JavaScript 함수 호출 - 이것이 Python 분석까지 완료될 때까지 대기
        console.log('⚙️ Calling collectAndAnalyzeStock function and waiting for completion...');
        if (sendRealtimeLog) sendRealtimeLog('processing', '⚙️ Calling collectAndAnalyzeStock function and waiting for completion...');
        
        const analysisResult = await collectAndAnalyzeStock(stockName, startDate, endDate, sendProgress, requestId, sendRealtimeLog);
        
        console.log('✅ collectAndAnalyzeStock function completed');
        if (sendRealtimeLog) sendRealtimeLog('processing', '✅ collectAndAnalyzeStock function completed');
        
        console.log('📊 Analysis result summary:', {
            total_news: analysisResult.total_news_count || 0,
            analyzed_news: analysisResult.analyzed_news_count || 0,
            overall_sentiment: analysisResult.overall_sentiment || 'unknown'
        });
        if (sendRealtimeLog) sendRealtimeLog('processing', `📊 Analysis result summary: total_news: ${analysisResult.total_news_count || 0}, analyzed_news: ${analysisResult.analyzed_news_count || 0}, overall_sentiment: ${analysisResult.overall_sentiment || 'unknown'}`);
        
        logger.info('JavaScript analysis completed successfully');
        sendProgress('news-collection', '뉴스 수집', 'success', "뉴스를 성공적으로 수집했습니다.");

        return {
            success: true,
            data: {
                stock_name: stockName,
                start_date: startDate,
                end_date: endDate,
                analysis: analysisResult,
                timestamp: new Date().toISOString()
            }
        };
        
    } catch (error) {
        console.log(`❌ JavaScript analysis failed: ${error.message}`);
        logger.error(`JavaScript analysis failed: ${error.message}`);
        
        if (sendProgress) {
            sendProgress('news-collection', '뉴스 수집', 'error', `뉴스 수집 실패: ${error.message}`);
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Python analysis function removed - now using pure Node.js implementation

// Function to save analysis results to database
async function saveAnalysisToDatabase(requestId, analysisData, sendRealtimeLog = null) {
    try {
        console.log('💾 Saving analysis results to database...');
        console.log('📊 Analysis data structure:', {
            positive_count: analysisData.positive_count,
            negative_count: analysisData.negative_count,
            neutral_count: analysisData.neutral_count,
            overall_sentiment: analysisData.overall_sentiment,
            overall_score: analysisData.overall_score,
            has_news_data: !!analysisData.news_data,
            news_count: analysisData.news_data?.length || 0
        });

        // Save main analysis results
        await db.saveAnalysisResults(requestId, analysisData);
        console.log('✅ Analysis results saved successfully');

        // If you have structured news data, save it
        if (analysisData.news_data) {
            await db.saveNewsData(requestId, analysisData.news_data);
            console.log(`✅ News data saved: ${analysisData.news_data.length} articles`);
        }

        // If you have economic indicators data, save it
        if (analysisData.indicators_data) {
            await db.saveEconomicIndicators(requestId, analysisData.indicators_data);
            console.log('✅ Economic indicators saved');
        }

        logger.info(`Analysis results saved for request ${requestId}`);
    } catch (error) {
        console.log('❌ Error saving analysis results:', error.message);
        if (sendRealtimeLog) sendRealtimeLog('save', `❌ Error saving analysis results: ${error.message}`, 'error');
        
        logger.error(`Error saving analysis results for request ${requestId}:`, error);
        throw error;
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Cleanup expired cache periodically
const cron = require('node-cron');
cron.schedule('0 */6 * * *', async () => {
    try {
        await db.clearExpiredCache();
        logger.info('Expired cache cleared');
    } catch (error) {
        logger.error('Error clearing expired cache:', error);
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await db.close();
    process.exit(0);
});

server.listen(PORT, async () => {
    console.log('🚀 Starting Stock Analysis API Server...');
    console.log(`📡 WebSocket server enabled on port ${PORT}`);
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        // Initialize MongoDB connection and create indexes
        await db.connect();
        console.log('✅ MongoDB connection established');
        
        console.log('📇 Creating database indexes...');
        await db.ensureIndexes();
        console.log('✅ Database indexes created');
        
        logger.info(`Server running on port ${PORT}`);
        console.log(`🚀 Stock Analysis API Server started on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🗄️ MongoDB connected successfully`);
        console.log('📡 API Endpoints available:');
        console.log('   🔍 GET  /health');
        console.log('   📊 POST /api/analysis');
        console.log('   📋 GET  /api/analysis/:requestId');
        console.log('   � GET  /api/history');
        console.log('   📈 GET  /api/stats');
        console.log('   🗑️ DELETE /api/cache/expired');
        console.log('✅ Server ready to accept requests');
    } catch (error) {
        console.log('❌ Failed to initialize server:', error.message);
        logger.error('Failed to initialize database:', error);
        console.error('❌ Failed to connect to MongoDB:', error.message);
        process.exit(1);
    }
});

module.exports = app;
