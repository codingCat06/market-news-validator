const NewsCollector = require('./newsCollector');
const EconomicIndicatorCollector = require('./economicIndicators');
const StockNewsAnalyzer = require('./stockAnalyzer');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

/**
 * 주식 분석 메인 함수
 * @param {string} stockName - 종목명
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 * @param {Function} sendProgress - 진행상황 전송 함수
 * @param {string} requestId - 요청 ID
 * @param {Function} sendRealtimeLog - 실시간 로그 전송 함수
 * @returns {Object} 분석 결과
 */
async function collectAndAnalyzeStock(stockName, startDate = null, endDate = null, sendProgress = null, requestId = null, sendRealtimeLog = null) {
    try {
        // 날짜 기본값 설정
        if (!startDate) {
            const date = new Date();
            date.setDate(date.getDate() - 30);
            startDate = date.toISOString().split('T')[0];
        }
        if (!endDate) {
            endDate = new Date().toISOString().split('T')[0];
        }
        console.log(`=== ${stockName} 분석 시작 (Python 사용) ===`);
        console.log(`분석 기간: ${startDate} ~ ${endDate}`);
        
        if (sendRealtimeLog) {
            sendRealtimeLog('processing', `=== ${stockName} 분석 시작 (Python 사용) ===`);
            sendRealtimeLog('processing', `분석 기간: ${startDate} ~ ${endDate}`);
        }

        console.log("🐍 Python 분석기 호출 및 대기 시작...");
        if (sendRealtimeLog) sendRealtimeLog('processing', "🐍 Python 분석기 호출 및 대기 시작...");
        
        // Python 분석기 실행 - 이 함수가 완전히 끝날 때까지 대기
        const pythonResult = await runPythonAnalyzer(stockName, startDate, endDate, sendProgress, requestId, sendRealtimeLog);
        
        console.log("🔍 Python 분석 결과 확인:", pythonResult.success ? '성공' : '실패');
        if (sendRealtimeLog) sendRealtimeLog('processing', `🔍 Python 분석 결과 확인: ${pythonResult.success ? '성공' : '실패'}`);
        
        if (pythonResult.success) {
            console.log("✅ Python 분석이 성공적으로 완료됨!");
            if (sendRealtimeLog) sendRealtimeLog('processing', "✅ Python 분석이 성공적으로 완료됨!");
            
            // Python 결과를 Node.js 형식으로 변환
            const result = pythonResult.data;
       
            // 안전한 데이터 추출
            const analyzedNews = Array.isArray(result.analyzed_news) ? result.analyzed_news : Array.from(result.analyzed_news);
            const newsData = Array.isArray(result.news_data) ? result.news_data : [];
            const significantNews = Array.isArray(result.significant_news) ? result.significant_news : [];
            const indicatorsData = result.indicators_data || {};
            const reportText = result.report || `${stockName} 분석이 완료되었습니다.`;
            
            console.log(`📊 최종 분석 결과:`);
            console.log(`   수집된 뉴스: ${newsData.length}개`);
            console.log(`   분석된 뉴스: ${analyzedNews.length}개`);
            console.log(`   중요 뉴스: ${significantNews.length}개`);
            
            if (sendRealtimeLog) {
                sendRealtimeLog('processing', `📊 최종 분석 결과:`);
                sendRealtimeLog('processing', `   수집된 뉴스: ${newsData.length}개`);
                sendRealtimeLog('processing', `   분석된 뉴스: ${analyzedNews.length}개`);
                sendRealtimeLog('processing', `   중요 뉴스: ${significantNews.length}개`);
            }
            
            // 통계 계산 - 더 안전한 방식
            let positiveCount = 0;
            let negativeCount = 0;
            let neutralCount = 0;
            let totalSentimentScore = 0;
            let validScoreCount = 0;
            
            analyzedNews.forEach(news => {

                const score = parseFloat(news.score) || 0;
                
                // 유효한 점수인 경우에만 계산에 포함
                if (!isNaN(score)) {
                    totalSentimentScore += score;
                    validScoreCount++;
                    
                    if (score > 0.1) {
                        positiveCount++;
                    } else if (score < -0.1) {
                        negativeCount++;
                    } else {
                        neutralCount++;
                    }
                } else {
                    // 점수가 없는 경우 중립으로 분류
                    neutralCount++;
                }
            });
            
            // 평균 감정 점수 계산
            const avgSentiment = validScoreCount > 0 ? totalSentimentScore / validScoreCount : 0;
            
            // 전체 감정 판단
            let overallSentiment = 'neutral';
            if (avgSentiment > 0.1) {
                overallSentiment = 'positive';
            } else if (avgSentiment < -0.1) {
                overallSentiment = 'negative';
            }
            
            // 신뢰도 점수 계산 (분석된 뉴스가 많을수록 높은 신뢰도)
            const confidenceScore = Math.min(1.0, analyzedNews.length / 10); // 10개 이상이면 최대 신뢰도
            
            console.log(`Python 분석 결과: 긍정 ${positiveCount}, 부정 ${negativeCount}, 중립 ${neutralCount}`);
            console.log(`평균 감정 점수: ${avgSentiment.toFixed(3)}, 전체 감정: ${overallSentiment}`);
            console.log(`총 뉴스: ${newsData.length}개, 분석된 뉴스: ${analyzedNews.length}개`);
            
            if (sendRealtimeLog) {
                sendRealtimeLog('processing', `Python 분석 결과: 긍정 ${positiveCount}, 부정 ${negativeCount}, 중립 ${neutralCount}`);
                sendRealtimeLog('processing', `평균 감정 점수: ${avgSentiment.toFixed(3)}, 전체 감정: ${overallSentiment}`);
                sendRealtimeLog('processing', `총 뉴스: ${newsData.length}개, 분석된 뉴스: ${analyzedNews.length}개`);
            }
            sendProgress('python-analyzer', 'Python 분석기 실행', 'success', `Python 분석 완료`);

            return {
                // 통계 데이터 (데이터베이스 저장용) - 기본값 보장
                positive_count: positiveCount || 0,
                negative_count: negativeCount || 0,
                neutral_count: neutralCount || 0,
                overall_sentiment: overallSentiment || 'neutral',
                overall_score: Math.abs(avgSentiment) || 0,
                confidence_score: confidenceScore || 0,
                total_news_count: newsData.length || 0,
                analyzed_news_count: analyzedNews.length || 0,
                report_text: reportText,
                
                // 상세 데이터
                news_data: newsData,
                analyzed_news: analyzedNews,
                significant_news: significantNews,
                indicators_data: indicatorsData,
                policy_impact: result.policy_impact || {}
            };
        } else {
            logger.error(`Python 분석 실패: ${pythonResult.error}`);
            if (sendProgress) {
                sendProgress('python-analyzer', 'Python 분석기 실행', 'error', `Python 분석 실패: ${pythonResult.error}`);
            }
            throw new Error(`Python 분석 실패: ${pythonResult.error}`);
        }

    } catch (error) {
        logger.error(`분석 중 오류 발생: ${error.message}`);
        if (sendProgress) {
            sendProgress('python-analyzer', 'Python 분석기 실행', 'error', `분석 중 오류 발생: ${error.message}`);
        }
        throw error;
    }
}

