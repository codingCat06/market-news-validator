#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MongoDB 캐시 클래스
파일 기반 JSON 캐시를 MongoDB로 대체
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId


class MongoCache:
    def __init__(self, mongodb_uri=None, database_name="stock_analysis", collection_name="analysis_cache"):
        """
        MongoDB 캐시 초기화
        
        Args:
            mongodb_uri: MongoDB 연결 URI
            database_name: 데이터베이스 이름
            collection_name: 컬렉션 이름
        """
        self.mongodb_uri = mongodb_uri or os.getenv('MONGODB_URI', 'mongodb://localhost:27017/stock_analysis')
        self.database_name = database_name
        self.collection_name = collection_name
        self.client = None
        self.db = None
        self.collection = None
        
    def connect(self):
        """MongoDB 연결"""
        if not self.client:
            self.client = MongoClient(self.mongodb_uri)
            self.db = self.client[self.database_name]
            self.collection = self.db[self.collection_name]
            
            # 인덱스 생성
            self.collection.create_index("cache_key", unique=True)
            self.collection.create_index("expires_at")
            self.collection.create_index("created_at")
            
    def disconnect(self):
        """MongoDB 연결 해제"""
        if self.client:
            self.client.close()
            self.client = None
            self.db = None
            self.collection = None
    
    def get_cache(self, cache_key, cache_type="analysis"):
        """
        캐시 데이터 조회
        
        Args:
            cache_key: 캐시 키
            cache_type: 캐시 타입 (analysis, validation, future_outlook 등)
            
        Returns:
            캐시된 데이터 또는 None
        """
        try:
            self.connect()
            
            # 만료되지 않은 캐시 조회
            cache_doc = self.collection.find_one({
                "cache_key": cache_key,
                "cache_type": cache_type,
                "$or": [
                    {"expires_at": None},
                    {"expires_at": {"$gt": datetime.now()}}
                ]
            })
            
            if cache_doc:
                return cache_doc.get("data")
            return None
            
        except Exception as e:
            print(f"캐시 조회 실패: {e}")
            return None
    
    def set_cache(self, cache_key, data, cache_type="analysis", expires_hours=24):
        """
        캐시 데이터 저장
        
        Args:
            cache_key: 캐시 키
            data: 저장할 데이터
            cache_type: 캐시 타입
            expires_hours: 만료 시간 (시간 단위, None이면 만료 없음)
        """
        try:
            self.connect()
            
            expires_at = None
            if expires_hours:
                expires_at = datetime.now() + timedelta(hours=expires_hours)
            
            cache_doc = {
                "cache_key": cache_key,
                "cache_type": cache_type,
                "data": data,
                "created_at": datetime.now(),
                "expires_at": expires_at
            }
            
            # upsert로 기존 데이터 업데이트 또는 새로 생성
            self.collection.replace_one(
                {
                    "cache_key": cache_key,
                    "cache_type": cache_type
                },
                cache_doc,
                upsert=True
            )
            
        except Exception as e:
            print(f"캐시 저장 실패: {e}")
    
    def delete_cache(self, cache_key, cache_type=None):
        """
        특정 캐시 삭제
        
        Args:
            cache_key: 캐시 키
            cache_type: 캐시 타입 (None이면 모든 타입)
        """
        try:
            self.connect()
            
            query = {"cache_key": cache_key}
            if cache_type:
                query["cache_type"] = cache_type
                
            self.collection.delete_many(query)
            
        except Exception as e:
            print(f"캐시 삭제 실패: {e}")
    
    def clear_expired_cache(self):
        """만료된 캐시 정리"""
        try:
            self.connect()
            
            result = self.collection.delete_many({
                "expires_at": {"$lte": datetime.now()}
            })
            
            return result.deleted_count
            
        except Exception as e:
            print(f"만료된 캐시 정리 실패: {e}")
            return 0
    
    def get_cache_stats(self):
        """캐시 통계 조회"""
        try:
            self.connect()
            
            total_count = self.collection.count_documents({})
            expired_count = self.collection.count_documents({
                "expires_at": {"$lte": datetime.now()}
            })
            
            # 캐시 타입별 통계
            type_stats = list(self.collection.aggregate([
                {"$group": {
                    "_id": "$cache_type",
                    "count": {"$sum": 1}
                }}
            ]))
            
            return {
                "total_count": total_count,
                "expired_count": expired_count,
                "active_count": total_count - expired_count,
                "type_stats": type_stats
            }
            
        except Exception as e:
            print(f"캐시 통계 조회 실패: {e}")
            return None
    
    def generate_cache_key(self, *args):
        """캐시 키 생성 (해시 기반)"""
        content = "_".join(str(arg) for arg in args)
        return hashlib.md5(content.encode('utf-8')).hexdigest()
