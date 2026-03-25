---
permalink: /
title: "👋 안녕하세요, 신지윤입니다"
author_profile: true
redirect_from:
    - /about/
    - /about.html
---

트랜잭션 처리 시스템과 핵심 금융 로직에 관심있는 백엔드 개발자입니다.

동시성 트랜잭션 환경에서 금융 시스템이 어떻게 **원자성(Atomicity), 일관성(Consistency), 데이터 무결성(Data Integrity)** 을 보장하는지에 관심이 있습니다.
핵심 뱅킹 기능을 직접 구현하고 레거시 시스템을 마이그레이션하는 경험을 통해, 신뢰할 수 있고 유지보수 가능한 금융 소프트웨어를 구축하는 것에 강한 흥미를 갖게 되었습니다.

---

# 💳 FinFlow-backend

**Repository**: <https://github.com/zzzyoonnn/FinFlow-backend>

트랜잭션 무결성에 초점을 맞춰 코어 뱅킹 운영을 시뮬레이션한 백엔드 애플리케이션입니다.

다음과 같은 주요 뱅킹 기능을 설계하고 구현했습니다.

- 입금 (Deposit)
- 출금 (Withdrawal)
- 이체 (Transfer)
- 거래 내역 관리 (Transaction History Management)

### 🔎 설계 접근 방식

- **핵심 뱅킹 기능 설계**: 입금, 출금, 이체 및 거래 내역 관리 기능 구현
- **트랜잭션 관리**: 출금과 이체를 하나의 @Transactional 경계 내에서 처리하여 원자성 보장
- **도메인 중심 설계**: 계좌 소유권, 비밀번호 검증, 잔액 확인 등의 검증 로직을 Account 도메인 엔티티에 위임
- **무결성 보장**: 명시적인 비즈니스 규칙을 통해 음수 잔액 발생 방지
- **추적성 확보**: 실행 시점의 잔액 스냅샷을 함께 기록하여 감사 가능성(Auditability) 확보
- **명확한 프로세스 구조화**: 처리 흐름을 검증(Validation) → 상태 변경(State Mutation) → 영속화(Persistence) → 응답(Response) 구조로 명확하게 설계

이 구현을 통해, 동시 요청 환경에서 데이터 불일치, 레이스 컨디션, 중복 실행을 어떻게 방지하는지에 대해 특히 큰 관심을 가지게 되었습니다.

👉 Core Banking Service Implementation: [AccountService.java](https://github.com/zzzyoonnn/FinFlow-backend/blob/main/src/main/java/com/FinFlow/service/AccountService.java)

### 📝 관련 글

- [계좌가 많아질 경우, 어떻게 설계하면 좋을까?🤔](https://zzzyoonnn.github.io/posts/2026/01/n+1-1/)
- N+1은 왜 발생할까?🤔 (Fetch Join 적용 전후 성능 비교)
- N+1은 왜 JPA에서 발생할까?🤔 (JPQL)
- N+1은 메모리에 어떤 영향을 미칠까?🤔
- 영속성 컨텍스트는 N+1과 어떤 관계가 있을까?🤔
- Fetch Join은 영속성 컨텍스트에서 어떻게 동작할까?🤔
- Hibernate 내부에서 영속성 컨텍스트는 어떻게 동작할까?🤔
- N+1은 GC를 왜 자주 발생시킬까?🤔

---

# 🔄 Servlet2Spring

**Repository**: <https://github.com/zzzyoonnn/Servlet2Spring>

백엔드 아키텍처의 진화와 프레임워크 중심 설계에 대한 이해 과정을 담은 프로젝트입니다. JSP 기반 아키텍처로 시작하여, 점진적으로 Spring MVC와 Spring Boot로 발전시켰습니다.

### 🔎 마이그레이션 핵심 포인트

- **계층형 아키텍처 리팩토링**: Controller, Service, Domain 계층 간 책임 분리 개선
- **설정 최적화**: Spring Boot Auto-configuration을 활용한 설정 간소화
- **보안 강화**: Spring Security를 활용한 보안 구조 강화
- **유지보수성 향상**: 반복적인 보일러플레이트 코드를 제거하고 코드 가독성 증대
- **빌드 및 배포 관리**: Maven을 통한 배포 및 의존성 관리 개선

이 마이그레이션 과정을 통해, 특히 신뢰성이 중요한 환경에서 안정성을 해치지 않으면서 어떻게 시스템을 현대화할 수 있을지 이해하게 되었습니다.

---

# 🛠 Tech Stack

- Backend: Java, Spring Boot, Spring Data JPA, Spring Security (JWT)
- Database: MySQL, H2 (Testing)
- Infrastructure: AWS (EC2, RDS, S3)
- Build Tool: Maven

---

# 🎯 관심 분야

- 코어 뱅킹 시스템
- 트랜잭션 처리
- 금융 데이터 무결성
- 고신뢰성 백엔드 시스템

---

# 💡 지향하는 방향

기능 개발 속도보다 정확성과 신뢰성을 우선시하는 백엔드 시스템을 구축하는 것을 목표로 합니다.
특히 데이터 무결성이 중요한 **금융 도메인에서 안정적으로 동작하는 시스템을 만드는 개발자**로 성장하고 싶습니다.
