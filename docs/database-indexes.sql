-- 대용량 데이터 최적화를 위한 권장 인덱스
-- Seoul Moment API - Product 모듈 최적화

-- 1. ProductColor 핵심 인덱스들
-- 기본 조회 최적화 (status별 조회가 가장 빈번)
CREATE INDEX CONCURRENTLY idx_product_color_status ON product_color(status);

-- 가격 정렬 최적화 (할인가 우선 로직)
CREATE INDEX CONCURRENTLY idx_product_color_effective_price ON product_color 
((CASE WHEN discount_price > 0 THEN discount_price ELSE price END), status);

-- 생성일 정렬 최적화
CREATE INDEX CONCURRENTLY idx_product_color_created_status ON product_color(created_at DESC, status);

-- 2. Product 관련 인덱스들
-- 브랜드별 상품 조회 최적화 (가장 선택도가 높은 조건)
CREATE INDEX CONCURRENTLY idx_product_brand_status ON product(brand_id, status);

-- 카테고리별 상품 조회 최적화
CREATE INDEX CONCURRENTLY idx_product_category_status ON product(product_category_id, status);
CREATE INDEX CONCURRENTLY idx_product_main_category ON product(category_id, status);

-- 복합 조건 최적화 (브랜드 + 카테고리)
CREATE INDEX CONCURRENTLY idx_product_brand_category ON product(brand_id, product_category_id, status);

-- 3. Brand 인덱스
CREATE INDEX CONCURRENTLY idx_brand_status ON brand(status);

-- 4. 다국어 텍스트 검색 최적화
-- GIN 인덱스로 ILIKE 검색 성능 향상
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_multilingual_text_search ON multilingual_text 
USING gin(text_content gin_trgm_ops);

-- 엔티티별 다국어 텍스트 조회 최적화
CREATE INDEX CONCURRENTLY idx_multilingual_text_entity ON multilingual_text(
  entity_type, entity_id, field_name, language_id
);

-- 5. 외래키 성능 최적화
CREATE INDEX CONCURRENTLY idx_product_color_product_id ON product_color(product_id);
CREATE INDEX CONCURRENTLY idx_product_brand_id ON product(brand_id);
CREATE INDEX CONCURRENTLY idx_multilingual_text_entity_id ON multilingual_text(entity_id);

-- 6. 파티셔닝 고려사항 (대용량 데이터 시)
-- 브랜드별 파티셔닝을 고려할 수 있음
-- CREATE TABLE product_color_brand_1 PARTITION OF product_color FOR VALUES IN (1);
-- CREATE TABLE product_color_brand_2 PARTITION OF product_color FOR VALUES IN (2);

-- 7. 통계 정보 업데이트
-- 대용량 데이터에서는 정기적인 ANALYZE 필요
-- ANALYZE product_color;
-- ANALYZE product;
-- ANALYZE multilingual_text;

-- 성능 모니터링 쿼리들:
-- 1. 느린 쿼리 확인
-- SELECT query, calls, total_time, mean_time 
-- FROM pg_stat_statements 
-- WHERE query ILIKE '%product_color%' 
-- ORDER BY total_time DESC LIMIT 10;

-- 2. 인덱스 사용률 확인
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'product_color'
-- ORDER BY idx_scan DESC;

-- 3. 테이블 사이즈 확인
-- SELECT 
--   schemaname, tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
-- FROM pg_tables 
-- WHERE tablename IN ('product_color', 'product', 'multilingual_text')
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;