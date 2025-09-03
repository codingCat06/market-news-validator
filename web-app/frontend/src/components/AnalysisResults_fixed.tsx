import React, { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Card,
  CardContent,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Assessment,
  AccessTime
} from '@mui/icons-material';
import { AnalysisRequest, AnalysisData } from '../App';
import { ProgressStep } from './StockAnalysisForm';
import UnifiedConsole from './UnifiedConsole';

interface AnalysisResultsProps {
  analysis: AnalysisRequest | null;
  data: AnalysisData | null;
  progressSteps: ProgressStep[];
}

const COLORS = {
  positive: '#4caf50',
  negative: '#f44336',
  neutral: '#ff9800'
};

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysis, data, progressSteps }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  // 경과 시간 계산
  useEffect(() => {
    if (analysis && analysis.status === 'processing') {
      const startTime = new Date(analysis.createdAt).getTime();
      
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setElapsedTime(0);
    }
  }, [analysis]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography>분석이 진행 중입니다... 실시간 진행 상황을 확인하세요.</Typography>
          <LinearProgress sx={{ mt: 1 }} />
        </Alert>

        {/* UnifiedConsole 표시 */}
        {progressSteps.length > 0 && (
          <UnifiedConsole steps={progressSteps} />
        )}
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

        {/* 실패 시에도 진행 상황 표시 */}
        {progressSteps.length > 0 && (
          <UnifiedConsole steps={progressSteps} />
        )}
      </Paper>
    );
  }

  if (!data) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          분석 결과를 기다리는 중...
        </Typography>
      </Paper>
    );
  }

  // 완료된 분석 결과 표시
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

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h2">
          📈 {analysis.stockName} 분석 결과
        </Typography>
        <Chip 
          label="분석 완료" 
          color="success" 
          variant="outlined"
        />
      </Box>

      {/* 전체 감정 점수 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {getSentimentIcon(data.overall_sentiment)}
            <Typography variant="h6" sx={{ ml: 1 }}>
              전체 감정 분석: <span style={{ color: getSentimentColor(data.overall_sentiment) }}>
                {getSentimentText(data.overall_sentiment)}
              </span>
            </Typography>
          </Box>
          
          <Typography variant="body1" sx={{ mb: 2 }}>
            감정 점수: <strong>{data.overall_score.toFixed(2)}</strong>
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip 
              label={`긍정: ${data.positive_count}개`} 
              sx={{ backgroundColor: COLORS.positive, color: 'white' }}
            />
            <Chip 
              label={`부정: ${data.negative_count}개`} 
              sx={{ backgroundColor: COLORS.negative, color: 'white' }}
            />
            <Chip 
              label={`중립: ${data.neutral_count}개`} 
              sx={{ backgroundColor: COLORS.neutral, color: 'white' }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* 분석 리포트 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Assessment sx={{ mr: 1 }} />
            상세 분석 리포트
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {data.report_text}
          </Typography>
        </CardContent>
      </Card>

      {/* 분석 과정 표시 (완료 후에도) */}
      {progressSteps.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            분석 과정
          </Typography>
          <UnifiedConsole steps={progressSteps} />
        </Box>
      )}
    </Paper>
  );
};

export default AnalysisResults;
