import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Paper,
  Chip
} from '@mui/material';
import { CheckCircle, Error, Schedule, Autorenew, Info, Warning } from '@mui/icons-material';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'waiting' | 'loading' | 'success' | 'error';
  message?: string;
  startTime?: Date;
  endTime?: Date;
  logs?: LogEntry[];
  subSteps?: ProgressStep[];
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  stepId?: string;
}

interface UnifiedConsoleProps {
  steps: ProgressStep[];
  className?: string;
}

const UnifiedConsole: React.FC<UnifiedConsoleProps> = ({ steps, className = '' }) => {
  const [allLogs, setAllLogs] = useState<(LogEntry & { stepLabel?: string; stepId: string })[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 모든 로그를 시간순으로 통합
  useEffect(() => {
    const combinedLogs: (LogEntry & { stepLabel?: string; stepId: string })[] = [];
    
    steps.forEach(step => {
      if (step.logs && step.logs.length > 0) {
        step.logs.forEach(log => {
          combinedLogs.push({
            ...log,
            stepLabel: step.label,
            stepId: step.id
          });
        });
      }
    });

    // 시간순으로 정렬
    combinedLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    setAllLogs(combinedLogs);
  }, [steps]);

  // 자동 스크롤
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [allLogs]);

  // 경과 시간 업데이트
  useEffect(() => {
    const startTime = steps.find(s => s.startTime)?.startTime;
    if (!startTime) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [steps]);

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle sx={{ fontSize: 16, color: '#4caf50' }} />;
      case 'error': return <Error sx={{ fontSize: 16, color: '#f44336' }} />;
      case 'warning': return <Warning sx={{ fontSize: 16, color: '#ff9800' }} />;
      default: return <Info sx={{ fontSize: 16, color: '#2196f3' }} />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success': return '#4caf50';
      case 'error': return '#f44336';
      case 'warning': return '#ff9800';
      default: return '#e0e0e0';
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle sx={{ fontSize: 20, color: '#4caf50' }} />;
      case 'error': return <Error sx={{ fontSize: 20, color: '#f44336' }} />;
      case 'loading': return <Autorenew sx={{ fontSize: 20, color: '#2196f3', animation: 'spin 1s linear infinite' }} />;
      default: return <Schedule sx={{ fontSize: 20, color: '#9e9e9e' }} />;
    }
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#4caf50';
      case 'error': return '#f44336';
      case 'loading': return '#2196f3';
      default: return '#9e9e9e';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Box className={className} sx={{ width: '100%' }}>
      {/* 헤더 - 진행 상황 요약 */}
      <Paper elevation={2} sx={{ p: 2, mb: 2, backgroundColor: '#1e1e1e', color: '#fff' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>
            📊 분석 진행 상황
          </Typography>
          <Chip 
            label={`경과 시간: ${formatTime(elapsedTime)}`}
            sx={{ 
              backgroundColor: '#333', 
              color: '#fff',
              fontFamily: 'monospace' 
            }}
          />
        </Box>

        {/* 단계별 상태 요약 */}
        <Box display="flex" flexWrap="wrap" gap={1}>
          {steps.map(step => (
            <Chip
              key={step.id}
              icon={getStepStatusIcon(step.status)}
              label={step.label}
              sx={{
                backgroundColor: step.status === 'loading' ? '#333' : 'transparent',
                color: getStepStatusColor(step.status),
                border: `1px solid ${getStepStatusColor(step.status)}`,
                '& .MuiChip-icon': {
                  color: getStepStatusColor(step.status)
                }
              }}
              variant="outlined"
            />
          ))}
        </Box>
      </Paper>

      {/* 통합 콘솔 로그 */}
      <Paper 
        elevation={2} 
        sx={{ 
          backgroundColor: '#000', 
          color: '#fff',
          border: '1px solid #333',
          borderRadius: 1
        }}
      >
        {/* 콘솔 헤더 */}
        <Box 
          sx={{ 
            backgroundColor: '#1a1a1a', 
            px: 2, 
            py: 1, 
            borderBottom: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27ca3f' }} />
          </Box>
          <Typography variant="subtitle2" sx={{ color: '#888', fontFamily: 'monospace' }}>
            실시간 분석 로그 - {allLogs.length}개 메시지
          </Typography>
        </Box>

        {/* 로그 내용 */}
        <Box
          ref={logContainerRef}
          sx={{
            height: '400px',
            overflowY: 'auto',
            p: 1,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '13px',
            lineHeight: 1.4,
            '&::-webkit-scrollbar': {
              width: '8px'
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#1a1a1a'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#444',
              borderRadius: '4px'
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: '#666'
            }
          }}
        >
          {allLogs.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              color: '#666'
            }}>
              <Typography variant="body2">
                분석을 시작하면 실시간 로그가 여기에 표시됩니다...
              </Typography>
            </Box>
          ) : (
            allLogs.map((log, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  py: 0.5,
                  '&:hover': {
                    backgroundColor: '#1a1a1a'
                  }
                }}
              >
                {/* 타임스탬프 */}
                <Typography
                  sx={{
                    color: '#666',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    minWidth: '60px',
                    flexShrink: 0
                  }}
                >
                  {formatTimestamp(log.timestamp)}
                </Typography>

                {/* 로그 아이콘 */}
                <Box sx={{ mt: 0.2, flexShrink: 0 }}>
                  {getLogIcon(log.type)}
                </Box>

                {/* 단계 라벨 */}
                {log.stepLabel && (
                  <Chip
                    label={log.stepLabel}
                    size="small"
                    sx={{
                      height: '20px',
                      fontSize: '10px',
                      backgroundColor: 'transparent',
                      border: `1px solid ${getLogColor(log.type)}`,
                      color: getLogColor(log.type),
                      '& .MuiChip-label': {
                        px: 1
                      }
                    }}
                  />
                )}

                {/* 로그 메시지 */}
                <Typography
                  sx={{
                    color: getLogColor(log.type),
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    flex: 1,
                    wordBreak: 'break-word'
                  }}
                >
                  {log.message}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Paper>

      {/* CSS 애니메이션 */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};

export default UnifiedConsole;
