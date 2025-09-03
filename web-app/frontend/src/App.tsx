import React, { useState, useRef, useEffect } from 'react';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline, 
  AppBar, 
  Toolbar, 
  Typography, 
  Container,
  Box
} from '@mui/material';
import { TrendingUp } from '@mui/icons-material';
import StockAnalysisForm, { ProgressStep } from './components/StockAnalysisForm';
import AnalysisResults from './components/AnalysisResults';
import AnalysisHistory from './components/AnalysisHistory';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    },
  },
});

export interface AnalysisRequest {
  requestId: string;
  stockName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface AnalysisData {
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  overall_sentiment: 'positive' | 'negative' | 'neutral';
  overall_score: number;
  report_text: string;
  raw_output?: string;
}

function App() {
  console.log('🚀 App: Component initialized');
  
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisRequest | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [refreshHistory, setRefreshHistory] = useState(0);
  
  // currentAnalysis의 최신 값을 추적하기 위한 ref
  const currentAnalysisRef = useRef<AnalysisRequest | null>(null);
  
  // currentAnalysis가 변경될 때마다 ref도 업데이트
  useEffect(() => {
    currentAnalysisRef.current = currentAnalysis;
    console.log('🔄 App: currentAnalysis updated, ref synced:', currentAnalysis);
  }, [currentAnalysis]);

  const handleAnalysisStart = (request: AnalysisRequest) => {
    console.log('🎯 App: Analysis started');
    console.log('📊 App: Analysis request:', request);
    
    // 새로운 분석 시작 시 이전 결과들 초기화
    setCurrentAnalysis(request);
    setAnalysisData(null);
    setProgressSteps([]); // progressSteps도 초기화

  };

  const handleProgressUpdate = (steps: ProgressStep[]) => {
    setProgressSteps(steps);
  };

  const handleAnalysisComplete = (data: AnalysisData) => {
    console.log('✅ App: Analysis completed');
    console.log('📈 App: Analysis data:', data);
    console.log('🔍 App: currentAnalysisRef.current:', currentAnalysisRef.current);
    
    setAnalysisData(data);
    
    // 방법 1: 함수형 상태 업데이트를 사용 (권장)
    setCurrentAnalysis(prevAnalysis => {
      console.log('🔍 App: Previous analysis in complete handler:', prevAnalysis);
      
      if (prevAnalysis) {
        const updatedAnalysis = {
          ...prevAnalysis,
          status: 'completed' as const,
          completedAt: new Date().toISOString()
        };
        console.log('📝 App: Updated analysis:', updatedAnalysis);
        console.log('✨ App: Analysis completed, keeping result visible for user');
        return updatedAnalysis;
      } else {
        console.warn('⚠️ App: currentAnalysis is null in handleAnalysisComplete');
        // 대안으로 ref에서 값을 가져와서 사용
        if (currentAnalysisRef.current) {
          console.log('🔄 App: Using ref value as fallback');
          const updatedAnalysis = {
            ...currentAnalysisRef.current,
            status: 'completed' as const,
            completedAt: new Date().toISOString()
          };
          return updatedAnalysis;
        }
        return prevAnalysis;
      }
    });
  };

  const handleAnalysisError = (error: string) => {
    console.log('❌ App: Analysis error:', error);
    console.log('🔍 App: currentAnalysisRef.current:', currentAnalysisRef.current);
    
    // 함수형 상태 업데이트를 사용하여 최신 currentAnalysis 값을 얻음
    setCurrentAnalysis(prevAnalysis => {
      console.log('🔍 App: Previous analysis in error handler:', prevAnalysis);
      
      if (prevAnalysis) {
        const updatedAnalysis = {
          ...prevAnalysis,
          status: 'failed' as const,
          error: error
        };
        console.log('📝 App: Updated analysis after error:', updatedAnalysis);
        console.log('🚨 App: Analysis failed, keeping error visible for user');
        return updatedAnalysis;
      } else {
        console.warn('⚠️ App: currentAnalysis is null in handleAnalysisError');
        // 대안으로 ref에서 값을 가져와서 사용
        if (currentAnalysisRef.current) {
          console.log('🔄 App: Using ref value as fallback');
          const updatedAnalysis = {
            ...currentAnalysisRef.current,
            status: 'failed' as const,
            error: error
          };
          return updatedAnalysis;
        }
        return prevAnalysis;
      }
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={2}>
        <Toolbar>
          <TrendingUp sx={{ mr: 2 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            주식 정보 분석 시스템
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <StockAnalysisForm 
            onAnalysisStart={handleAnalysisStart}
            onAnalysisComplete={handleAnalysisComplete}
            onAnalysisError={handleAnalysisError}
            onProgressUpdate={handleProgressUpdate}
            currentAnalysis={currentAnalysis}
          />
        </Box>

        {(currentAnalysis || analysisData) && (
          <Box sx={{ mb: 4 }}>
            <AnalysisResults 
              analysis={currentAnalysis}
              data={analysisData}
              progressSteps={progressSteps}
            />
          </Box>
        )}


      </Container>
    </ThemeProvider>
  );
}

export default App;
