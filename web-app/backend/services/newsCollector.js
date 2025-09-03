const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

class NewsCollector {
    constructor() {
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    /**
     * 주식 뉴스 수집
     * @param {string} stockName - 종목명
     * @param {string} startDate - 시작일 (YYYY-MM-DD)
     * @param {string} endDate - 종료일 (YYYY-MM-DD)
     * @returns {Array} 뉴스 데이터 배열
     */
    async collectNews(stockName, startDate, endDate) {
        try {
            logger.info(`Collecting news for ${stockName} from ${startDate} to ${endDate}`);
            
            const newsData = [];
            
            // 네이버 뉴스 수집
            const naverNews = await this.collectNaverNews(stockName, startDate, endDate);
            newsData.push(...naverNews);
            
            // 다음 뉴스 수집
            const daumNews = await this.collectDaumNews(stockName, startDate, endDate);
            newsData.push(...daumNews);
            
            // 중복 제거
            const uniqueNews = this.removeDuplicates(newsData);
            
            logger.info(`Collected ${uniqueNews.length} unique news articles`);
            return uniqueNews;
            
        } catch (error) {
            logger.error(`Error collecting news: ${error.message}`);
            throw error;
        }
    }

    /**
     * 네이버 뉴스 수집
     */
    async collectNaverNews(stockName, startDate, endDate) {
        try {
            const newsData = [];
            const encodedStockName = encodeURIComponent(stockName);
            
            // 네이버 뉴스 검색 URL
            const searchUrl = `https://search.naver.com/search.naver?where=news&query=${encodedStockName}&sort=1&pd=3&ds=${startDate}&de=${endDate}`;
            
            const response = await axios.get(searchUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);
            
            $('.news_area').each((index, element) => {
                try {
                    const titleElement = $(element).find('.news_tit');
                    const title = titleElement.text().trim();
                    const url = titleElement.attr('href');
                    const summary = $(element).find('.dsc_txt_wrap').text().trim();
                    const source = $(element).find('.press').text().trim();
                    const dateText = $(element).find('.info_group .info').last().text().trim();
                    
                    if (title && url) {
                        newsData.push({
                            title: title,
                            url: url,
                            summary: summary,
                            source: source || '네이버',
                            date: this.parseDate(dateText),
                            content: '',
                            relevance_score: 0.0
                        });
                    }
                } catch (error) {
                    logger.warn(`Error parsing naver news item: ${error.message}`);
                }
            });
            
            logger.info(`Collected ${newsData.length} articles from Naver`);
            return newsData;
            
        } catch (error) {
            logger.error(`Error collecting Naver news: ${error.message}`);
            return [];
        }
    }

    /**
     * 다음 뉴스 수집
     */
    async collectDaumNews(stockName, startDate, endDate) {
        try {
            const newsData = [];
            const encodedStockName = encodeURIComponent(stockName);
            
            // 다음 뉴스 검색 URL
            const searchUrl = `https://search.daum.net/search?w=news&q=${encodedStockName}&sort=recency&DA=PGD&period=u&sd=${startDate.replace(/-/g, '')}&ed=${endDate.replace(/-/g, '')}`;
            
            const response = await axios.get(searchUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);
            
            $('.c-item-doc').each((index, element) => {
                try {
                    const titleElement = $(element).find('.tit-g .tit_main a');
                    const title = titleElement.text().trim();
                    const url = titleElement.attr('href');
                    const summary = $(element).find('.c-item-content .desc').text().trim();
                    const source = $(element).find('.c-item-content .txt_info a').first().text().trim();
                    const dateText = $(element).find('.c-item-content .txt_info .txt_date').text().trim();
                    
                    if (title && url) {
                        newsData.push({
                            title: title,
                            url: url,
                            summary: summary,
                            source: source || '다음',
                            date: this.parseDate(dateText),
                            content: '',
                            relevance_score: 0.0
                        });
                    }
                } catch (error) {
                    logger.warn(`Error parsing daum news item: ${error.message}`);
                }
            });
            
            logger.info(`Collected ${newsData.length} articles from Daum`);
            return newsData;
            
        } catch (error) {
            logger.error(`Error collecting Daum news: ${error.message}`);
            return [];
        }
    }

    /**
     * 날짜 파싱
     */
    parseDate(dateText) {
        try {
            if (!dateText) return new Date().toISOString().split('T')[0];
            
            // "2시간전", "1일전" 등의 상대적 시간 처리
            if (dateText.includes('시간전')) {
                const hours = parseInt(dateText.match(/(\d+)시간전/)?.[1] || '0');
                const date = new Date();
                date.setHours(date.getHours() - hours);
                return date.toISOString().split('T')[0];
            }
            
            if (dateText.includes('일전')) {
                const days = parseInt(dateText.match(/(\d+)일전/)?.[1] || '0');
                const date = new Date();
                date.setDate(date.getDate() - days);
                return date.toISOString().split('T')[0];
            }
            
            // "2024.12.27" 형식 처리
            if (dateText.includes('.')) {
                const parts = dateText.split('.');
                if (parts.length >= 3) {
                    const year = parts[0];
                    const month = parts[1].padStart(2, '0');
                    const day = parts[2].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }
            
            return new Date().toISOString().split('T')[0];
        } catch (error) {
            logger.warn(`Error parsing date: ${dateText}`);
            return new Date().toISOString().split('T')[0];
        }
    }

    /**
     * 중복 뉴스 제거
     */
    removeDuplicates(newsData) {
        const seen = new Set();
        return newsData.filter(news => {
            const key = `${news.title}-${news.source}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 뉴스 본문 내용 수집
     */
    async getNewsContent(url) {
        try {
            const response = await axios.get(url, { 
                headers: this.headers,
                timeout: 10000
            });
            const $ = cheerio.load(response.data);
            
            // 네이버 뉴스
            if (url.includes('naver.com')) {
                return $('#dic_area, .go_trans._article_content, ._article_body_contents').text().trim();
            }
            
            // 다음 뉴스
            if (url.includes('daum.net')) {
                return $('.article_view, .news_view').text().trim();
            }
            
            // 일반적인 본문 선택자
            return $('article, .content, .article-content, .news-content, .post-content').text().trim();
            
        } catch (error) {
            logger.warn(`Error getting news content from ${url}: ${error.message}`);
            return '';
        }
    }
}

module.exports = NewsCollector;
