const axios = require('axios');
const logger = require("../utils/logger");

class EconomicIndicatorCollector {
    constructor() {
        this.bankOfKoreaApiKey = process.env.BANK_OF_KOREA_API_KEY || '';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
    }

    /**
     * 모든 경제지표 수집
     * @param {string} startDate - 시작일 (YYYY-MM-DD)
     * @param {string} endDate - 종료일 (YYYY-MM-DD)
     * @returns {Object} 경제지표 데이터
     */
    async collectAllIndicators(startDate, endDate) {
        try {
            logger.info(`Collecting economic indicators from ${startDate} to ${endDate}`);
            
            const indicators = {};
            
            // 한국은행 API를 통한 경제지표 수집
            if (this.bankOfKoreaApiKey) {
                indicators.interest_rate = await this.getInterestRate(startDate, endDate);
                indicators.exchange_rate = await this.getExchangeRate(startDate, endDate);
                indicators.stock_index = await this.getStockIndex(startDate, endDate);
            } else {
                logger.warn('Bank of Korea API key not found, using mock data');
                indicators.interest_rate = this.getMockInterestRate();
                indicators.exchange_rate = this.getMockExchangeRate();
                indicators.stock_index = this.getMockStockIndex();
            }
            
            // 추가 경제지표들
            indicators.inflation_rate = await this.getInflationRate(startDate, endDate);
            indicators.unemployment_rate = await this.getUnemploymentRate(startDate, endDate);
            
            logger.info(`Collected economic indicators: ${Object.keys(indicators).join(', ')}`);
            return indicators;
            
        } catch (error) {
            logger.error(`Error collecting economic indicators: ${error.message}`);
            return this.getDefaultIndicators();
        }
    }

    /**
     * 금리 정보 수집
     */
    async getInterestRate(startDate, endDate) {
        try {
            if (!this.bankOfKoreaApiKey) {
                return this.getMockInterestRate();
            }

            const url = `http://ecos.bok.or.kr/api/StatisticSearch/${this.bankOfKoreaApiKey}/json/kr/1/100/722Y001/D/${startDate.replace(/-/g, '')}/${endDate.replace(/-/g, '')}/0101000`;
            
            const response = await axios.get(url, { headers: this.headers });
            const data = response.data;
            
            if (data.StatisticSearch && data.StatisticSearch.row) {
                return data.StatisticSearch.row.map(item => ({
                    date: this.formatDate(item.TIME),
                    value: parseFloat(item.DATA_VALUE),
                    indicator: '기준금리'
                }));
            }
            
            return this.getMockInterestRate();
            
        } catch (error) {
            logger.warn(`Error getting interest rate: ${error.message}`);
            return this.getMockInterestRate();
        }
    }

    /**
     * 환율 정보 수집
     */
    async getExchangeRate(startDate, endDate) {
        try {
            if (!this.bankOfKoreaApiKey) {
                return this.getMockExchangeRate();
            }

            const url = `http://ecos.bok.or.kr/api/StatisticSearch/${this.bankOfKoreaApiKey}/json/kr/1/100/731Y001/D/${startDate.replace(/-/g, '')}/${endDate.replace(/-/g, '')}/0000001`;
            
            const response = await axios.get(url, { headers: this.headers });
            const data = response.data;
            
            if (data.StatisticSearch && data.StatisticSearch.row) {
                return data.StatisticSearch.row.map(item => ({
                    date: this.formatDate(item.TIME),
                    value: parseFloat(item.DATA_VALUE),
                    indicator: '원달러환율'
                }));
            }
            
            return this.getMockExchangeRate();
            
        } catch (error) {
            logger.warn(`Error getting exchange rate: ${error.message}`);
            return this.getMockExchangeRate();
        }
    }

    /**
     * 주가지수 정보 수집
     */
    async getStockIndex(startDate, endDate) {
        try {
            // Yahoo Finance API 또는 다른 무료 API 사용
            const symbol = 'KS11'; // 코스피 지수
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
            
            const response = await axios.get(url, { headers: this.headers });
            const data = response.data;
            
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                const timestamps = result.timestamp || [];
                const closes = result.indicators.quote[0].close || [];
                
                return timestamps.map((timestamp, index) => ({
                    date: new Date(timestamp * 1000).toISOString().split('T')[0],
                    value: closes[index] || 0,
                    indicator: 'KOSPI'
                })).filter(item => {
                    return item.date >= startDate && item.date <= endDate;
                });
            }
            
            return this.getMockStockIndex();
            
        } catch (error) {
            logger.warn(`Error getting stock index: ${error.message}`);
            return this.getMockStockIndex();
        }
    }

    /**
     * 물가상승률 정보 수집
     */
    async getInflationRate(startDate, endDate) {
        try {
            // 모의 데이터 반환 (실제로는 통계청 API 등 사용)
            return [{
                date: endDate,
                value: 2.5,
                indicator: '소비자물가상승률'
            }];
        } catch (error) {
            logger.warn(`Error getting inflation rate: ${error.message}`);
            return [];
        }
    }

    /**
     * 실업률 정보 수집
     */
    async getUnemploymentRate(startDate, endDate) {
        try {
            // 모의 데이터 반환 (실제로는 통계청 API 등 사용)
            return [{
                date: endDate,
                value: 3.1,
                indicator: '실업률'
            }];
        } catch (error) {
            logger.warn(`Error getting unemployment rate: ${error.message}`);
            return [];
        }
    }

    /**
     * 날짜 형식 변환
     */
    formatDate(dateString) {
        try {
            if (dateString.length === 8) {
                const year = dateString.substring(0, 4);
                const month = dateString.substring(4, 6);
                const day = dateString.substring(6, 8);
                return `${year}-${month}-${day}`;
            }
            return dateString;
        } catch (error) {
            return new Date().toISOString().split('T')[0];
        }
    }

    /**
     * 모의 금리 데이터
     */
    getMockInterestRate() {
        return [{
            date: new Date().toISOString().split('T')[0],
            value: 3.5,
            indicator: '기준금리'
        }];
    }

    /**
     * 모의 환율 데이터
     */
    getMockExchangeRate() {
        return [{
            date: new Date().toISOString().split('T')[0],
            value: 1320.5,
            indicator: '원달러환율'
        }];
    }

    /**
     * 모의 주가지수 데이터
     */
    getMockStockIndex() {
        return [{
            date: new Date().toISOString().split('T')[0],
            value: 2650.5,
            indicator: 'KOSPI'
        }];
    }

    /**
     * 기본 경제지표 데이터
     */
    getDefaultIndicators() {
        return {
            interest_rate: this.getMockInterestRate(),
            exchange_rate: this.getMockExchangeRate(),
            stock_index: this.getMockStockIndex(),
            inflation_rate: [{
                date: new Date().toISOString().split('T')[0],
                value: 2.5,
                indicator: '소비자물가상승률'
            }],
            unemployment_rate: [{
                date: new Date().toISOString().split('T')[0],
                value: 3.1,
                indicator: '실업률'
            }]
        };
    }
}

module.exports = EconomicIndicatorCollector;
