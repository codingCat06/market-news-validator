import React, { useState, useEffect } from 'react';
import { 
  Accordion, 
  AccordionSummary, 
  AccordionDetails, 
  Typography, 
  Box, 
  Chip,
  LinearProgress
} from '@mui/material';
import { ExpandMore, CheckCircle, Error, Schedule, Autorenew } from '@mui/icons-material';

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
}

interface ProgressStackProps {
  steps: ProgressStep[];
  className?: string;
}

const ProgressStack: React.FC<ProgressStackProps> = ({ steps, className = '' }) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [elapsedTimes, setElapsedTimes] = useState<{ [key: string]: number }>({});
  const logContainerRefs = React.useRef<{ [key: string]: HTMLElement | null }>({});

  // 자동 스크롤 함수
  const scrollToBottom = (stepId: string) => {
    const container = logContainerRefs.current[stepId];
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  // 실시간 경과 시간 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      const newElapsedTimes: { [key: string]: number } = {};
      
      steps.forEach(step => {
        if (step.startTime) {
          const endTime = step.endTime || new Date();
          newElapsedTimes[step.id] = (endTime.getTime() - step.startTime.getTime()) / 1000;
        }
      });
      
      setElapsedTimes(newElapsedTimes);
    }, 100); // 0.1초마다 업데이트

    return () => clearInterval(interval);
  }, [steps]);

  // 현재 진행 중인 단계는 자동으로 확장
  useEffect(() => {
    const loadingStep = steps.find(step => step.status === 'loading');
    if (loadingStep) {
      setExpandedSteps(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.add(loadingStep.id);
        return newSet;
      });
    }
  }, [steps]);

  // 로그가 업데이트되면 자동 스크롤
  useEffect(() => {
    steps.forEach(step => {
      if (step.logs && step.logs.length > 0 && step.status === 'loading') {
        setTimeout(() => scrollToBottom(step.id), 100);
      }
    });
  }, [steps]);

  const getStatusIcon = (status: ProgressStep['status']) => {
    switch (status) {
      case 'waiting':
        return <Schedule color="action" />;
      case 'loading':
        return <Autorenew color="primary" sx={{ animation: 'spin 1s linear infinite' }} />;
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Schedule color="action" />;
    }
  };

  const getStatusColor = (status: ProgressStep['status']): "default" | "primary" | "success" | "error" => {
    switch (status) {
      case 'waiting':
        return 'default';
      case 'loading':
        return 'primary';
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatElapsedTime = (stepId: string) => {
    const elapsed = elapsedTimes[stepId];
    if (elapsed !== undefined) {
      return `${elapsed.toFixed(1)}초`;
    }
    return '';
  };

  const handleAccordionChange = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(Array.from(prev));
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  return (
    <Box className={`progress-stack ${className}`} sx={{ width: '100%', mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        분석 진행상황
      </Typography>
      
      {steps.map((step, index) => (
        <Accordion 
          key={step.id}
          expanded={expandedSteps.has(step.id)}
          onChange={() => handleAccordionChange(step.id)}
          sx={{ 
            mb: 1, 
            '&:before': { display: 'none' },
            boxShadow: 1
          }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Box sx={{ mr: 2 }}>
                {getStatusIcon(step.status)}
              </Box>
              
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  {step.label}
                </Typography>
                
                {step.message && (
                  <Typography variant="body2" color="text.secondary">
                    {step.message}
                  </Typography>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip 
                  label={step.status === 'waiting' ? '대기' : 
                        step.status === 'loading' ? '진행중' :
                        step.status === 'success' ? '완료' : '오류'}
                  color={getStatusColor(step.status)}
                  size="small"
                />
                
                {step.startTime && (
                  <Typography variant="caption" color="text.secondary">
                    {formatElapsedTime(step.id)}
                  </Typography>
                )}
              </Box>
            </Box>
          </AccordionSummary>
          
          <AccordionDetails>
            {step.status === 'loading' && (
              <LinearProgress sx={{ mb: 2 }} />
            )}
            
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>상태:</strong> {step.status}
              </Typography>
              
              {step.startTime && (
                <Typography variant="body2" gutterBottom>
                  <strong>시작 시간:</strong> {step.startTime.toLocaleTimeString()}
                </Typography>
              )}
              
              {step.endTime && (
                <Typography variant="body2" gutterBottom>
                  <strong>완료 시간:</strong> {step.endTime.toLocaleTimeString()}
                </Typography>
              )}
              
              {step.startTime && (
                <Typography variant="body2" gutterBottom>
                  <strong>경과 시간:</strong> {formatElapsedTime(step.id)}
                </Typography>
              )}
              
              {step.logs && step.logs.length > 0 ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>실시간 로그:</strong>
                  </Typography>
                  {/* GitHub Actions 스타일 실시간 콘솔 */}
                  <Box 
                    ref={(el) => { logContainerRefs.current[step.id] = el as HTMLElement | null; }}
                    sx={{ 
                      backgroundColor: '#0d1117', 
                      color: '#c9d1d9', 
                      p: 2, 
                      borderRadius: 1, 
                      fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                      fontSize: '0.75rem',
                      height: '250px',
                      overflowY: 'auto',
                      border: '1px solid #30363d',
                      position: 'relative',
                      '&::-webkit-scrollbar': {
                        width: '8px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: '#161b22',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: '#30363d',
                        borderRadius: '4px',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        background: '#484f58',
                      }
                    }}>
                    {step.logs.map((logEntry, logIndex) => (
                      <Box 
                        key={logIndex} 
                        sx={{ 
                          mb: 0.25,
                          display: 'flex',
                          alignItems: 'flex-start',
                          wordBreak: 'break-all',
                          '&:hover': {
                            backgroundColor: 'rgba(56, 139, 253, 0.1)'
                          }
                        }}
                      >
                        <Typography 
                          component="span"
                          sx={{ 
                            color: '#7d8590',
                            fontSize: '0.6875rem',
                            minWidth: '65px',
                            mr: 1,
                            fontFamily: 'inherit',
                            userSelect: 'none'
                          }}
                        >
                          {new Date(logEntry.timestamp).toLocaleTimeString()}
                        </Typography>
                        <Typography 
                          component="span"
                          sx={{ 
                            color: logEntry.type === 'error' ? '#f85149' : 
                                   logEntry.type === 'success' ? '#3fb950' : 
                                   logEntry.type === 'warning' ? '#d29922' : '#79c0ff',
                            fontSize: '0.75rem',
                            fontFamily: 'inherit',
                            flex: 1,
                            lineHeight: 1.2
                          }}
                        >
                          {logEntry.message}
                        </Typography>
                      </Box>
                    ))}
                    
                    {/* 진행 중일 때 깜빡이는 커서 */}
                    {step.status === 'loading' && (
                      <Box 
                        sx={{ 
                          position: 'absolute',
                          bottom: 10,
                          left: 16,
                          width: '8px',
                          height: '12px',
                          backgroundColor: '#79c0ff',
                          animation: 'blink 1s infinite',
                          '@keyframes blink': {
                            '0%, 50%': { opacity: 1 },
                            '51%, 100%': { opacity: 0 }
                          }
                        }}
                      />
                    )}
                  </Box>
                </Box>
              ) : step.status === 'loading' ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>실시간 로그:</strong>
                  </Typography>
                  {/* 로그 대기 중인 상태 */}
                  <Box sx={{ 
                    backgroundColor: '#0d1117', 
                    color: '#c9d1d9', 
                    p: 2, 
                    borderRadius: 1, 
                    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                    fontSize: '0.75rem',
                    height: '250px',
                    overflowY: 'auto',
                    border: '1px solid #30363d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Typography sx={{ color: '#7d8590', fontStyle: 'italic' }}>
                      로그를 기다리는 중...
                    </Typography>
                    {/* 깜빡이는 커서 */}
                    <Box 
                      sx={{ 
                        ml: 1,
                        width: '8px',
                        height: '12px',
                        backgroundColor: '#79c0ff',
                        animation: 'blink 1s infinite'
                      }}
                    />
                  </Box>
                </Box>
              ) : null}
              
              {step.subSteps && step.subSteps.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>하위 단계:</strong>
                  </Typography>
                  {step.subSteps.map((subStep) => (
                    <Box key={subStep.id} sx={{ display: 'flex', alignItems: 'center', py: 0.5, pl: 2 }}>
                      {getStatusIcon(subStep.status)}
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {subStep.label}
                      </Typography>
                      {subStep.message && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          - {subStep.message}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
      
      {/* CSS for animation */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Box>
  );
};

export default ProgressStack;
