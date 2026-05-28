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

개발 기간: 2025.10 – 2026.02

Github: [FinFlow-backend](https://github.com/zzzyoonnn/FinFlow-backend), [FinFlow-frontend](https://github.com/zzzyoonnn/FinFlow-frontend)

Spring Boot 기반 REST API 구조로 도메인을 설계하고, 트랜잭션 경계를 명확히 정의하여 코어뱅킹 기능을 구현했습니다. 거래 정합성과 조회 성능을 동시에 만족시키는 구조 설계에 집중했습니다.

### Fetch Join 기반 N+1 문제 해결 및 조회 성능 개선
- [Problem]
  - 계좌 거래 내역 조회 시 거래 목록 조회 후 연관된 출금 계좌(Account) 엔티티가 Lazy Loading으로 개별 조회되며 N+1문제가 발생했습니다. SQL 로그 분석 결과, 거래 100건 조회 시 총 101회의 쿼리가 실행되어 대량 조회 환경에서 응답 지연 및 DB 부하가 발생했습니다.
- [Analyze]
  - 전역 Eager Loading 적용 시 불필요한 연관 데이터까지 함께 조회되어 성능 저하 가능성이 있다고 판단했습니다. 따라서 기본 Fetch 전략은 Lazy Loading으로 유지하고, 대량 데이터 조회가 발생하는API에 한해 Fetch Join을 명시적으로 적용하여 시스템 전반의 사이드 이펙트를 최소화하고 성능을 극대화할 수 있을 것이라고 판단했습니다.
- [Action]
  - 거래 내역 조회 전용 API에 Fetch Join 적용 
  - 기본 연관관계 전략은 Lazy Loading으로 유지
  - 조회 시 필요한 연관 데이터만 단건 쿼리로 조회하도록 최적화
  - SQL 로그 기반 쿼리 실행 횟수 검증 및 성능 테스트 수행
- [Result]
  - 거래 100건 조회 기준 쿼리 수 101회 → 1회로 감소
  - 대량 조회 API 응답 속도 약 30% 개선
  - 불필요한 DB 접근 최소화를 통한 시스템 부하 감소
  - 조회 시나리오별 데이터 접근 전략 분리로 성능 안정성 확보

### 금융 트랜잭션 단위 설계 및 데이터 정합성 보장
- [Problem]
  - 입금, 출금, 이체 기능은 모두 잔액 변경을 수반하는 핵심 금융 연산으로, 처리 중 실패 발생 시 잔액 불일치 및 거래 누락 등의 데이터 정합성 문제가 발생할 위험이 있었습니다. 특히 이체는 출금과 입금이 동시에 처리되어야 하므로 원자적 보상이 필수적이었습니다.
- [Analyze]
  - 금융 도메인에서는 부분 성공이 허용되지 않기 때문에, 금액 변경 단위를 하나의 트랜잭션으로 관리해야 한다고 판단했습니다. 이에 따라 서비스 계층에서 트랜잭션 경계를 명확히 정의하고, 예외 발생 시 전체 롤백이 가능한 구조로 설계하여 데이터 무결성을 보장할 수 있다고 판단했습니다.
- [Action]
  - 입금/출금/이체 로직에 @Transactional 적용
  - 서비스 계층에서 트랜잭션 단위를 일관되게 관리
  - 트랜잭션 내부에서 잔액 검증, 거래 내역 생성, 잔액 변경 처리 수행
  - 예외 발생 시 전체 작업 롤백 처리 구현
- [Result]
  - 부분 성공/실패 상황 제거로 데이터 정합성 확보
  - 잔액 불일치 및 거래 누락 시나리오 방지
  - 금융 트랜잭션의 원자성 보장
  - 핵심 금융 기능에 대한 안정성 강화

### 동적 금융 조회 요구사항 대응을 위한 커스텀Repository 적용
- [Problem]
  - 거래 유형(입금/출금/이체), 기간, 금액 범위, 사용자 조건 조합에 따라 JPQL이 비대해졌고, 요구사항 변경 시 여러 메서드를 수정해야 하는 구조적 한계가 발생했습니다. 이는 코드 가독성 저하와 유지보수 비용 상승, 그리고 수정 시 기존 기능이 망가지는 리스크를 발생시켰습니다.
- [Analyze]
  - 조회 조건이 지속적으로 확장되는 환경에서는 정적 메서드 기반 Repository 구조에서는 동적 쿼리를 처리하기에는 한계가 있습니다. 인터페이스와 구현체를 분리하는 Custom Repository 구조를 도입하면 비즈니스 로직과 복잡한 조회(Query) 로직을 아키텍처적으로 명확히 분리할 수 있고 변경에 유연하게 대응할 수 있다고 판단했습니다.
- [Solution]
  - 사용자 정의 인터페이스(Custom Repository)와 그 구현체를 분리하여 구조화
  - 도메인별 조회 책임을 명확히 하여 Query 로직과 비즈니스 로직을 분리
  - 조회 쿼리 단위 테스트 가능하도록 Repository 책임 분리
- [Result]
  - 조회 조건에 따른 분기 로직 개선 및 가독성 향상
  - 조건 추가 및 변경 시 기존 코드 수정 최소화
  - 확장 가능한 조회 구조 확보
  - Service 로직과 독립적인 Query 테스트 환경 구축

---

## Servlet2Spring

개발 기간: 2025.02 – 2025.10

Github: [Servlet2Spring](https://github.com/zzzyoonnn/Servlet2Spring)

JSP/Servlet 기반 레거시 애플리케이션을 Spring MVC와 Spring Boot로 점진적으로 마이그레이션하며, 아키텍처 개선과 유지보수성 향상한 프로젝트입니다.

### Fetch Join 기반 N+1 문제 해결 및 조회 성능 개선
- [Problem]
  - 기존 JSP/Servlet 기반의 레거시 시스템은 스크립틀릿 사용으로 인해 화면(View)과 비즈니스 로직이 강하게 결합되어 있었습니다. 이로 인해 코드 가독성이 떨어지고, 작은 기능 변경에도 시스템 전체의 안정성이 흔들려 유지보수 비용이 급증하고 신규 기능 배포 서클이 지연되는 비즈니스 리스크가 있었습니다.
- [Analyze]
  - 시스템을 한 번에 뒤엎는 빅뱅 방식의 전환은 리스크가 너무 큽니다. 따라서 프레임워크의 구조적 이점을 살리면서도 안정성을 유지하기 위해, Spring MVC의 관심사 분리(SoC) 원칙을 적용하고 Spring Boot 체제로 점진적으로 마이그레이션하여 개발 생산성 향상과 아키텍처적 유연성을 동시에 확보하고자 했습니다.
- [Action]
  - JSP 내에 혼재되어 있던 비즈니스 로직을 서블릿 레이어에서 분리하여 Spring의 Controller-Service-Repository 레이어드 아키텍처로 재구성
  - 기존 레거시 데이터 접근 방식을 Spring MVC 구조에 맞게 이관하여 화면(View)과 백엔드 로직의 의존성을 완전히 제거
- [Result]
  - 비즈니스 로직과 프레젠테이션 레이어의 분리되면서 코드 복잡도를 낮추고 모듈 간 결합도 최소화
  - 기능 변경 시 영향 범위를 명확히 파악 가능
  - 계층 구조 기반으로 시스템 안정성 및 기능 확장이 용이한 구조 확보

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