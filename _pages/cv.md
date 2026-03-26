---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Personal Projects
======
## FinFlow
Spring Boot 기반 REST API 구조로 도메인을 설계하고, 트랜잭션 경계를 명확히 정의하여 코어뱅킹 기능을 구현했습니다. 거래 정합성과 조회 성능을 동시에 만족시키는 구조 설계에 집중했습니다.
### Fetch Join 기반 N+1 문제 해결 및 조회 성능 개선
- [Problem]
  - 계좌 거래 내역 조회에서 트랜잭션 목록을 조회한 뒤, 각 거래에 연관된 출금 계좌(Account) 엔티티가 Lazy Loading으로 개별 조회되면서 N+1 문제가 발생했습니다. 실제 SQL 로그를 확인한 결과, 거래 100건 조회 시 기본 조회 쿼리 1회 이후 계좌 조회 쿼리가 100회 추가로 실행되어 총 101회의 쿼리가 발생하고 있었습니다.
- [Solution]
  - 기본 전략은 Lazy Loading 유지
  - 조회 전용 API에 한해 Fetch Join 명시적 적용
  - 불필요한 전역 Eager 로딩을 방지하면서 필요한 데이터만 단건 조회로 최적화
- [Result]
  - 불필요한 DB 쿼리 최소화를 통한 시스템 부하 감소
  - 대량 조회 시 API 응답 속도 약 30% 개선 
  - 조회 시나리오별 데이터 접근 전략 분리로 성능 안정성 확보 
  - 대량 거래 조회 시 응답 지연을 줄여 사용자 경험 저하를 방지

### 금융 트랜잭션 단위 설계 및 데이터 정합성 보장
- [Problem]
  - 입금, 출금, 이체는 모두 잔액 변경을 수반하는 핵심 금융 연산으로, 중간 실패 발생 시 데이터 불일치(잔액 오류, 거래 누락 등)가 발생할 수 있는 구조적 위험이 존재했습니다. 특히 이체의 경우, 출금과 입금이 서로 다른 계좌에 반영되기 때문에 원자적 보장이 필수적이었습니다.
- [Solution]
  - 트랜잭션을 서비스 계층에 명확히 정의 
  - 입금/출금/이체 모든 금액 변경 로직에 @Transactional 적용
  - 트랜잭션 내부에서 다음 기능을 수행
    - 잔액 검증
    - 거래 내역 생성
    - 잔액 차감/증가 처리
  - 예외 발생 시 전체 롤백 전략 적용
  - 트랜잭션 단위를 “금액 변경 1건”으로 정의하여 서비스 계층에서 일관성 있게 관리
- [Result]
  - 부분 성공/부분 실패 상황 제거
  - 금융 도메인 특성에 맞는 데이터 무결성 확보 
  - 잔액 불일치 및 거래 누락 시나리오 방지

### 동적 금융 조회 요구사항 대응을 위한 커스텀Repository 적용
- [Problem]
  - 거래 유형(입금/출금/이체), 기간, 금액 범위, 사용자 조건 조합에 따라 JPQL이 비대해졌고, 요구사항 변경 시 여러 메서드를 수정해야 하는 구조적 한계가 발생했습니다.
- [Solution]
  - JPQL을 사용한 Custom Repository 구조 도입
  - 도메인별 조회 책임을 명확히 하여 Query 로직과 비즈니스 로직을 분리
- [Result]
  - 조회 조건에 따른 JPQL 분기 및 가독성 개선
  - 조건 조합 변경 시 기존 코드 수정 없이 확장 가능한 구조 확보
  - Service 로직과 무관하게 조회 쿼리 자체에 대한 테스트 가능

Skills
======
- Backend
  - Java 21 
  - Spring Boot 
  - Spring Data JPA 
  - Spring Security (JWT)
- Database
  - MySQL 
  - H2 (for testing)
- Infrastructure 
  - AWS (EC2, RDS, S3) 
- Build Tool 
  - Maven

Education
======
* Bachelor's degree, Electrical Engineering, Myongji University, 2022


<!--
Publications
======
  <ul>{% for post in site.publications reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Talks
======
  <ul>{% for post in site.talks reversed %}
    {% include archive-single-talk-cv.html  %}
  {% endfor %}</ul>
  
Teaching
======
  <ul>{% for post in site.teaching reversed %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Service and leadership
======
* Currently signed in to 43 different slack teams
-->