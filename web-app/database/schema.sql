-- 주식 뉴스 분석 시스템 MySQL 스키마
CREATE DATABASE IF NOT EXISTS stock_analysis_db;
USE stock_analysis_db;

-- 사용자 테이블
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 분석 요청 테이블
CREATE TABLE analysis_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    stock_name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_stock_date (stock_name, start_date, end_date),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- 뉴스 데이터 테이블
CREATE TABLE news_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_request_id INT,
    title TEXT NOT NULL,
    content TEXT,
    url VARCHAR(500),
    published_date DATETIME,
    source VARCHAR(100),
    sentiment ENUM('positive', 'negative', 'neutral'),
    score DECIMAL(5,3),
    confidence DECIMAL(4,3),
    reasoning TEXT,
    reliability ENUM('high', 'medium', 'low'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id) ON DELETE CASCADE,
    INDEX idx_analysis_request (analysis_request_id),
    INDEX idx_sentiment_score (sentiment, score),
    INDEX idx_published_date (published_date)
);

-- 경제지표 데이터 테이블
CREATE TABLE economic_indicators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_request_id INT,
    indicator_type VARCHAR(50) NOT NULL,
    indicator_name VARCHAR(100) NOT NULL,
    value DECIMAL(15,4),
    date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id) ON DELETE CASCADE,
    INDEX idx_analysis_request (analysis_request_id),
    INDEX idx_indicator_type (indicator_type),
    INDEX idx_date (date)
);

-- 분석 결과 테이블
CREATE TABLE analysis_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_request_id INT UNIQUE,
    positive_count INT DEFAULT 0,
    negative_count INT DEFAULT 0,
    neutral_count INT DEFAULT 0,
    overall_sentiment ENUM('positive', 'negative', 'neutral'),
    overall_score DECIMAL(5,3),
    validation_result JSON,
    timeline_analysis JSON,
    force_analysis JSON,
    future_outlook JSON,
    report_text LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id) ON DELETE CASCADE
);

-- 정책 뉴스 테이블
CREATE TABLE policy_news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_request_id INT,
    title TEXT NOT NULL,
    content TEXT,
    policy_type ENUM('government', 'political', 'regulatory'),
    impact_score DECIMAL(5,3),
    relevance_score DECIMAL(5,3),
    published_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id) ON DELETE CASCADE,
    INDEX idx_analysis_request (analysis_request_id),
    INDEX idx_policy_type (policy_type)
);

-- 캐시 테이블 (기존 파일 캐시를 DB로 이전)
CREATE TABLE analysis_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_type ENUM('news', 'indicator', 'validation', 'outlook', 'forces', 'policy') NOT NULL,
    stock_name VARCHAR(100),
    start_date DATE,
    end_date DATE,
    data JSON NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cache_key (cache_key),
    INDEX idx_cache_type (cache_type),
    INDEX idx_stock_date (stock_name, start_date, end_date),
    INDEX idx_expires_at (expires_at)
);

-- 시스템 로그 테이블
CREATE TABLE system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_request_id INT,
    log_level ENUM('DEBUG', 'INFO', 'WARNING', 'ERROR') NOT NULL,
    component VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_request_id) REFERENCES analysis_requests(id) ON DELETE SET NULL,
    INDEX idx_analysis_request (analysis_request_id),
    INDEX idx_log_level (log_level),
    INDEX idx_component (component),
    INDEX idx_created_at (created_at)
);

-- 사용자 분석 히스토리 뷰
CREATE VIEW user_analysis_history AS
SELECT 
    u.username,
    ar.id as request_id,
    ar.stock_name,
    ar.start_date,
    ar.end_date,
    ar.status,
    ar.created_at,
    ar.completed_at,
    ares.overall_sentiment,
    ares.overall_score,
    ares.positive_count,
    ares.negative_count,
    ares.neutral_count
FROM users u
JOIN analysis_requests ar ON u.id = ar.user_id
LEFT JOIN analysis_results ares ON ar.id = ares.analysis_request_id
ORDER BY ar.created_at DESC;

-- 최근 분석 통계 뷰
CREATE VIEW recent_analysis_stats AS
SELECT 
    DATE(created_at) as analysis_date,
    COUNT(*) as total_requests,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_requests,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_requests,
    COUNT(DISTINCT stock_name) as unique_stocks
FROM analysis_requests 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY analysis_date DESC;