/**
 * 최근 분석 (기본 7일)
 * @param {string} stockName - 종목명
 * @param {number} days - 기간 (일)
 * @returns {Object} 분석 결과
 */
async function getRecentAnalysis(stockName, days = 7) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await collectAndAnalyzeStock(
        stockName,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
    );
}

/**
 * 배치 분석
 * @param {Array} stockList - 종목명 배열
 * @param {string} startDate - 시작일
 * @param {string} endDate - 종료일
 * @returns {Object} 분석 결과들
 */
async function batchAnalysis(stockList, startDate = null, endDate = null) {
    const results = {};

    for (const stockName of stockList) {
        try {
            const result = await collectAndAnalyzeStock(stockName, startDate, endDate);
            results[stockName] = result;
            console.log(`\n${stockName} 분석 완료\n${"=".repeat(50)}\n`);
        } catch (error) {
            logger.error(`${stockName} 분석 실패: ${error.message}`);
            results[stockName] = null;
        }
    }

    return results;
}

/**
 * 필요한 디렉토리 생성
 */
async function ensureDirectories() {
    const directories = ['cache', 'reports', 'logs'];
    
    for (const dir of directories) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            // 디렉토리가 이미 존재하는 경우 무시
            if (error.code !== 'EEXIST') {
                logger.warn(`디렉토리 생성 실패 ${dir}: ${error.message}`);
            }
        }
    }
}

