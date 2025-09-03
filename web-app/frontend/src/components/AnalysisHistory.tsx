import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Collapse,
  Button,
  Pagination,
  TablePagination
} from '@mui/material';
import {
  History,
  ExpandMore,
  ExpandLess,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Refresh
} from '@mui/icons-material';
import axios from 'axios';

interface HistoryItem {
  _id: string;
  request_id?: string; // 호환성을 위해 추가
  stock_name: string;
  status: string;
  created_at: string;
  completed_at?: string;
  overall_sentiment?: string;
  overall_score?: number;
  positive_count?: number;
  negative_count?: number;
  neutral_count?: number;
}

interface AnalysisHistoryProps {
  refreshTrigger: number;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ refreshTrigger }) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const fetchHistory = useCallback(async () => {
    console.log('📋 AnalysisHistory: Starting fetchHistory');
    
    setLoading(true);
    try {
      const requestUrl = `${API_BASE_URL}/api/history`;
      const params = {
        limit: rowsPerPage,
        offset: page * rowsPerPage
      };

      
      const response = await axios.get(requestUrl, { params });
      
      console.log('📡 AnalysisHistory: Response received:', response.data);
      
      // API가 배열을 직접 반환하는 경우와 items 속성을 가진 객체를 반환하는 경우를 모두 처리
      const historyData = Array.isArray(response.data) ? response.data : (response.data.items || []);
      const totalData = Array.isArray(response.data) ? response.data.length : (response.data.total || 0);
      
      setHistory(historyData);
      setTotalCount(totalData);
      
      console.log('✅ AnalysisHistory: History fetch completed successfully');
    } catch (error:any) {
      console.error('Failed to fetch history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage]); // fetchHistory를 의존성에서 제거

  // 데이터 페칭을 위한 useEffect - refreshTrigger, page, rowsPerPage 변경 시 실행
  useEffect(() => {
    console.log('🔄 AnalysisHistory: useEffect triggered');
    fetchHistory();
  }, [refreshTrigger, page, rowsPerPage]); // fetchHistory 의존성 제거로 무한 루프 방지

  // ID 가져오기 헬퍼 함수
  const getItemId = (item: HistoryItem) => {
    return item._id || item.request_id || '';
  };

  const handleExpandRow = (itemId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'processing':
        return 'primary';
      default:
        return 'default';
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

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp sx={{ color: '#4caf50' }} />;
      case 'negative':
        return <TrendingDown sx={{ color: '#f44336' }} />;
      case 'neutral':
        return <TrendingFlat sx={{ color: '#ff9800' }} />;
      default:
        return null;
    }
  };

  const getSentimentText = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return '긍정적';
      case 'negative':
        return '부정적';
      case 'neutral':
        return '중립적';
      default:
        return '-';
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    console.log('📄 AnalysisHistory: Page changed from', page, 'to', newPage);
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    console.log('📊 AnalysisHistory: Rows per page changed from', rowsPerPage, 'to', newRowsPerPage);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <History sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h5" component="h2">
            분석 기록
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchHistory}
          disabled={loading}
        >
          새로고침
        </Button>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>주식명</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>전체 감정</TableCell>
              <TableCell>요청 시간</TableCell>
              <TableCell>완료 시간</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.map((item) => {
              const itemId = getItemId(item);
              
              return (
                <React.Fragment key={itemId}>
                  <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
                    <TableCell>
                      <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={() => handleExpandRow(itemId)}
                      >
                        {expandedRows.has(itemId) ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.stock_name} color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getStatusText(item.status)}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getSentimentIcon(item.overall_sentiment)}
                        <Typography variant="body2">
                          {getSentimentText(item.overall_sentiment)}
                        </Typography>
                        {item.overall_score !== undefined && (
                          <Typography variant="caption" color="text.secondary">
                            ({(item.overall_score * 100).toFixed(1)}%)
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(item.created_at).toLocaleString('ko-KR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.completed_at 
                          ? new Date(item.completed_at).toLocaleString('ko-KR')
                          : '-'
                        }
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                      <Collapse in={expandedRows.has(itemId)} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1 }}>
                          <Typography variant="h6" gutterBottom component="div">
                            상세 정보
                          </Typography>
                          <Table size="small" aria-label="details">
                            <TableBody>
                              <TableRow>
                                <TableCell component="th" scope="row">
                                  요청 ID
                                </TableCell>
                                <TableCell>{itemId}</TableCell>
                              </TableRow>
                              {item.positive_count !== undefined && (
                                <>
                                  <TableRow>
                                    <TableCell component="th" scope="row">
                                      긍정적 뉴스
                                    </TableCell>
                                    <TableCell>{item.positive_count}개</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell component="th" scope="row">
                                      부정적 뉴스
                                    </TableCell>
                                    <TableCell>{item.negative_count}개</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell component="th" scope="row">
                                      중립적 뉴스
                                    </TableCell>
                                    <TableCell>{item.neutral_count}개</TableCell>
                                  </TableRow>
                                </>
                              )}
                            </TableBody>
                          </Table>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {history.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            분석 기록이 없습니다.
          </Typography>
        </Box>
      )}

      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalCount}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="페이지당 행 수:"
        labelDisplayedRows={({ from, to, count }) => 
          `${from}-${to} / ${count !== -1 ? count : `${to}개 이상`}`
        }
      />
    </Paper>
  );
};

export default AnalysisHistory;
