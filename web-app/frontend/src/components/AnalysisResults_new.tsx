import React, { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ListItemIcon
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Assessment,
  CheckCircleOutline,
  ErrorOutline,
  HourglassEmpty,
  ExpandMore,
  AccessTime
} from '@mui/icons-material';
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
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [realTimeLogs, setRealTimeLogs] = useState<LogEntry[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    if (analysis && analysis.status === 'processing') {
      // WebSocket 연결 설정
      const newSocket = io('http://localhost:3001');
      setSocket(newSocket);

      // 단계별 진행 상황 초기 설정 (모두 대기 상태로)
      const steps = [
        { stepId: 'news-collection', label: '뉴스 수집', status: 'loading' as const, message: '뉴스 수집 대기 중' },
        { stepId: 'economic-data', label: '경제지표 수집', status: 'loading' as const, message: '경제지표 수집 대기 중' },
        { stepId: 'sentiment-analysis', label: '감정 분석', status: 'loading' as const, message: '감정 분석 대기 중' },
        { stepId: 'report-generation', label: '리포트 생성', status: 'loading' as const, message: '리포트 생성 대기 중' },
        { stepId: 'save', label: '결과 저장', status: 'loading' as const, message: '결과 저장 대기 중' },
        { stepId: 'complete', label: '분석 완료', status: 'loading' as const, message: '분석 완료 대기 중' }
      ];

      setProgressSteps(steps.map(step => ({ ...step, details: [], timestamp: new Date().toISOString() })));
      setRealTimeLogs([]);

      // 실시간 로그 수신
      newSocket.on('realtime-log', (logEntry: LogEntry) => {
        setRealTimeLogs(prev => [...prev, logEntry].slice(-100)); // 최대 100개 로그 유지
      });

      // 진행 상황 업데이트 수신
      newSocket.on('progress', (progressData: any) => {
        setProgressSteps(prev => prev.map(step => {
          if (step.stepId === progressData.stepId) {
            return {
              ...step,
              status: progressData.status,
              message: progressData.message,
              details: progressData.details || step.details,
              timestamp: progressData.timestamp
            };
          }
          return step;
        }));
      });

      // 시간 카운터
      const startTime = Date.now();
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      return () => {
        clearInterval(timer);
        newSocket.disconnect();
      };
    }
  }, [analysis]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutline sx={{ color: 'success.main' }} />;
      case 'error':
        return <ErrorOutline sx={{ color: 'error.main' }} />;
      default:
        return <HourglassEmpty sx={{ color: 'warning.main' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return '#4caf50';
      case 'error':
        return '#f44336';
      case 'warning':
        return '#ff9800';
      default:
        return '#2196f3';
    }
  };

  if (!analysis) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          분석을 시작하려면 종목을 검색하세요
        </Typography>
      </Paper>
    );
  }

  if (analysis.status === 'processing') {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" component="h2">
            📊 {analysis.stockName} 분석 진행 중
          </Typography>
          <Chip 
            icon={<AccessTime />} 
            label={`경과 시간: ${formatTime(elapsedTime)}`} 
            color="primary" 
            variant="outlined"
          />
        </Box>

        {/* 실시간 진행 상황 아코디언 */}
        <Box sx={{ mb: 3 }}>
          {progressSteps.map((step, index) => (
            <Accordion key={step.stepId} defaultExpanded={true} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getStatusIcon(step.status)}
                  </ListItemIcon>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {step.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {step.message}
                    </Typography>
                  </Box>
                  <Chip 
                    label={step.status === 'success' ? '완료' : step.status === 'error' ? '오류' : '진행 중'} 
                    color={getStatusColor(step.status) as any}
                    size="small"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ 
                  backgroundColor: '#1e1e1e', 
                  color: '#fff', 
                  p: 2, 
                  borderRadius: 1, 
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {step.details && step.details.length > 0 ? (
                    step.details.map((detail, idx) => (
                      <Typography 
                        key={idx} 
                        component="div" 
                        sx={{ 
                          mb: 0.5,
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {detail}
                      </Typography>
                    ))
                  ) : (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      아직 로그가 없습니다...
                    </Typography>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        {/* 전체 실시간 로그 (콘솔 스타일) */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Assessment sx={{ mr: 1 }} />
            실시간 로그
          </Typography>
          <Box sx={{ 
            backgroundColor: '#000', 
            color: '#00ff00', 
            p: 2, 
            borderRadius: 1, 
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '0.875rem',
            height: '400px',
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
                    color: getLogTypeColor(log.type)
                  }}
                >
                  <span style={{ color: '#888' }}>[{log.timestamp}]</span> {log.message}
                </Typography>
              ))
            ) : (
              <Typography sx={{ color: '#888', fontStyle: 'italic' }}>
                로그를 기다리는 중...
              </Typography>
            )}
          </Box>
        </Paper>

        <Alert severity="info" sx={{ mt: 2 }}>
          분석이 완료되면 자동으로 결과가 표시됩니다. 잠시만 기다려주세요.
        </Alert>
      </Paper>
    );
  }

  if (analysis.status === 'failed') {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">분석 중 오류가 발생했습니다</Typography>
          <Typography>분석이 실패했습니다. 다시 시도해주세요.</Typography>
        </Alert>
        
        {/* 에러 발생 시에도 로그 표시 */}
        {realTimeLogs.length > 0 && (
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              오류 로그
            </Typography>
            <Box sx={{ 
              backgroundColor: '#1e1e1e', 
              color: '#fff', 
              p: 2, 
              borderRadius: 1, 
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {realTimeLogs.map((log, index) => (
                <Typography 
                  key={index} 
                  component="div" 
                  sx={{ 
                    mb: 0.5,
                    color: getLogTypeColor(log.type)
                  }}
                >
                  <span style={{ color: '#888' }}>[{log.timestamp}]</span> {log.message}
                </Typography>
              ))}
            </Box>
          </Paper>
        )}
      </Paper>
    );
  }

  if (!data) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="warning">
          분석 데이터를 불러올 수 없습니다.
        </Alert>
      </Paper>
    );
  }

  // 분석 완료 시 결과 표시
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

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return COLORS.positive;
      case 'negative':
        return COLORS.negative;
      default:
        return COLORS.neutral;
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <Assessment sx={{ mr: 2 }} />
        {analysis.stockName} 분석 결과
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* 전체 감정 점수 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              전체 감정
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {getSentimentIcon(data.overall_sentiment)}
              <Typography variant="h4" sx={{ ml: 1, color: getSentimentColor(data.overall_sentiment) }}>
                {data.overall_sentiment === 'positive' ? '긍정적' : 
                 data.overall_sentiment === 'negative' ? '부정적' : '중립적'}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={data.overall_score * 100} 
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              분석 점수: {(data.overall_score * 100).toFixed(1)}%
            </Typography>
          </CardContent>
        </Card>

        {/* 감정 분포 */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                감정 분포
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ color: COLORS.positive }}>긍정</Typography>
                  <Chip label={data.positive_count} sx={{ backgroundColor: COLORS.positive, color: 'white' }} size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ color: COLORS.negative }}>부정</Typography>
                  <Chip label={data.negative_count} sx={{ backgroundColor: COLORS.negative, color: 'white' }} size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ color: COLORS.neutral }}>중립</Typography>
                  <Chip label={data.neutral_count} sx={{ backgroundColor: COLORS.neutral, color: 'white' }} size="small" />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                뉴스 통계
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>총 뉴스</Typography>
                  <Chip label={data.positive_count + data.negative_count + data.neutral_count} color="primary" size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography>분석 완료</Typography>
                  <Chip label={data.positive_count + data.negative_count + data.neutral_count} color="secondary" size="small" />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* 분석 리포트 */}
        {data.report_text && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                분석 리포트
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {data.report_text}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        )}

        {/* 분석 정보 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              분석 정보
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary">분석 일시</Typography>
                <Typography variant="body1">{new Date(analysis.createdAt).toLocaleString()}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary">상태</Typography>
                <Chip label="완료" color="success" size="small" />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Paper>
  );
};

export default AnalysisResults;
