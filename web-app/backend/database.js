const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

class Database {
    constructor() {
        this.client = null;
        this.db = null;
        this.connectionString = process.env.MONGODB_URI || 
            `mongodb://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME || 'stock_analysis'}`;
        }

    async connect() {
        if (this.client && this.db) {
            return this.db;
        }

        try {
            this.client = new MongoClient(this.connectionString, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 30000, // 30초로 증가
                socketTimeoutMS: 45000,
                connectTimeoutMS: 30000, // 연결 타임아웃 추가
            });

            await this.client.connect();
            this.db = this.client.db(process.env.DB_NAME || 'stock_analysis');
            
            console.log('Connected to MongoDB successfully');
            return this.db;
        } catch (error) {
            console.error('MongoDB connection error:', error);
            throw error;
        }
    }

    async getConnection() {
        return await this.connect();
    }

    async ensureIndexes() {
        const db = await this.connect();
        
        // Create indexes for better performance
        await db.collection('analysis_requests').createIndex({ created_at: -1 });
        await db.collection('analysis_requests').createIndex({ stock_name: 1 });
        await db.collection('news_data').createIndex({ analysis_request_id: 1 });
        await db.collection('economic_indicators').createIndex({ analysis_request_id: 1 });
        await db.collection('analysis_results').createIndex({ analysis_request_id: 1 });
        await db.collection('analysis_cache').createIndex({ cache_key: 1 });
        await db.collection('analysis_cache').createIndex({ expires_at: 1 });
        await db.collection('system_logs').createIndex({ analysis_request_id: 1, created_at: -1 });
    }

    // Analysis Requests
    async createAnalysisRequest(stockName, startDate, endDate) {
        const db = await this.connect();
        
        const analysisRequest = {
            stock_name: stockName,
            start_date: new Date(startDate),
            end_date: new Date(endDate),
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
        };

        console.log('💾 Creating analysis request:', {
            stock_name: stockName,
            start_date: startDate,
            end_date: endDate
        });

        // Write Concern을 추가해서 데이터가 확실히 저장되도록 보장
        const result = await db.collection('analysis_requests').insertOne(analysisRequest, {
            writeConcern: { w: 'majority', j: true }
        });
        
        const requestId = result.insertedId.toString();
        console.log(`✅ Analysis request created successfully with ID: ${requestId}`);
        
        // 생성 직후 검증을 위해 잠시 대기 후 조회 테스트
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const verification = await db.collection('analysis_requests').findOne({
            _id: result.insertedId
        });
        
        if (verification) {
            console.log(`✅ Analysis request verification successful: ${requestId}`);
        } else {
            console.warn(`⚠️ Analysis request verification failed: ${requestId}`);
        }
        
        return requestId;
    }

    // 클라이언트가 제공한 requestId로 분석 요청 생성
    async createAnalysisRequestWithId(requestId, stockName, startDate, endDate) {
        const db = await this.connect();
        
        // ObjectId 유효성 검사
        if (!ObjectId.isValid(requestId)) {
            throw new Error('Invalid requestId format');
        }
        
        const analysisRequest = {
            _id: new ObjectId(requestId),
            stock_name: stockName,
            start_date: new Date(startDate),
            end_date: new Date(endDate),
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
        };

        console.log('💾 Creating analysis request with client-provided ID:', {
            requestId: requestId,
            stock_name: stockName,
            start_date: startDate,
            end_date: endDate
        });

        try {
            // Write Concern을 추가해서 데이터가 확실히 저장되도록 보장
            const result = await db.collection('analysis_requests').insertOne(analysisRequest, {
                writeConcern: { w: 'majority', j: true }
            });
            
            console.log(`✅ Analysis request created successfully with client ID: ${requestId}`);
            
            // 생성 직후 검증을 위해 잠시 대기 후 조회 테스트
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const verification = await db.collection('analysis_requests').findOne({
                _id: new ObjectId(requestId)
            });
            
            if (verification) {
                console.log(`✅ Analysis request verification successful: ${requestId}`);
            } else {
                console.warn(`⚠️ Analysis request verification failed: ${requestId}`);
            }
            
            return requestId;
            
        } catch (error) {
            if (error.code === 11000) {
                // 중복 키 오류 - 이미 존재하는 requestId
                console.log(`⚠️ Analysis request already exists with ID: ${requestId}`);
                return requestId;
            }
            throw error;
        }
    }

    async updateAnalysisStatus(requestId, status, completedAt = null) {
        const db = await this.connect();
        
        const updateDoc = {
            status: status,
            updated_at: new Date()
        };
        
        if (completedAt) {
            updateDoc.completed_at = new Date(completedAt);
        }

        console.log(`🔄 Updating analysis status: ${requestId} -> ${status}`);

        const result = await db.collection('analysis_requests').updateOne(
            { _id: new ObjectId(requestId) },
            { $set: updateDoc },
            { writeConcern: { w: 'majority', j: true } }
        );
        
        if (result.matchedCount === 0) {
            console.warn(`⚠️ No document found to update for requestId: ${requestId}`);
        } else if (result.modifiedCount === 0) {
            console.warn(`⚠️ Document found but not modified for requestId: ${requestId}`);
        } else {
            console.log(`✅ Analysis status updated successfully: ${requestId} -> ${status}`);
        }

        return result;
    }

    async getAnalysisRequest(requestId) {
        const db = await this.connect();
        
        // ObjectId 유효성 검사
        if (!ObjectId.isValid(requestId)) {
            console.error('Invalid ObjectId:', requestId);
            return null;
        }
        
        try {
            console.log(`🔍 Searching for analysis request: ${requestId}`);
            
            // 재시도 로직 추가 (최대 3번, 각각 500ms 간격)
            let result = null;
            const maxRetries = 3;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                console.log(`📋 Attempt ${attempt}/${maxRetries} to find requestId: ${requestId}`);
                
                result = await db.collection('analysis_requests').findOne({
                    _id: new ObjectId(requestId)
                });
                
                if (result) {
                    console.log(`✅ Found analysis request on attempt ${attempt}:`, {
                        id: result._id,
                        stock_name: result.stock_name,
                        status: result.status,
                        created_at: result.created_at
                    });
                    return result;
                }
                
                // 마지막 시도가 아니면 잠시 대기
                if (attempt < maxRetries) {
                    console.log(`⏳ Request not found, waiting 500ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            // 모든 재시도 후에도 찾지 못한 경우
            console.log(`❌ Analysis request not found after ${maxRetries} attempts: ${requestId}`);
            
            // 디버깅을 위해 최근 요청들 조회
            const recentRequests = await db.collection('analysis_requests')
                .find({})
                .sort({ created_at: -1 })
                .limit(5)
                .toArray();
                
            console.log('📊 Recent analysis requests in database:');
            recentRequests.forEach((req, index) => {
                console.log(`   ${index + 1}. ID: ${req._id}, Stock: ${req.stock_name}, Status: ${req.status}, Created: ${req.created_at}`);
            });
            
            return null;
            
        } catch (error) {
            console.error('Error in getAnalysisRequest:', error);
            throw error;
        }
    }

    async getAnalysisHistory(limit = 20, offset = 0) {
        const db = await this.connect();
        
        try {
            const pipeline = [
                // 모든 분석 요청을 조회 (userId 필터 제거)
                {
                    $lookup: {
                        from: 'analysis_results',
                        localField: '_id',
                        foreignField: 'analysis_request_id',
                        as: 'results'
                    }
                },
                {
                    $addFields: {
                        overall_sentiment: { 
                            $let: {
                                vars: { result: { $arrayElemAt: ['$results', 0] } },
                                in: '$$result.overall_sentiment'
                            }
                        },
                        overall_score: { 
                            $let: {
                                vars: { result: { $arrayElemAt: ['$results', 0] } },
                                in: { $ifNull: ['$$result.overall_score', 0] }
                            }
                        },
                        positive_count: { 
                            $let: {
                                vars: { result: { $arrayElemAt: ['$results', 0] } },
                                in: { $ifNull: ['$$result.positive_count', 0] }
                            }
                        },
                        negative_count: { 
                            $let: {
                                vars: { result: { $arrayElemAt: ['$results', 0] } },
                                in: { $ifNull: ['$$result.negative_count', 0] }
                            }
                        },
                        neutral_count: { 
                            $let: {
                                vars: { result: { $arrayElemAt: ['$results', 0] } },
                                in: { $ifNull: ['$$result.neutral_count', 0] }
                            }
                        }
                    }
                },
                { $unset: 'results' },
                { $sort: { created_at: -1 } },
                { $skip: offset },
                { $limit: limit }
            ];

            return await db.collection('analysis_requests').aggregate(pipeline).toArray();
        } catch (error) {
            console.error('Error in getAnalysisHistory:', error);
            throw error;
        }
    }

    // News Data
    async saveNewsData(analysisRequestId, newsArray) {
        if (!newsArray || newsArray.length === 0) return;

        const db = await this.connect();
        
        const newsDocuments = newsArray.map(news => ({
            analysis_request_id: new ObjectId(analysisRequestId),
            title: news.title,
            content: news.content || null,
            url: news.url || null,
            published_date: news.date ? new Date(news.date) : null,
            source: news.source || null,
            sentiment: news.sentiment,
            score: news.score,
            confidence: news.confidence,
            reasoning: news.reasoning,
            reliability: news.reliability || 'medium',
            created_at: new Date()
        }));

        const result = await db.collection('news_data').insertMany(newsDocuments);
        return result.insertedIds;
    }

    async getNewsData(analysisRequestId) {
        const db = await this.connect();
        
        return await db.collection('news_data').find({
            analysis_request_id: new ObjectId(analysisRequestId)
        }).sort({ published_date: -1 }).toArray();
    }

    // Economic Indicators
    async saveEconomicIndicators(analysisRequestId, indicatorsData) {
        if (!indicatorsData) return;

        const db = await this.connect();
        const documents = [];
        
        Object.entries(indicatorsData).forEach(([type, dataArray]) => {
            if (Array.isArray(dataArray)) {
                dataArray.forEach(item => {
                    documents.push({
                        analysis_request_id: new ObjectId(analysisRequestId),
                        indicator_type: type,
                        indicator_name: item.name || type,
                        value: item.value,
                        date: item.date ? new Date(item.date) : null,
                        created_at: new Date()
                    });
                });
            }
        });

        if (documents.length === 0) return;

        const result = await db.collection('economic_indicators').insertMany(documents);
        return result.insertedIds;
    }

    async getEconomicIndicators(analysisRequestId) {
        const db = await this.connect();
        
        return await db.collection('economic_indicators').find({
            analysis_request_id: new ObjectId(analysisRequestId)
        }).toArray();
    }

    // Analysis Results
    async saveAnalysisResults(analysisRequestId, results) {
        const db = await this.connect();
        
        const resultDoc = {
            analysis_request_id: new ObjectId(analysisRequestId),
            positive_count: results.positive_count || 0,
            negative_count: results.negative_count || 0,
            neutral_count: results.neutral_count || 0,
            overall_sentiment: results.overall_sentiment || 'neutral',
            overall_score: results.overall_score || 0,
            confidence_score: results.confidence_score || 0,
            total_news_count: results.total_news_count || 0,
            analyzed_news_count: results.analyzed_news_count || 0,
            validation_result: results.validation_result || null,
            timeline_analysis: results.timeline_analysis || null,
            force_analysis: results.force_analysis || null,
            future_outlook: results.future_outlook || null,
            report_text: results.report_text || '',
            news_data: results.news_data || [],
            analyzed_news: results.analyzed_news || [],
            significant_news: results.significant_news || [],
            indicators_data: results.indicators_data || {},
            policy_impact: results.policy_impact || {},
            created_at: new Date(),
            updated_at: new Date()
        };

        // Use upsert to replace if exists
        const result = await db.collection('analysis_results').replaceOne(
            { analysis_request_id: new ObjectId(analysisRequestId) },
            resultDoc,
            { upsert: true }
        );
        
        return result.upsertedId || result.matchedCount;
    }

    async getAnalysisResults(analysisRequestId) {
        const db = await this.connect();
        
        return await db.collection('analysis_results').findOne({
            analysis_request_id: new ObjectId(analysisRequestId)
        });
    }

    // Cache Management
    async getCache(cacheKey) {
        const db = await this.connect();
        
        const cache = await db.collection('analysis_cache').findOne({
            cache_key: cacheKey,
            $or: [
                { expires_at: null },
                { expires_at: { $gt: new Date() } }
            ]
        });

        return cache ? cache.data : null;
    }

    async setCache(cacheKey, cacheType, data, stockName = null, startDate = null, endDate = null, expiresHours = 24) {
        const db = await this.connect();
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresHours);

        const cacheDoc = {
            cache_key: cacheKey,
            cache_type: cacheType,
            stock_name: stockName,
            start_date: startDate ? new Date(startDate) : null,
            end_date: endDate ? new Date(endDate) : null,
            data: data,
            expires_at: expiresAt,
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await db.collection('analysis_cache').replaceOne(
            { cache_key: cacheKey },
            cacheDoc,
            { upsert: true }
        );

        return result.upsertedId || result.matchedCount;
    }

    async clearExpiredCache() {
        const db = await this.connect();
        
        const result = await db.collection('analysis_cache').deleteMany({
            expires_at: { $lte: new Date() }
        });

        return result.deletedCount;
    }

    // System Logs
    async addLog(analysisRequestId, level, component, message, details = null) {
        const db = await this.connect();
        
        const logDoc = {
            analysis_request_id: analysisRequestId ? new ObjectId(analysisRequestId) : null,
            log_level: level,
            component: component,
            message: message,
            details: details,
            created_at: new Date()
        };

        const result = await db.collection('system_logs').insertOne(logDoc);
        return result.insertedId;
    }

    async getRecentLogs(limit = 100) {
        const db = await this.connect();
        
        // 단순한 조회로 변경 - lookup 제거
        return await db.collection('system_logs')
            .find({})
            .sort({ created_at: -1 })
            .limit(limit)
            .toArray();
    }

    // Statistics
    async getAnalysisStats(days = 30) {
        const db = await this.connect();
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const pipeline = [
            {
                $match: {
                    created_at: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$created_at"
                        }
                    },
                    total_requests: { $sum: 1 },
                    completed: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
                        }
                    },
                    failed: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "failed"] }, 1, 0]
                        }
                    },
                    unique_stocks: { $addToSet: "$stock_name" }
                }
            },
            {
                $project: {
                    date: "$_id",
                    total_requests: 1,
                    completed: 1,
                    failed: 1,
                    unique_stocks: { $size: "$unique_stocks" }
                }
            },
            { $sort: { date: -1 } }
        ];

        return await db.collection('analysis_requests').aggregate(pipeline).toArray();
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.client = null;
        }
    }
}

module.exports = Database;
