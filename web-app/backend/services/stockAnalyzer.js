const OpenAI = require('openai');
const logger = require('../utils/logger');


class StockNewsAnalyzer {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.cache = new Map(); // 간단한 메모리 캐시
    }

    /**
     * 뉴스 배치 분석
     * @param {Array} newsData - 뉴스 데이터 배열
     * @returns {Array} 분석된 뉴스 데이터
     */
    async analyzeNewsBatch(newsData) {
        try {
            logger.info(`Starting batch analysis of ${newsData.length} news articles`);
            
            // 뉴스 데이터가 없으면 빈 배열 반환하지만 로그 남김
            if (!newsData || newsData.length === 0) {
                logger.warn('No news data provided for analysis');
                return [];
            }
            
            const analyzedNews = [];
            const batchSize = 5; // 동시 처리할 뉴스 개수
            
            for (let i = 0; i < newsData.length; i += batchSize) {
                const batch = newsData.slice(i, i + batchSize);
                const batchPromises = batch.map(news => this.analyzeNews(news));
                
                try {
                    const batchResults = await Promise.allSettled(batchPromises);
                    
                    batchResults.forEach((result, index) => {
                        if (result.status === 'fulfilled') {
                            analyzedNews.push(result.value);
                        } else {
                            logger.warn(`Failed to analyze news ${i + index}: ${result.reason}`);
                            // 실패한 경우에도 뉴스 제목/내용 기반으로 기본 분석 수행
                            const news = batch[index];
                            const basicAnalysis = this.performBasicSentimentAnalysis(news);
                            analyzedNews.push({
                                ...news,
                                ...basicAnalysis,
                                analysis: '기본 분석 (API 호출 실패)'
                            });
                        }
                    });
                    
                    // API 호출 제한을 위한 지연
                    if (i + batchSize < newsData.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                } catch (error) {
                    logger.error(`Error processing batch ${i}: ${error.message}`);
                }
            }
            
            logger.info(`Completed analysis of ${analyzedNews.length} news articles`);
            return analyzedNews;
            
        } catch (error) {
            logger.error(`Error in batch news analysis: ${error.message}`);
            throw error;
        }
    }

    /**
     * 개별 뉴스 분석
     * @param {Object} news - 뉴스 객체
     * @returns {Object} 분석된 뉴스 객체
     */
    async analyzeNews(news) {
        try {
            // 캐시 확인
            const cacheKey = `${news.title}-${news.source}`;
            if (this.cache.has(cacheKey)) {
                logger.debug(`Using cached analysis for: ${news.title.substring(0, 50)}...`);
                return { ...news, ...this.cache.get(cacheKey) };
            }

            const prompt = `
다음 뉴스 기사를 분석해주세요:

제목: ${news.title}
요약: ${news.summary}
출처: ${news.source}

다음 기준으로 분석해주세요:
1. 감정 점수 (-1.0 ~ 1.0): 매우 부정적(-1.0)부터 매우 긍정적(1.0)까지
2. 관련성 점수 (0.0 ~ 1.0): 주식 투자에 대한 영향도
3. 주요 키워드 (3-5개)
4. 간단한 분석 (1-2문장)

JSON 형식으로 응답해주세요:
{
  "sentiment_score": 0.0,
  "relevance_score": 0.0,
  "keywords": ["키워드1", "키워드2"],
  "analysis": "분석 내용"
}`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "당신은 주식 뉴스 분석 전문가입니다. 뉴스의 감정과 주식 투자에 대한 영향을 정확히 분석해주세요."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.3
            });

            const analysisText = response.choices[0].message.content.trim();
            
            try {
                // console.log(analysisText)
                const analysis = JSON.parse(analysisText);
                
                const result = {
                    sentiment_score: analysis.sentiment_score || 0.0,
                    relevance_score: analysis.relevance_score || 0.5,
                    keywords: analysis.keywords || [],
                    analysis: analysis.analysis || '분석 내용 없음'
                };
                
                // 캐시에 저장
                this.cache.set(cacheKey, result);
                
                return { ...news, ...result };
                
            } catch (parseError) {
                logger.warn(`Failed to parse analysis JSON: ${parseError.message}`);
                return {
                    ...news,
                    sentiment_score: 0.0,
                    relevance_score: 0.5,
                    keywords: [],
                    analysis: analysisText
                };
            }
            
        } catch (error) {
            logger.error(`Error analyzing news: ${error.message}`);
            console.log('=== Analysis Error ===');
            console.log('Error:', error.message);
            console.log('News title:', news.title);
            console.log('======================');
            
            // 오류 발생시 기본 분석 수행
            const basicAnalysis = this.performBasicSentimentAnalysis(news);
            
            return {
                ...news,
                ...basicAnalysis,
                analysis: `기본 분석 수행 (OpenAI 오류: ${error.message})`
            };
        }
    }

    /**
     * 기본 감정 분석 (키워드 기반)
     * @param {Object} news - 뉴스 객체
     * @returns {Object} 기본 분석 결과
     */
    performBasicSentimentAnalysis(news) {
        const title = news.title ? news.title.toLowerCase() : '';
        const summary = news.summary ? news.summary.toLowerCase() : '';
        const content = title + ' ' + summary;

        // 긍정적 키워드
        const positiveKeywords = [
            '상승', '증가', '성장', '호조', '개선', '확대', '투자', '매수',
            '긍정', '좋은', '상향', '반등', '회복', '흑자', '이익', '수익',
            '신고가', '급등', '강세', '돌파', '성공', '혁신', '기대'
        ];

        // 부정적 키워드
        const negativeKeywords = [
            '하락', '감소', '둔화', '부진', '악화', '축소', '매도', '하향',
            '부정', '나쁜', '하락세', '급락', '약세', '적자', '손실',
            '신저가', '폭락', '우려', '위험', '실망', '충격', '불안'
        ];

        let positiveScore = 0;
        let negativeScore = 0;

        // 키워드 매칭
        positiveKeywords.forEach(keyword => {
            if (content.includes(keyword)) {
                positiveScore += 1;
            }
        });

        negativeKeywords.forEach(keyword => {
            if (content.includes(keyword)) {
                negativeScore += 1;
            }
        });

        // 감정 점수 계산 (-1.0 ~ 1.0)
        const totalScore = positiveScore + negativeScore;
        let sentimentScore = 0;
        
        if (totalScore > 0) {
            sentimentScore = (positiveScore - negativeScore) / totalScore;
            // 스케일 조정: -1.0 ~ 1.0 범위로
            sentimentScore = Math.max(-1.0, Math.min(1.0, sentimentScore));
        }

        // 관련성 점수 (주식 관련 키워드 포함 여부)
        const stockKeywords = ['주식', '증권', '투자', '시장', '상장', '거래', '매매'];
        let relevanceScore = 0.3; // 기본값
        
        stockKeywords.forEach(keyword => {
            if (content.includes(keyword)) {
                relevanceScore += 0.1;
            }
        });
        
        relevanceScore = Math.min(1.0, relevanceScore);

        return {
            sentiment_score: sentimentScore,
            relevance_score: relevanceScore,
            keywords: [...new Set([...positiveKeywords.filter(k => content.includes(k)), 
                                   ...negativeKeywords.filter(k => content.includes(k))])]
        };
    }

    /**
     * 유의미한 뉴스 필터링
     * @param {Array} analyzedNews - 분석된 뉴스 배열
     * @param {number} minScore - 최소 관련성 점수
     * @returns {Array} 필터링된 뉴스 배열
     */
    filterSignificantNews(analyzedNews, minScore = 0.3) {
        try {
            const significantNews = analyzedNews.filter(news => {
                return news.relevance_score >= minScore;
            });
            
            // 관련성 점수 순으로 정렬
            significantNews.sort((a, b) => b.relevance_score - a.relevance_score);
            
            logger.info(`Filtered ${significantNews.length} significant news from ${analyzedNews.length} total`);
            return significantNews;
            
        } catch (error) {
            logger.error(`Error filtering significant news: ${error.message}`);
            return analyzedNews;
        }
    }

    /**
     * 종합 리포트 생성
     * @param {string} stockName - 종목명
     * @param {Array} analyzedNews - 분석된 뉴스 배열
     * @param {Object} indicatorsData - 경제지표 데이터
     * @param {string} startDate - 시작일
     * @param {string} endDate - 종료일
     * @param {Object} policyImpact - 정책 영향 분석
     * @returns {string} 종합 리포트
     */
    async generateReport(stockName, analyzedNews, indicatorsData, startDate, endDate, policyImpact = {}) {
        try {
            logger.info(`Generating comprehensive report for ${stockName}`);
            
            // 뉴스 요약 통계
            const totalNews = analyzedNews.length;
            const positiveNews = analyzedNews.filter(news => news.sentiment_score > 0.1).length;
            const negativeNews = analyzedNews.filter(news => news.sentiment_score < -0.1).length;
            const avgSentiment = analyzedNews.reduce((sum, news) => sum + news.sentiment_score, 0) / totalNews;
            
            // 주요 뉴스 선별 (상위 5개)
            const topNews = analyzedNews
                .sort((a, b) => b.relevance_score - a.relevance_score)
                .slice(0, 5);

            const prompt = `
${stockName} 주식에 대한 종합 분석 리포트를 작성해주세요.

분석 기간: ${startDate} ~ ${endDate}

뉴스 분석 결과:
- 총 뉴스 개수: ${totalNews}개
- 긍정적 뉴스: ${positiveNews}개
- 부정적 뉴스: ${negativeNews}개
- 평균 감정 점수: ${avgSentiment.toFixed(2)}

주요 뉴스:
${topNews.map((news, index) => 
    `${index + 1}. ${news.title} (관련성: ${news.relevance_score.toFixed(2)}, 감정: ${news.sentiment_score.toFixed(2)})`
).join('\n')}

경제지표:
${Object.entries(indicatorsData).map(([key, values]) => 
    `- ${key}: ${Array.isArray(values) ? values.length + '개 데이터' : '데이터 없음'}`
).join('\n')}

다음 구조로 리포트를 작성해주세요:
1. 종합 의견 (투자 관점에서의 전반적 평가)
2. 호재 분석 (긍정적 요인들)
3. 악재 분석 (부정적 요인들)
4. 경제지표 영향 분석
5. 향후 전망 및 투자 시사점

전문적이고 객관적인 톤으로 작성해주세요.`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "당신은 경험이 풍부한 주식 애널리스트입니다. 뉴스와 경제지표를 종합하여 객관적이고 전문적인 투자 리포트를 작성해주세요."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1500,
                temperature: 0.3
            });

            const report = response.choices[0].message.content.trim();
            
            logger.info(`Generated comprehensive report for ${stockName}`);
            return report;
            
        } catch (error) {
            logger.error(`Error generating report: ${error.message}`);
            return this.generateBasicReport(stockName, analyzedNews, startDate, endDate);
        }
    }

    /**
     * 기본 리포트 생성 (OpenAI 실패시 대체)
     */
    generateBasicReport(stockName, analyzedNews, startDate, endDate) {
        const totalNews = analyzedNews.length;
        const positiveNews = analyzedNews.filter(news => news.sentiment_score > 0.1).length;
        const negativeNews = analyzedNews.filter(news => news.sentiment_score < -0.1).length;
        const avgSentiment = analyzedNews.reduce((sum, news) => sum + news.sentiment_score, 0) / totalNews;

        return `
${stockName} 주식 분석 리포트
분석 기간: ${startDate} ~ ${endDate}

=== 종합 의견 ===
총 ${totalNews}개의 뉴스를 분석한 결과, 평균 감정 점수는 ${avgSentiment.toFixed(2)}입니다.

=== 뉴스 분석 결과 ===
- 긍정적 뉴스: ${positiveNews}개 (${(positiveNews/totalNews*100).toFixed(1)}%)
- 부정적 뉴스: ${negativeNews}개 (${(negativeNews/totalNews*100).toFixed(1)}%)
- 중립적 뉴스: ${totalNews-positiveNews-negativeNews}개

=== 주요 뉴스 ===
${analyzedNews.slice(0, 3).map((news, index) => 
    `${index + 1}. ${news.title}\n   - 관련성: ${news.relevance_score.toFixed(2)}, 감정: ${news.sentiment_score.toFixed(2)}`
).join('\n')}

=== 향후 전망 ===
수집된 뉴스와 시장 상황을 종합적으로 고려하여 투자 결정을 내리시기 바랍니다.

※ 본 리포트는 AI 분석 결과이며, 투자 판단의 참고 자료로만 활용하시기 바랍니다.
        `.trim();
    }
}

module.exports = StockNewsAnalyzer;