/**
 * Python 분석기 실행
 * @param {string} stockName - 종목명
 * @param {string} startDate - 시작일
 * @param {string} endDate - 종료일
 * @param {Function} sendProgress - 진행상황 전송 함수
 * @param {string} requestId - 요청 ID
 * @param {Function} sendRealtimeLog - 실시간 로그 전송 함수
 * @returns {Object} Python 분석 결과
 */
async function runPythonAnalyzer(stockName, startDate, endDate, sendProgress = null, requestId = null, sendRealtimeLog = null) {
    return new Promise((resolve) => {
        let timeoutId; // 타임아웃 관리용
        let processFinished = false; // 프로세스 완료 여부 추적
        
        try {
            // Python 분석기 시작 진행 상황 전송
            if (sendProgress) {
                sendProgress('python-analyzer', 'Python 분석기 실행', 'loading', 'Python 분석기를 시작하고 있습니다', [
                    `📊 분석 대상: ${stockName}`,
                    `📅 분석 기간: ${startDate} ~ ${endDate}`,
                    `🐍 Python 분석 엔진 초기화 중...`
                ]);
            }
            
            // Python 스크립트 경로 설정
            const pythonScript = path.resolve(__dirname, '../../../main.py');
            const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python';
            
            console.log(`🐍 Python 분석기 실행: ${pythonExecutable} ${pythonScript}`);
            console.log(`📊 매개변수: ${stockName}, ${startDate}, ${endDate}`);
            console.log(`⏰ 타임아웃 설정: 300초 (5분)`);
            
            // Python 프로세스 실행
            const pythonProcess = spawn(pythonExecutable, [
                pythonScript,
                stockName,
                startDate,
                endDate
            ], {
                cwd: path.resolve(__dirname, '../../..'),
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    USE_SIMPLE_LOGGING: '1', // Python에서 JSON 출력을 위한 플래그
                    PYTHONIOENCODING: 'utf-8', // Python 입출력 인코딩
                    PYTHONLEGACYWINDOWSSTDIO: '0', // Windows에서 UTF-8 지원
                    LANG: 'ko_KR.UTF-8',
                    LC_ALL: 'ko_KR.UTF-8'
                }
            });
            
            // 300초 타임아웃 설정
            timeoutId = setTimeout(() => {
                if (!processFinished) {
                    console.log('⚠️ Python 프로세스 타임아웃 (300초)');
                    pythonProcess.kill('SIGTERM');
                    processFinished = true;
                    resolve({
                        success: false,
                        error: 'Python 분석기 타임아웃 (300초)',
                        timeout: true
                    });
                }
            }, 300000); // 300초 = 300,000ms
            
            let stdout = '';
            let stderr = '';
            let lastLogTime = Date.now();
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString('utf8');
                const currentTime = Date.now();
                //console.log(`📤 Python stdout (${currentTime - lastLogTime}ms 후): ${data.toString('utf8').trim()}`);
                lastLogTime = currentTime;
            });
            
            // 실시간 로그 저장소 (각 단계별로)
            const progressLogs = {
                'news-collection': [],
                'economic-data': [],
                'sentiment-analysis': [],
                'policy-analysis': [],
                'report-generation': []
            };
            
            // 현재 활성 단계 추적
            let currentActiveStep = 'news-collection';
            
            pythonProcess.stderr.on('data', (data) => {
                const text = data.toString('utf8');
                stderr += text;
                const currentTime = Date.now();
                
                // 서버 콘솔에 실시간 로그 출력 (더 상세하게)
                // console.log(`[Python stderr] ${text.trim()}`); 잠시지움
                
                // 실제 Python 로그를 React로 실시간 전송
                if (sendProgress && !processFinished) {
                    const lines = text.split('\n');
                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine || trimmedLine.length < 5) continue;
                        
                        // 타임스탬프 제거 (이미 포함된 경우)
                        const cleanLine = trimmedLine.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
                        
                        // WebSocket으로 실시간 로그 전송 (requestId와 stepId 포함)
                        const logEntry = {
                            requestId: requestId, // 함수 매개변수에서 받은 requestId 사용
                            stepId: currentActiveStep,  // 현재 활성 단계에 로그 추가
                            timestamp: new Date().toISOString(),
                            message: cleanLine,
                            type: cleanLine.includes('완료') || cleanLine.includes('✅') || cleanLine.includes('[완료]') ? 'success' : 
                                  cleanLine.includes('❌') || cleanLine.includes('[오류]') || cleanLine.includes('실패') || cleanLine.includes('오류') ? 'error' : 
                                  cleanLine.includes('⚠️') || cleanLine.includes('[주의]') || cleanLine.includes('경고') ? 'warning' : 'info'
                        };
                        
                        // 실시간 로그 전송 (requestId 기반 룸으로 전송)
                        if (global.io) {
                            const roomName = `analysis-${logEntry.requestId}`;
                            const roomClients = global.io.sockets.adapter.rooms.get(roomName);
                            const clientCount = roomClients ? roomClients.size : 0;
                            
                            // 특정 requestId 룸으로만 전송
                            global.io.to(roomName).emit('realtime-log', logEntry);
                            console.log(`✅ 실시간 로그 전송 완료: ${clientCount}개 클라이언트에게 전송`);
                            
                            if (clientCount === 0) {
                                console.log(`⚠️ 경고: ${roomName} 룸에 연결된 클라이언트가 없습니다`);
                            }
                        } else {
                            console.log('❌ global.io가 설정되지 않음 - 실시간 로그 전송 불가');
                        }
                        
                        // 단계 판별 및 진행상황 업데이트
                        let stepToUpdate = null;
                        let shouldUpdateProgress = false;
                        
                        // 뉴스 수집 관련 - 더 구체적인 매칭
                        if ((cleanLine.includes('뉴스') || cleanLine.includes('[뉴스]')) && 
                            (cleanLine.includes('수집') || cleanLine.includes('발견') || cleanLine.includes('크롤링') || 
                             cleanLine.includes('API') || cleanLine.includes('개 수집'))) {
                            stepToUpdate = 'news-collection';
                            currentActiveStep = 'news-collection';
                            
                            if (cleanLine.includes('완료') || cleanLine.includes('[완료]') || cleanLine.includes('수집 완료')) {
                                sendProgress('news-collection', '뉴스 수집', 'success', '뉴스 수집이 완료되었습니다');
                                currentActiveStep = 'economic-data';
                                shouldUpdateProgress = true;
                            } else if (cleanLine.includes('시작') || cleanLine.includes('API 호출')) {
                                sendProgress('news-collection', '뉴스 수집', 'loading', '뉴스를 수집하고 있습니다');
                                shouldUpdateProgress = true;
                            }
                        }
                        
                        // 경제지표 수집 관련
                        else if ((cleanLine.includes('경제지표') || cleanLine.includes('[분석]')) && 
                                (cleanLine.includes('ECOS') || cleanLine.includes('금리') || cleanLine.includes('환율') || 
                                 cleanLine.includes('물가') || cleanLine.includes('수집'))) {
                            stepToUpdate = 'economic-data';
                            currentActiveStep = 'economic-data';
                            
                            if (cleanLine.includes('완료') || cleanLine.includes('[완료]')) {
                                sendProgress('economic-data', '경제지표 수집', 'success', '경제지표 수집이 완료되었습니다');
                                currentActiveStep = 'policy-analysis';
                                shouldUpdateProgress = true;
                            } else if (cleanLine.includes('시작') || cleanLine.includes('요청')) {
                                sendProgress('economic-data', '경제지표 수집', 'loading', '경제지표를 수집하고 있습니다');
                                shouldUpdateProgress = true;
                            }
                        }
                        
                        // 정책 분석 관련
                        else if (cleanLine.includes('정책') || cleanLine.includes('정치') || cleanLine.includes('정부')) {
                            stepToUpdate = 'policy-analysis';
                            currentActiveStep = 'policy-analysis';
                            
                            if (cleanLine.includes('완료') || cleanLine.includes('[완료]')) {
                                sendProgress('policy-analysis', '정책 분석', 'success', '정책 분석이 완료되었습니다');
                                currentActiveStep = 'sentiment-analysis';
                                shouldUpdateProgress = true;
                            } else if (cleanLine.includes('시작') || cleanLine.includes('분석 중')) {
                                sendProgress('policy-analysis', '정책 분석', 'loading', '정책 영향을 분석하고 있습니다');
                                shouldUpdateProgress = true;
                            }
                        }
                        
                        // 감정 분석 관련 (AI 분석 포함)
                        else if (cleanLine.includes('감정 분석') || cleanLine.includes('AI') || cleanLine.includes('GPT') || 
                                cleanLine.includes('OpenAI') || cleanLine.includes('[AI]') || cleanLine.includes('분석 완료') ||
                                cleanLine.includes('API 호출') || cleanLine.includes('캐시')) {
                            stepToUpdate = 'sentiment-analysis';
                            currentActiveStep = 'sentiment-analysis';
                            
                            if (cleanLine.includes('감정 분석 완료') || cleanLine.includes('분석 완료') || cleanLine.includes('[완료]')) {
                                sendProgress('sentiment-analysis', '감정 분석', 'success', '감정 분석이 완료되었습니다');
                                currentActiveStep = 'report-generation';
                                shouldUpdateProgress = true;
                            } else if (cleanLine.includes('시작') || cleanLine.includes('API 호출')) {
                                sendProgress('sentiment-analysis', '감정 분석', 'loading', 'AI 감정 분석을 진행하고 있습니다');
                                shouldUpdateProgress = true;
                            }
                        }
                        
                        // 리포트 생성 관련
                        else if (cleanLine.includes('리포트') || cleanLine.includes('보고서') || cleanLine.includes('생성') || 
                                cleanLine.includes('전망') || cleanLine.includes('모든 분석이 완료') || cleanLine.includes('Python 분석기 실행 완료')) {
                            stepToUpdate = 'report-generation';
                            currentActiveStep = 'report-generation';
                            
                            if (cleanLine.includes('Python 분석기 실행 완료') || cleanLine.includes('모든 분석이 완료') || cleanLine.includes('[완료]')) {
                                sendProgress('report-generation', '리포트 생성', 'success', '최종 리포트 생성이 완료되었습니다');
                                shouldUpdateProgress = true;
                            } else if (cleanLine.includes('시작') || cleanLine.includes('생성 중')) {
                                sendProgress('report-generation', '리포트 생성', 'loading', '최종 리포트를 생성하고 있습니다');
                                shouldUpdateProgress = true;
                            }
                        }
                        
                        // 진행상황 업데이트 후 추가 로그 처리는 스킵 
                        if (shouldUpdateProgress) {
                            console.log(`📊 진행상황 업데이트: [${stepToUpdate}] ${cleanLine}`);
                        }
                    }
                }
            });
            
            pythonProcess.on('close', (code) => {
                if (processFinished) return; // 이미 처리된 경우 무시
                
                processFinished = true;
                clearTimeout(timeoutId); // 타임아웃 해제
                
                console.log(`🏁 Python 프로세스 종료 (exit code: ${code})`);
                
                if (code === 0) {
                    try {
                        // Python 출력에서 JSON 결과 파싱
                        console.log('📊 Python stdout 파싱 시작');
                        
                        // JSON 형태의 출력을 찾아서 파싱
                        const lines = stdout.split('\n');
                        let jsonResult = null;
                        
                        for (let i = 0; i < lines.length; i++) {
                            const trimmedLine = lines[i].trim();
                            if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                                try {
                                    jsonResult = JSON.parse(trimmedLine);
                                    console.log(`✅ JSON 결과 파싱 성공 (라인 ${i + 1})`);
                                    break;
                                } catch (e) {
                                    console.log(`❌ JSON 파싱 실패 (라인 ${i + 1}): ${e.message}`);
                                }
                            }
                        }
                        
                        if (jsonResult) {
                            console.log('🎯 Python 분석기 성공적으로 완료');
                            
                            // 모든 단계를 완료 상태로 업데이트
                            if (sendProgress) {
                                // 마지막 단계들 완료 처리
                                sendProgress('economic-data', '경제 데이터 수집', 'success', '경제 지표 데이터 수집이 완료되었습니다');
                                sendProgress('policy-analysis', '정책 분석', 'success', '정책 분석이 완료되었습니다');
                                sendProgress('report-generation', '리포트 생성', 'success', '최종 리포트 생성이 완료되었습니다');
                                
                                // 전체 분석 완료 신호
                                sendProgress('complete', '분석 완료', 'success', '모든 분석이 성공적으로 완료되었습니다');
                            }
                            

                            
                            if (sendRealtimeLog) {
                                sendRealtimeLog('python-analyzer', '🎯 Python 분석기 성공적으로 완료');
                            }
                            resolve({
                                success: true,
                                data: jsonResult
                            });
                        } else {
                            // JSON이 없으면 기본 형태로 결과 생성
                            console.log('⚠️ Python 출력에서 JSON을 찾을 수 없음, 기본 결과 생성');
                            
                            // 모든 단계를 완료 상태로 업데이트 (기본 결과)
                            if (sendProgress) {
                                sendProgress('economic-data', '경제 데이터 수집', 'success', '경제 지표 데이터 수집이 완료되었습니다');
                                sendProgress('policy-analysis', '정책 분석', 'success', '정책 분석이 완료되었습니다');
                                sendProgress('report-generation', '리포트 생성', 'success', '최종 리포트 생성이 완료되었습니다');
                                
                                // 전체 분석 완료 신호
                                sendProgress('complete', '분석 완료', 'success', '분석이 완료되었습니다 (기본 결과)');
                            }
                            
                            resolve({
                                success: true,
                                data: {
                                    analyzed_news: [],
                                    news_data: [],
                                    significant_news: [],
                                    indicators_data: {},
                                    report: 'Python 분석 완료 (JSON 출력 없음)'
                                }
                            });
                        }
                    } catch (error) {
                        console.log(`❌ Python 결과 파싱 오류: ${error.message}`);
                        resolve({
                            success: false,
                            error: `결과 파싱 오류: ${error.message}`,
                            raw_output: stdout,
                            raw_error: stderr
                        });
                    }
                } else {
                    console.log(`❌ Python 분석기 실행 실패 (exit code: ${code})`);
                    console.log(`stderr: ${stderr}`);
                    resolve({
                        success: false,
                        error: `Python 실행 실패 (code: ${code})`,
                        raw_output: stdout,
                        raw_error: stderr
                    });
                }
            });
            
            pythonProcess.on('error', (error) => {
                logger.error(`Python 프로세스 오류: ${error.message}`);
                resolve({
                    success: false,
                    error: `프로세스 오류: ${error.message}`
                });
            });
            
            // 300초 타임아웃 (5분)
            setTimeout(() => {
                pythonProcess.kill();
                resolve({
                    success: false,
                    error: 'Python 분석기 타임아웃 (300초)'
                });
            }, 300000);
            
        } catch (error) {
            logger.error(`Python 분석기 실행 준비 오류: ${error.message}`);
            resolve({
                success: false,
                error: `실행 준비 오류: ${error.message}`
            });
        }
    });
}

module.exports = {
    collectAndAnalyzeStock,
    getRecentAnalysis,
    batchAnalysis
};
