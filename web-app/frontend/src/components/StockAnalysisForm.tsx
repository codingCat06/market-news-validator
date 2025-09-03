import React, { useState, useRef, useEffect } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Slider,
  Button,
  Box,
  Alert,
  CircularProgress,
  FormControl,
  Stack
} from '@mui/material';
import { Analytics, PlayArrow } from '@mui/icons-material';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';
import { AnalysisRequest, AnalysisData } from '../App';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'waiting' | 'loading' | 'success' | 'error';
  message?: string;
  startTime?: Date;
  endTime?: Date;
  logs?: Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
  }>;
}

interface StockAnalysisFormProps {
  onAnalysisStart: (request: AnalysisRequest) => void;
  onAnalysisComplete: (data: AnalysisData) => void;
  onAnalysisError: (error: string) => void;
  onProgressUpdate?: (steps: ProgressStep[]) => void; // 새로운 prop 추가
  currentAnalysis: AnalysisRequest | null;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:3001';

const StockAnalysisForm: React.FC<StockAnalysisFormProps> = ({
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError,
  onProgressUpdate,
  currentAnalysis
}) => {
  const [stockName, setStockName] = useState('');
  const [daysBack, setDaysBack] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  
  // WebSocket 관리를 위한 ref
  const socketRef = useRef<Socket | null>(null);
  const currentRequestIdRef = useRef<string | null>(null); // 현재 분석의 requestId 저장

  // MongoDB ObjectId 형식의 ID 생성 함수
  const generateObjectId = (): string => {
    const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
    const randomBytes = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return timestamp + randomBytes.substring(0, 16);
  };

  // WebSocket 연결을 보장하는 함수
  const ensureWebSocketConnection = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (socketRef.current && socketRef.current.connected) {
        console.log('✅ WebSocket already connected');
        resolve();
        return;
      }

      console.log('🔌 WebSocket 연결 시도 중...');
      
      // 기존 연결이 있다면 정리
      cleanupWebSocket();
      
      // 새 연결 생성
      initializeWebSocket();
      
      if (!socketRef.current) {
        reject(new Error('WebSocket 초기화 실패'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket 연결 타임아웃 (10초)'));
      }, 10000);

      const handleConnect = () => {
        console.log('✅ WebSocket 연결 보장 완료');
        clearTimeout(timeout);
        socketRef.current?.off('connect', handleConnect);
        socketRef.current?.off('connect_error', handleError);
        resolve();
      };

      const handleError = (error: any) => {
        console.log('💥 WebSocket 연결 보장 실패:', error);
        clearTimeout(timeout);
        socketRef.current?.off('connect', handleConnect);
        socketRef.current?.off('connect_error', handleError);
        reject(new Error(`WebSocket 연결 실패: ${error.message || error}`));
      };

      socketRef.current.on('connect', handleConnect);
      socketRef.current.on('connect_error', handleError);

      if (socketRef.current.connected) {
        handleConnect();
      }
    });
  };

  // Room Join을 보장하는 함수
  const ensureRoomJoin = (requestId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        reject(new Error('WebSocket이 연결되지 않음'));
        return;
      }

      const timeout = setTimeout(() => {
        console.log('⏰ Room join 타임아웃 (10초)');
        reject(new Error('Room join 타임아웃'));
      }, 10000); // 10초 타임아웃으로 증가

      const handleJoined = (roomId: string) => {
        console.log(`✅ Room join 완료 응답 수신: ${roomId}`);
        if (roomId === requestId) {
          console.log(`🎯 Room join 성공: analysis-${roomId}`);
          clearTimeout(timeout);
          socketRef.current?.off('joined-analysis', handleJoined);
          resolve();
        } else {
          console.log(`⚠️ Room join 응답의 requestId가 다름: 기대=${requestId}, 받음=${roomId}`);
        }
      };

      socketRef.current.on('joined-analysis', handleJoined);
      
      // Room join 요청 - 재시도 로직 추가
      console.log(`📥 Room join 요청: analysis-${requestId}`);
      currentRequestIdRef.current = requestId;
      
      // 즉시 join 요청
      socketRef.current.emit('join-analysis', requestId);
      
      // 1초 후 재시도 (연결이 불안정할 수 있음)
      setTimeout(() => {
        if (socketRef.current && socketRef.current.connected) {
          console.log(`🔄 Room join 재시도: analysis-${requestId}`);
          socketRef.current.emit('join-analysis', requestId);
        }
      }, 1000);
    });
  };

  // 컴포넌트 마운트 시 WebSocket 초기화
  useEffect(() => {
    console.log('🔧 StockAnalysisForm: Component mounted, initializing WebSocket...');
    initializeWebSocket();
    
    return () => {
      console.log('🧹 StockAnalysisForm: Component unmounting, cleaning up...');
      cleanupWebSocket();
    };
  }, []);

  // progressSteps가 변경될 때마다 부모 컴포넌트로 전달
  useEffect(() => {
    if (onProgressUpdate) {
      onProgressUpdate(progressSteps);
    }
  }, [progressSteps, onProgressUpdate]);

  // WebSocket 연결 초기화 (컴포넌트 마운트 시)
  const initializeWebSocket = () => {
    console.log('🔌 StockAnalysisForm: Initializing WebSocket connection...');
    
    // 기존 연결이 있다면 정리
    cleanupWebSocket();
    
    try {
      console.log('🌐 연결할 WebSocket URL:', WEBSOCKET_URL);
      
      socketRef.current = io(WEBSOCKET_URL, {
        transports: ['websocket', 'polling'], // 여러 전송 방식 허용
        timeout: 20000,
        forceNew: true, // 새 연결 강제
        autoConnect: true, // 자동 연결
        reconnection: true, // 재연결 활성화
        reconnectionDelay: 1000, // 재연결 지연 시간
        reconnectionAttempts: 5, // 재연결 시도 횟수
        randomizationFactor: 0.5
      });
      
      socketRef.current.on('connect', () => {
        console.log('✅ StockAnalysisForm: WebSocket connected successfully');
        console.log('🔗 Socket ID:', socketRef.current?.id);
        console.log('🌐 WebSocket URL:', WEBSOCKET_URL);
        console.log('🔍 Current requestId:', currentRequestIdRef.current);
        
        // requestId가 있으면 즉시 룸에 조인 - 지연 추가
        if (currentRequestIdRef.current) {
          console.log('🔄 기존 requestId로 room에 조인 시도...');
          // 연결 안정화를 위해 약간의 지연
          setTimeout(() => {
            if (socketRef.current && socketRef.current.connected && currentRequestIdRef.current) {
              console.log('📥 연결 안정화 후 room join 시도:', currentRequestIdRef.current);
              socketRef.current.emit('join-analysis', currentRequestIdRef.current);
            }
          }, 500); // 500ms 지연
        } else {
          console.log('ℹ️ 아직 requestId가 없음. 분석 요청 후 room에 조인할 예정.');
        }
      });
      
      socketRef.current.on('disconnect', (reason) => {
        console.log('❌ StockAnalysisForm: WebSocket disconnected, reason:', reason);
        console.log('🔍 Disconnect details:', {
          reason,
          url: WEBSOCKET_URL,
          connected: socketRef.current?.connected,
          id: socketRef.current?.id
        });
      });
      
      socketRef.current.on('connect_error', (error) => {
        console.log('💥 StockAnalysisForm: WebSocket connection error:', error);
        console.log('🔍 Connection error details:', {
          error: error.message || error,
          url: WEBSOCKET_URL,
          type: (error as any).type,
          description: (error as any).description
        });
      });
      
      socketRef.current.on('reconnect', (attemptNumber) => {
        console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
      });
      
      socketRef.current.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 WebSocket reconnection attempt', attemptNumber);
      });
      
      socketRef.current.on('reconnect_error', (error) => {
        console.log('💥 WebSocket reconnection error:', error);
      });

      // 룸 조인 완료 확인
      socketRef.current.on('joined-analysis', (roomId: string) => {
        console.log(`✅ Room join 성공: analysis-${roomId}`);
        console.log(`📊 현재 참여 중인 room: analysis-${roomId}`);
      });
      
      // 룸 나가기 완료 확인
      socketRef.current.on('left-analysis', (roomId: string) => {
        console.log(`✅ Room leave 성공: analysis-${roomId}`);
      });
      
      // 진행상황 업데이트 수신 - WebSocket 전용 모드
      socketRef.current.on('progress', (data: {
        requestId: string;
        stepId: string;
        label: string;
        status: 'waiting' | 'loading' | 'success' | 'error';
        message: string;
        details?: string[];
      }) => {
        const currentRequestId = currentRequestIdRef.current;
        console.log('📡 StockAnalysisForm: Progress update received:', data);
        console.log('🔍 Progress details:', {
          requestId: data.requestId,
          expectedRequestId: currentRequestId,
          matches: data.requestId === currentRequestId,
          stepId: data.stepId,
          status: data.status
        });
        
        if (data.requestId === currentRequestId) {
          console.log(`✅ Progress update matches requestId, updating step: ${data.stepId}`);
          
          // 완료 상태 체크 - WebSocket으로 완료 알림 받으면 완료 처리
          if (data.stepId === 'complete' && data.status === 'success') {
            console.log('🎉 Analysis completed via WebSocket!');
            setLoading(false);
            
            // 완료 단계 업데이트
            setProgressSteps(prevSteps => 
              prevSteps.map(step => {
                if (step.id === 'complete') {
                  const completeLogs = [
                    {
                      timestamp: new Date().toISOString(),
                      message: '🎉 모든 분석 과정 완료!',
                      type: 'success' as const
                    },
                    {
                      timestamp: new Date().toISOString(),
                      message: `📈 분석 대상: ${stockName}`,
                      type: 'info' as const
                    },
                    {
                      timestamp: new Date().toISOString(),
                      message: '🔄 최종 결과 조회 중...',
                      type: 'info' as const
                    }
                  ];
                  
                  return {
                    ...step,
                    status: 'success',
                    message: '모든 분석이 완료되었습니다',
                    logs: [...(step.logs || []), ...completeLogs],
                    endTime: new Date()
                  };
                }
                return step;
              })
            );
            
            // WebSocket으로 완료 처리 - 약간의 지연 후 최종 결과 조회
            console.log('⏳ Waiting 1 second for backend data persistence...');
            setTimeout(() => {
              fetchFinalResults(currentRequestId);
            }, 1000); // 1초 대기 후 결과 조회
            return;
          }
          
          // 상세 정보가 있으면 로그에 추가
          if (data.details && data.details.length > 0) {
            const detailLogs = data.details.map(detail => ({
              timestamp: new Date().toISOString(),
              message: `  • ${detail}`,
              type: 'info' as const
            }));
            
            setProgressSteps(prevSteps => 
              prevSteps.map(step => {
                if (step.id === data.stepId) {
                  return {
                    ...step,
                    status: data.status,
                    message: data.message,
                    logs: [...(step.logs || []), ...detailLogs],
                    startTime: step.startTime || (data.status === 'loading' ? new Date() : step.startTime),
                    endTime: (data.status === 'success' || data.status === 'error') ? new Date() : step.endTime
                  };
                }
                return step;
              })
            );
          } else {
            // 단순 진행상황 업데이트
            updateProgressStep(data.stepId, data.status, data.message, data.message);
          }
        } else {
          console.log(`❌ Progress update requestId mismatch: expected ${currentRequestId}, got ${data.requestId}`);
        }
      });

      // 실시간 로그 수신
      socketRef.current.on('realtime-log', (data: {
        requestId: string;
        stepId?: string;
        timestamp: string;
        message: string;
        type: 'info' | 'success' | 'error' | 'warning';
      }) => {
        const currentRequestId = currentRequestIdRef.current;
        console.log('📨 StockAnalysisForm: Realtime log received:', data);
        
        if (data.requestId === currentRequestId) {
          console.log(`✅ Realtime log matches requestId: ${data.message}`);
          
          if (data.stepId) {
            // 특정 단계에 로그 추가
            setProgressSteps(prevSteps => 
              prevSteps.map(step => {
                if (step.id === data.stepId) {
                  const newLog = {
                    timestamp: data.timestamp,
                    message: data.message,
                    type: data.type
                  };
                  
                  // 로그 메시지에 따라 단계 상태도 자동 업데이트
                  let updatedStatus = step.status;
                  
                  if (data.message.includes('시작') || data.message.includes('호출') || data.message.includes('수집 중') || data.message.includes('분석 중')) {
                    updatedStatus = 'loading';
                  } else if (data.message.includes('완료') || data.message.includes('성공') || data.message.includes('✅')) {
                    updatedStatus = 'success';
                  } else if (data.message.includes('오류') || data.message.includes('실패') || data.message.includes('❌')) {
                    updatedStatus = 'error';
                  }
                  
                  return {
                    ...step,
                    status: updatedStatus,
                    logs: [...(step.logs || []), newLog],
                    startTime: step.startTime || (updatedStatus === 'loading' ? new Date() : step.startTime),
                    endTime: (updatedStatus === 'success' || updatedStatus === 'error') ? new Date() : step.endTime
                  };
                }
                return step;
              })
            );
          } else {
            // stepId가 없는 경우, 현재 활성 단계나 'processing' 단계에 추가
            setProgressSteps(prevSteps => {
              const activeStep = prevSteps.find(step => step.status === 'loading') || 
                                prevSteps.find(step => step.id === 'processing');
              
              if (activeStep) {
                return prevSteps.map(step => {
                  if (step.id === activeStep.id) {
                    const newLog = {
                      timestamp: data.timestamp,
                      message: data.message,
                      type: data.type
                    };
                    return {
                      ...step,
                      logs: [...(step.logs || []), newLog]
                    };
                  }
                  return step;
                });
              }
              return prevSteps;
            });
          }
        } else {
          console.log(`❌ Realtime log requestId mismatch: expected ${currentRequestId}, got ${data.requestId}`);
        }
      });
      
      socketRef.current.on('error', (error: any) => {
        console.log('💥 StockAnalysisForm: WebSocket error:', error);
      });
      
    } catch (error) {
      console.log('💥 StockAnalysisForm: Failed to setup WebSocket:', error);
    }
  };

  const cleanupWebSocket = () => {
    if (socketRef.current) {
      console.log('🧹 StockAnalysisForm: Cleaning up WebSocket...');
      
      // 현재 분석 룸에서 나가기
      if (currentRequestIdRef.current) {
        console.log(`📤 Leaving analysis room: analysis-${currentRequestIdRef.current}`);
        socketRef.current.emit('leave-analysis', currentRequestIdRef.current);
      }
      
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const updateProgressStep = (stepId: string, status: ProgressStep['status'], message?: string, logMessage?: string) => {
    setProgressSteps(prevSteps => 
      prevSteps.map(step => {
        if (step.id === stepId) {
          const updatedStep = { 
            ...step, 
            status, 
            message: message || step.message 
          };
          
          // 로그 메시지가 있으면 추가
          if (logMessage) {
            const newLog = {
              timestamp: new Date().toISOString(),
              message: logMessage,
              type: (status === 'error' ? 'error' : 
                     status === 'success' ? 'success' : 'info') as 'info' | 'success' | 'error' | 'warning'
            };
            updatedStep.logs = [...(step.logs || []), newLog];
          }
          
          if (status === 'loading' && !step.startTime) {
            updatedStep.startTime = new Date();
          } else if ((status === 'success' || status === 'error') && step.startTime) {
            updatedStep.endTime = new Date();
          }
          
          return updatedStep;
        }
        return step;
      })
    );
  };

  // 최종 결과 가져오기 (WebSocket 완료 후) - 재시도 로직 포함
  const fetchFinalResults = async (requestId: string, retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 2000; // 2초 대기
    
    try {
      console.log(`📊 Fetching final results for: ${requestId} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      const response = await axios.get(`${API_BASE_URL}/api/analysis/${requestId}`);
      console.log(response)
      
      if (response.data.request?.status === 'completed' && response.data.results) {
        console.log('✅ Final results fetched successfully');
        onAnalysisComplete(response.data.results);
      } else {
        console.log('⚠️ Analysis not yet completed, status:', response.data.request?.status);
        
        // 재시도 가능한 경우
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            fetchFinalResults(requestId, retryCount + 1);
          }, retryDelay);
          return;
        }
        
        throw new Error('분석이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (error: any) {
      console.log('💥 Error fetching final results:', error);
      console.log('🔍 Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        requestId: requestId
      });
      
      // 404 (Not Found) 에러인 경우 재시도
      if (error.response?.status === 404 && retryCount < maxRetries) {
        console.log(`🔄 Request not found, retrying in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          fetchFinalResults(requestId, retryCount + 1);
        }, retryDelay);
        return;
      }
      
      // 최대 재시도 횟수 초과 또는 다른 에러
      const errorMessage = error.response?.status === 404 
        ? `분석 요청을 찾을 수 없습니다 (ID: ${requestId}). 백엔드에서 데이터 저장이 완료되지 않았을 수 있습니다.`
        : error.response?.data?.error || error.message || '결과 조회에 실패했습니다.';
      
      setError(errorMessage);
      onAnalysisError(errorMessage);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 StockAnalysisForm: Form submitted');
    console.log('📝 StockAnalysisForm: Stock name:', stockName.trim());
    console.log('📅 StockAnalysisForm: Days back:', daysBack);
    
    if (!stockName.trim()) {
      console.log('❌ StockAnalysisForm: Empty stock name');
      setError('주식명을 입력해주세요.');
      return;
    }

    console.log('⚙️ StockAnalysisForm: Starting analysis request...');
    setLoading(true);
    setError(null);
    
    // 초기 progress steps 설정 - 서버와 stepId 일치
    const initialSteps: ProgressStep[] = [
      { 
        id: 'init', 
        label: '분석 요청 초기화', 
        status: 'loading', 
        startTime: new Date(),
        message: '분석 요청을 서버에 전송하고 있습니다',
        logs: [
          { 
            timestamp: new Date().toISOString(), 
            message: '🚀 분석 요청 시작...', 
            type: 'info' 
          }
        ]
      },
      { 
        id: 'processing', 
        label: '분석 처리 시작', 
        status: 'waiting',
        logs: []
      },
      { 
        id: 'news-collection', 
        label: '뉴스 수집', 
        status: 'waiting',
        logs: []
      },
      { 
        id: 'python-analyzer', 
        label: 'Python 분석기 실행', 
        status: 'waiting',
        logs: []
      },
      { 
        id: 'economic-data', 
        label: '경제지표 수집', 
        status: 'waiting',
        logs: []
      },
      { 
        id: 'policy-analysis', 
        label: '정책 분석', 
        status: 'waiting',
        logs: []
      },
      { 
        id: 'sentiment-analysis', 
        label: '감정 분석', 
        status: 'waiting',
        logs: []
      },
      { 
        id: 'report-generation', 
        label: '리포트 생성', 
        status: 'waiting',
        logs: []
      },
      { 
        id: 'save', 
        label: '결과 저장', 
        status: 'waiting',
        logs: []
      },
      { 
        id: 'complete', 
        label: '분석 완료', 
        status: 'waiting',
        logs: []
      }
    ];
    setProgressSteps(initialSteps);

    try {
      // 1. WebSocket 연결 보장
      console.log('🔌 WebSocket 연결 확인 중...');
      await ensureWebSocketConnection();
      
      // 2. requestId 미리 생성 (MongoDB ObjectId 형식)
      const requestId = generateObjectId();
      console.log('🆔 Generated MongoDB ObjectId:', requestId);
              const request: AnalysisRequest = {
          requestId: requestId, // 미리 생성한 requestId 사용
          stockName: stockName.trim(),
          status: 'processing',
          createdAt: new Date().toISOString()
        };

        console.log('📤 StockAnalysisForm: Calling onAnalysisStart with:', request);
        onAnalysisStart(request);
      // 3. Room에 join
      console.log('🚪 Room join 시작...');
      await ensureRoomJoin(requestId);
      console.log('✅ Room join 완료. 이제 API 요청을 보냅니다.');
      
      // 4. API 요청 (requestId 포함)
      console.log('🌐 StockAnalysisForm: Making API request to:', `${API_BASE_URL}/api/analysis`);
      const response = await axios.post(`${API_BASE_URL}/api/analysis`, {
        stockName: stockName.trim(),
        daysBack: daysBack,
        requestId: requestId // requestId를 미리 전달
      });

      console.log('📡 StockAnalysisForm: API response received:', response.data);

      if (response.data.success) {
        console.log('✅ StockAnalysisForm: Analysis request successful');
        console.log('🆔 StockAnalysisForm: Using Request ID:', requestId);
        
        // 초기화 완료
        updateProgressStep('init', 'success', '분석 요청이 초기화되었습니다', '✅ 서버 연결 완료');
        updateProgressStep('processing', 'loading', '분석을 처리하고 있습니다', '🔄 분석 처리 시작...');
        

        
        // WebSocket 전용 모드 - 폴링 제거
        console.log('🌐 StockAnalysisForm: Using WebSocket-only mode for progress tracking');
        console.log('📡 StockAnalysisForm: All progress updates will come via WebSocket real-time events');
        
        // 분석 시작 완료 - WebSocket이 나머지 처리
        console.log('✅ StockAnalysisForm: Analysis request submitted successfully');
        console.log('⏳ StockAnalysisForm: Waiting for WebSocket progress updates...');
        

        updateProgressStep('processing', 'success', '분석을 완료했습니다.', '✅ 분석 요청 접수 완료');

      } else {
        console.log('❌ StockAnalysisForm: Analysis request failed:', response.data.error);
        setLoading(false);
        throw new Error(response.data.error || '분석 요청에 실패했습니다.');
      }
    } catch (err: any) {
      console.log('💥 StockAnalysisForm: Error in handleSubmit:', err);
      console.log('🔍 StockAnalysisForm: Error response:', err.response?.data);
      
      const errorMessage = err.response?.data?.error || err.message || '알 수 없는 오류가 발생했습니다.';
      console.log('📝 StockAnalysisForm: Setting error message:', errorMessage);
      
      setError(errorMessage);
      onAnalysisError(errorMessage);
      setLoading(false);
      
      // 에러 시 진행상황도 업데이트
      const currentSteps = progressSteps;
      const lastLoadingStep = currentSteps.find(step => step.status === 'loading');
      if (lastLoadingStep) {
        updateProgressStep(lastLoadingStep.id, 'error', errorMessage, `❌ 오류: ${errorMessage}`);
      }
    }
  };

  const isAnalyzing = loading || (currentAnalysis?.status === 'processing');

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Analytics sx={{ mr: 2, color: 'primary.main' }} />
        <Typography variant="h5" component="h2">
          주식 분석 요청
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <FormControl fullWidth>
            <TextField
              label="주식명"
              value={stockName}
              onChange={(e) => setStockName(e.target.value)}
              placeholder="예: 삼성전자, SK하이닉스, NAVER"
              disabled={isAnalyzing}
              helperText="분석하고 싶은 주식의 이름을 입력하세요"
              variant="outlined"
            />
          </FormControl>

          <FormControl fullWidth>
            <Typography gutterBottom>
              분석 기간: {daysBack}일
            </Typography>
            <Slider
              value={daysBack}
              onChange={(_, newValue) => setDaysBack(newValue as number)}
              valueLabelDisplay="auto"
              min={1}
              max={90}
              marks={[
                { value: 1, label: '1일' },
                { value: 7, label: '1주' },
                { value: 30, label: '1개월' },
                { value: 90, label: '3개월' }
              ]}
              disabled={isAnalyzing}
            />
          </FormControl>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isAnalyzing || !stockName.trim()}
            startIcon={isAnalyzing ? <CircularProgress size={20} /> : <PlayArrow />}
            sx={{ py: 1.5 }}
          >
            {isAnalyzing ? '분석 중...' : '분석 시작'}
          </Button>

          {isAnalyzing && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                뉴스 수집 및 분석 중입니다. 잠시만 기다려주세요...
              </Typography>
              <Typography variant="caption" color="text.secondary">
                WebSocket을 통한 실시간 업데이트가 진행됩니다.
              </Typography>
            </Box>
          )}
        </Stack>
      </form>
    </Paper>
  );
};

export default StockAnalysisForm;
