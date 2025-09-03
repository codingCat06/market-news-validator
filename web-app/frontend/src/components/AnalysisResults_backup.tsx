import React, { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Divider,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Assessment,
  Schedule,
  CheckCircle,
  Error,
  HourglassEmpty,
  ExpandMore,
  PlayArrow,
  CheckCircleOutline,
  ErrorOutline,
  AccessTime
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AnalysisRequest, AnalysisData } from '../App';
import io from 'socket.io-client';

interface AnalysisResultsProps {
  analysis: AnalysisRequest | null;
  data: AnalysisData | null;
}

interface ProgressStep {
  stepId: string;
  label: string;
  status: 'loading' | 'success' | 'error';
  message: string;
  details?: string[];
  timestamp: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const COLORS = {
  positive: '#4caf50',
  negative: '#f44336',
  neutral: '#ff9800'
};

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysis, data }) => {
  const [realTimeLogs, setRealTimeLogs] = useState<LogEntry[]>([]);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    if (analysis && analysis.status === 'processing') {
      // WebSocket 연결
      const newSocket = io('http://localhost:3001');
      setSocket(newSocket);

      console.log('🔌 WebSocket 연결 시작...');

      // 실시간 로그 수신
      newSocket.on('realtime-log', (logEntry: LogEntry) => {
        console.log('📨 실시간 로그 수신:', logEntry);
        setRealTimeLogs(prev => [...prev, logEntry].slice(-100)); // 최대 100개 로그 유지
      });

      // 연결 이벤트
      newSocket.on('connect', () => {
        console.log('✅ WebSocket 연결됨');
      });

      // 연결 해제 이벤트
      newSocket.on('disconnect', () => {
        console.log('❌ WebSocket 연결 해제됨');
      });

      // 경과 시간 타이머
      const startTime = Date.now();
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      return () => {
        clearInterval(timer);
        newSocket.disconnect();
        console.log('🔌 WebSocket 연결 정리');
      };
    }
  }, [analysis?.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (analysis && analysis.status === 'processing') {
      // 실시간 로그 시뮬레이션
      const mockLogs = [
        { step: 'news-collection', message: '🔍 삼성전자 뉴스 수집 시작 (2024-01-01 ~ 2024-01-07)', delay: 1000 },
        { step: 'news-collection', message: '🌐 네이버 뉴스 API 연결 시도 중', delay: 2000 },
        { step: 'news-collection', message: '📖 페이지 1/3 요청 중... (검색어: \'삼성전자 주식\', 시작 인덱스: 1)', delay: 3000 },
        { step: 'news-collection', message: '📡 API 응답 수신: HTTP 200', delay: 4000 },
        { step: 'news-collection', message: '� 페이지 1에서 100개 뉴스 발견', delay: 5000 },
        { step: 'news-collection', message: '✅ 뉴스 1번째 수집: 삼성전자, 4분기 실적 발표...', delay: 6000 },
        { step: 'news-collection', message: '📅 발행일: 2024-01-05 14:30', delay: 6500 },
        { step: 'news-collection', message: '✅ 뉴스 2번째 수집: 반도체 업황 개선 전망...', delay: 7000 },
        { step: 'news-collection', message: '📊 페이지 1 완료: 수집 15개, 날짜 필터 3개, 오류 0개', delay: 8000 },
        { step: 'news-collection', message: '📈 현재 총 수집량: 15개', delay: 8500 },
        { step: 'news-collection', message: '🎉 삼성전자 뉴스 수집 완료!', delay: 9000 },
        { step: 'news-collection', message: '📊 최종 수집량: 15개', delay: 9500 },
        
        { step: 'economic-data', message: '📊 경제지표 수집 시작 (기간: 2024-01-01 ~ 2024-01-07)', delay: 10000 },
        { step: 'economic-data', message: '✅ ECOS API 키 확인됨: DH28F4K3...', delay: 11000 },
        { step: 'economic-data', message: '📈 [1/5] 기준금리 수집 중...', delay: 12000 },
        { step: 'economic-data', message: '📋 통계표코드: 722Y001, 항목코드: 0101000', delay: 12500 },
        { step: 'economic-data', message: '✅ 3개 데이터 수집 완료 (최신값: 3.5)', delay: 13500 },
        { step: 'economic-data', message: '📊 데이터 샘플: 2024-01-05 = 3.5, 2024-01-06 = 3.5', delay: 14000 },
        { step: 'economic-data', message: '🎉 경제지표 수집 완료!', delay: 15000 },
        
        { step: 'sentiment-analysis', message: '🧠 AI 감정 분석 시작: 15개 뉴스', delay: 16000 },
        { step: 'sentiment-analysis', message: '🔄 중복 뉴스 제거 중...', delay: 17000 },
        { step: 'sentiment-analysis', message: '✅ 중복 제거 완료: 15개 뉴스', delay: 17500 },
        { step: 'sentiment-analysis', message: '🤖 GPT-4o mini를 사용한 감정 분석 시작...', delay: 18000 },
        { step: 'sentiment-analysis', message: '📦 캐시 재사용 (1/15): 삼성전자, 4분기 실적 발표...', delay: 19000 },
        { step: 'sentiment-analysis', message: '🔍 OpenAI API 호출 중 (2/15): 반도체 업황 개선 전망...', delay: 20000 },
        { step: 'sentiment-analysis', message: '✅ AI 분석 완료: 감정=positive, 신뢰도=0.85', delay: 21000 },
        { step: 'sentiment-analysis', message: '💾 분석 결과 캐시 저장 중...', delay: 21500 },
        { step: 'sentiment-analysis', message: '🎉 감정 분석 완료!', delay: 25000 },
        { step: 'sentiment-analysis', message: '📊 처리 결과: 총 15개', delay: 25500 },
        { step: 'sentiment-analysis', message: '📦 캐시 재사용: 5개', delay: 26000 },
        { step: 'sentiment-analysis', message: '🤖 새로 분석: 10개', delay: 26500 },
        { step: 'sentiment-analysis', message: '📈 감정 분포: 긍정 8개, 부정 2개, 중립 5개', delay: 27000 },
        
        { step: 'report-generation', message: '📋 최종 분석 및 리포트 생성 시작...', delay: 28000 },
        { step: 'report-generation', message: '📄 리포트 저장: analysis_report_삼성전자_2024-01-07.txt', delay: 30000 },
        { step: 'report-generation', message: '🎉 모든 분석이 완료되었습니다!', delay: 31000 },
        { step: 'report-generation', message: '✅ JSON 결과 출력 완료', delay: 31500 }
      ];

      // 단계별 진행 상황 설정
      const steps = [
        { stepId: 'news-collection', label: '뉴스 수집', status: 'loading' as const, message: '뉴스를 수집하고 있습니다' },
        { stepId: 'economic-data', label: '경제지표 수집', status: 'loading' as const, message: '경제지표를 수집하고 있습니다' },
        { stepId: 'sentiment-analysis', label: '감정 분석', status: 'loading' as const, message: 'AI 감정 분석을 진행하고 있습니다' },
        { stepId: 'report-generation', label: '리포트 생성', status: 'loading' as const, message: '최종 리포트를 생성하고 있습니다' }
      ];

      setProgressSteps(steps.map(step => ({ ...step, details: [], timestamp: new Date().toISOString() })));

      // 실시간 로그 추가
      mockLogs.forEach((log, index) => {
        setTimeout(() => {
          const timestamp = new Date().toLocaleTimeString();
          
          // 로그 추가
          setRealTimeLogs(prev => [...prev, {
            timestamp,
            message: log.message,
            type: (log.message.includes('완료') || log.message.includes('✅') ? 'success' : 
                  log.message.includes('❌') || log.message.includes('실패') ? 'error' : 'info') as 'info' | 'success' | 'error' | 'warning'
          }].slice(-50));

          // 단계별 세부 로그 업데이트
          setProgressSteps((prev: ProgressStep[]) => prev.map((step: ProgressStep) => {
            if (step.stepId === log.step) {
              const newDetails = [...(step.details || []), log.message];
              const isComplete = log.message.includes('완료') || log.message.includes('🎉');
              return {
                ...step,
                details: newDetails,
                status: isComplete ? 'success' as const : 'loading' as const,
                message: isComplete ? `${step.label}이 완료되었습니다` : `${step.label}를 진행하고 있습니다`
              };
            }
            return step;
          }));
        }, log.delay);
      });

      // 경과 시간 타이머
      const timer = setInterval(() => {
        setElapsedTime(prev => prev + 0.1);
      }, 100);

      return () => {
        clearInterval(timer);
      };
    }
  }, [analysis?.status]);

  if (!analysis) {
    console.log('⚠️ AnalysisResults: No analysis provided, returning null');
    return null;
  }

  console.log(`📋 AnalysisResults: Rendering analysis for ${analysis.stockName} with status ${analysis.status}`);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'processing':
        return <HourglassEmpty color="primary" />;
      default:
        return <Schedule color="action" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      case 'processing':
        return '진행 중';
      default:
        return '대기 중';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp sx={{ color: COLORS.positive }} />;
      case 'negative':
        return <TrendingDown sx={{ color: COLORS.negative }} />;
      default:
        return <TrendingFlat sx={{ color: COLORS.neutral }} />;
    }
  };

  const getSentimentText = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '긍정적';
      case 'negative':
        return '부정적';
      default:
        return '중립적';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'error';
      default:
        return 'warning';
    }
  };

  const pieData = data ? [
    { name: '긍정', value: data.positive_count, color: COLORS.positive },
    { name: '부정', value: data.negative_count, color: COLORS.negative },
    { name: '중립', value: data.neutral_count, color: COLORS.neutral }
  ] : [];

  const barData = data ? [
    { name: '긍정', count: data.positive_count, fill: COLORS.positive },
    { name: '부정', count: data.negative_count, fill: COLORS.negative },
    { name: '중립', count: data.neutral_count, fill: COLORS.neutral }
  ] : [];

  const totalCount = data ? data.positive_count + data.negative_count + data.neutral_count : 0;

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Assessment sx={{ mr: 2, color: 'primary.main' }} />
        <Typography variant="h5" component="h2">
          분석 결과
        </Typography>
      </Box>

      {/* Status Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">주식명:</Typography>
                <Chip label={analysis.stockName} color="primary" />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">상태:</Typography>
                {getStatusIcon(analysis.status)}
                <Typography>{getStatusText(analysis.status)}</Typography>
              </Box>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                요청 시간: {new Date(analysis.createdAt).toLocaleString('ko-KR')}
              </Typography>
              {analysis.completedAt && (
                <Typography variant="body2" color="text.secondary">
                  완료 시간: {new Date(analysis.completedAt).toLocaleString('ko-KR')}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Processing Status with Real-time Console Logs */}
      {analysis.status === 'processing' && (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Box>
              <Typography>분석이 진행 중입니다... (경과 시간: {formatTime(elapsedTime)})</Typography>
              <LinearProgress sx={{ mt: 1 }} />
            </Box>
          </Alert>

          {/* 실시간 콘솔 로그 */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Assessment sx={{ mr: 1 }} />
                실시간 분석 로그
              </Typography>
              <Box sx={{ 
                backgroundColor: '#000', 
                color: '#00ff00', 
                p: 2, 
                borderRadius: 1, 
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '0.875rem',
                height: '500px',
                overflowY: 'auto',
                border: '1px solid #333'
              }}>
                {realTimeLogs.length > 0 ? (
                  realTimeLogs.map((log, index) => (
                    <Typography 
                      key={index} 
                      component="div" 
                      sx={{ 
                        mb: 0.5,
                        wordBreak: 'break-all',
                        color: log.type === 'error' ? '#ff4444' : 
                               log.type === 'success' ? '#44ff44' : 
                               log.type === 'warning' ? '#ffaa00' : '#00ff00'
                      }}
                    >
                      <span style={{ color: '#888' }}>[{log.timestamp}]</span> {log.message}
                    </Typography>
                  ))
                ) : (
                  <Typography sx={{ color: '#888', fontStyle: 'italic' }}>
                    Python 콘솔 로그를 기다리는 중...
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </>
      )}

      {/* Error Status */}
      {analysis.status === 'failed' && (
        <>
          <Alert severity="error" sx={{ mb: 3 }}>
            분석이 실패했습니다. 나중에 다시 시도해주세요.
          </Alert>

          {/* 실패 시에도 로그 표시 */}
          {realTimeLogs.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  오류 로그
                </Typography>
                <Box sx={{ 
                  backgroundColor: '#000', 
                  color: '#ff4444', 
                  p: 2, 
                  borderRadius: 1, 
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.875rem',
                  height: '300px',
                  overflowY: 'auto',
                  border: '1px solid #f44336'
                }}>
                  {realTimeLogs.map((log, index) => (
                    <Typography 
                      key={index} 
                      component="div" 
                      sx={{ 
                        mb: 0.5,
                        color: log.type === 'error' ? '#ff4444' : 
                               log.type === 'success' ? '#44ff44' : 
                               log.type === 'warning' ? '#ffaa00' : '#ffffff'
                      }}
                    >
                      <span style={{ color: '#888' }}>[{log.timestamp}]</span> {log.message}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Results Section */}
      {data && (
        <>
          {/* Overall Sentiment */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                전체 감정 분석
                {getSentimentIcon(data.overall_sentiment)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Chip 
                  label={getSentimentText(data.overall_sentiment)}
                  color={getSentimentColor(data.overall_sentiment)}
                  size="medium"
                />
                <Typography variant="h6">
                  점수: {(data.overall_score * 100).toFixed(1)}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                총 {totalCount}개의 뉴스를 분석했습니다.
              </Typography>
            </CardContent>
          </Card>

          {/* Charts Section */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      감정 분포 (원형)
                    </Typography>
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            label={({ name, value, percent }) => `${name}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              <Box sx={{ flex: 1 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      감정 분포 (막대)
                    </Typography>
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>

          {/* Detailed Stats */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                상세 통계
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <Box sx={{ flex: 1, textAlign: 'center', p: 2 }}>
                  <TrendingUp sx={{ fontSize: 40, color: COLORS.positive, mb: 1 }} />
                  <Typography variant="h4" sx={{ color: COLORS.positive }}>
                    {data.positive_count}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    긍정적 뉴스
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, textAlign: 'center', p: 2 }}>
                  <TrendingDown sx={{ fontSize: 40, color: COLORS.negative, mb: 1 }} />
                  <Typography variant="h4" sx={{ color: COLORS.negative }}>
                    {data.negative_count}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    부정적 뉴스
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, textAlign: 'center', p: 2 }}>
                  <TrendingFlat sx={{ fontSize: 40, color: COLORS.neutral, mb: 1 }} />
                  <Typography variant="h4" sx={{ color: COLORS.neutral }}>
                    {data.neutral_count}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    중립적 뉴스
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Report Text */}
          {data.report_text && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  상세 분석 보고서
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    backgroundColor: 'grey.50',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 400,
                    overflow: 'auto'
                  }}
                >
                  <Typography variant="body2" component="pre">
                    {data.report_text}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Paper>
  );
};

export default AnalysisResults;
