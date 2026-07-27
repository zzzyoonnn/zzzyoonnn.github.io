---
layout: post
title: "금융 시스템에서 데이터 정합성을 지키기 위해 고려해야 할 것은 무엇일까?🤔"
subtitle: "한줄 요약"
date: 2026-07-26
permalink: /posts/2026/07/architecture/consistency/
background: '/img/backgrounds/architecture/consistency.png'
categories: architecture

tags:
    - Architecture
    - Financial
    - FinTech
    - Redis
    - Database
    - RDB
---

### 목차

1. 작성 이유
2. 금융 시스템에서 데이터 정합성이 중요한 이유
3. 트랜잭션(Transaction)
4. 트랜잭션에서 발생하는 동시성 문제
   - Dirty Read
   - Non-Repeatable Read
   - Phantom Read
5. Isolation Level
   - Core 뱅킹에서 기본 격리 수준(READ COMMITTED / REPEATABLE READ)으로 충분할까?
6. Lock을 통한 동시성 제어
   - Isolation Level과 Lock의 본질적인 관계
   - Shared Lock과 Exclusive Lock
   - 낙관적 락과 비관적 락
     - 왜 금융 계좌 시스템에서는 비관적 락인가?
8. Spring Boot + JPA 구현 예시
   - Core 뱅킹 입출금/잔액 갱신 시 비관적 락 적용 코드
   - 데드락(Deadlock) 방지 전략
     - Lock Ordering
     - Lock Timeout
     - Redis 분산 락과의 조합
9. Redis 분산 락과 RDB Lock을 함께 사용하는 이유
   - RDB 비관적 락만 사용할 때의 한계
   - Redis 분산 락만 사용할 때의 한계
   - 기술별 역할 분담
   - 전체 아키텍처 흐름 (Core 뱅킹 입출금)
   - 코드 패턴 예시 (AOP 기반)
10. 결론

---

# 작성 이유

이전 글에서는 금융 시스템에서 Redis가 어떻게 활용되는지 살펴보고, 직접 멱등성을 보장하기 위한 아키텍처를 다뤘다.

[왜 금융 시스템에서는 Redis를 사용하는걸까?🤔](https://zzzyoonnn.github.io/posts/2026/07/architecture/redis/)

그 과정에서 한 가지 고민이 생겼다.

"Redis를 프로젝트에 어떻게 적용할 것인가?"

AI의 도움을 받으면 코드를 작성하는 것은 어렵지 않다. 하지만 코드를 작성하는 것과 실제 시스템에서 어떤 기술을 선택하고, 왜 필요한지 판단하는 것은 전혀 다른 문제라고 생각했다.

"AI가 코드까지 작성해주는 시대에, 백엔드 개발자인 내가 진짜 책임져야 하는 영역은 어디일까?"

내가 내린 답은 데이터 정합성을 어떻게 설계하고 보장할 것인지 판단하는 것이었다.

금융 시스템에서 하나의 거래가 잘못되거나 중복 처리되면 단순한 시스템 오류를 넘어 실제 금융 데이터의 불일치로 이어질 수 있다.

따라서 Redis와 같은 외부 기술을 적용하기에 앞서, 가장 기본이 되는 데이터 저장소에서 트랜잭션이 어떻게 동작하고 동시성 문제를 어떻게 제어하는지 이해할 필요가 있다고 생각했다.

이번 글에서는 금융 시스템의 데이터 정합성을 이해하기 위한 출발점으로 RDB의 트랜잭션과 ACID, 그리고 여러 트랜잭션이 동시에 실행될 때 발생하는 문제를 해결하기 위한 **격리 수준(Isolation Level)** 과 **비관적 락(Pessimistic Lock)** 에 대해 알아보려고 한다.

---

# 금융 시스템에서 데이터 정합성이 중요한 이유

일반적인 서비스에서 데이터 오류는 '불편함'을 주지만, 금융 시스템에서 데이터 오류는 '사고'이다. 특히 금융 시스템에서는 하나의 거래만 처리되는 것이 아니다.

### '신뢰'라는 금융의 본질
금융 시스템의 본질은 돈을 보관하고 안전하게 이동시키는 것이다. 회계 불일치로 인한 법적/규제적 리스크는 물론, 금융 기관이 가진 가장 큰 자산인 '신뢰'가 단번에 무너진다.

### 동시성 환경에서의 'Double-Spending(중복 사용)' 위험
잔액이 10만 원인 계좌에서 거의 동시 시점에 10만 원 출금 요청 2건이 들어오는 상황을 생각해보자. 만약 트랜잭션과 락(Lock)을 통한 데이터 정합성이 보장되지 않는다면, 두 요청 모두 잔액 조회를 통과하여 계좌에서 총 20만 원이 출금되는 기괴한 현상이 발생할 수 있다.

### RDB는 'Single Source of Truth'
Redis나 Kafka 같은 기술로 아무리 빠른 성능과 멱등성을 제공하더라도, '사용자의 최종 잔액과 거래 기록'을 보장하는 최종 원천은 RDB이다. DB 단에서 ACID 트랜잭션과 격리 수준(Isolation Level)을 통해 데이터 정합성의 배수진을 치지 않는다면, 그 어떤 고급 아키텍처도 무의미해진다.

---

# 트랜잭션(Transaction)
"트랜잭션(Transaction)"이라는 단어는 "거래"라는 사전적 의미를 기반으로 하지만, 어떤 영역에서 사용되느냐에 따라 주체, 목적, 보장하는 메커니즘이 조금씩 달라진다.

| 구분 | 금융 트랜잭션 | SQL 트랜잭션 | 기술적 트랜잭션 |
|---|---|---|---|
| **의미** | 금전적 가치의 이동 또는 거래 | DB 변경 작업의 단위 | 하나의 논리적 작업 단위 |
| **관점** | 비즈니스 / 회계 | 데이터베이스 (RDB) | 애플리케이션 / 시스템 |
| **보장 방식** | 법적 규제, 금융사 원장 | RDB 엔진 (ACID, WAL) | Spring AOP, 2PC, Saga 패턴 |

고객이 어플에서 입금을 누르는 것은 [금융 트랜잭션]이며, 이 요청을 받는 은행 애플리케이션의 @Transactional 서비스 메서드는 [기술적 트랜잭션]이고, 그 내부에서 DB 계좌 잔액을 바꾸는 FOR UPDATE + UPDATE 쿼리는 [SQL 트랜잭션]이 된다.

- 원자성 (Atomicity)
  - 트랜잭션이 데이터베이스에 모두 반영되던가, 아니면 전혀 반영되지 않아야 한다. 
- 일관성 (Consistency)
  - 트랜잭션의 작업 처리 결과가 항상 일관성이 있어야 한다. 
- 독립성 (Isolation)
  - 어떤 하나의 트랜잭션이라도, 다른 트랜잭션의 연산에 끼어들 수 없다. 
- 영구성 (Durability)
  - 결과는 영구적으로 반영되어야 한다.

---

# 트랜잭션에서 발생하는 동시성 문제
Core 뱅킹 시스템에서는 단순히 "동시 처리를 빨리 하느냐"보다 "동시 요청이 몰려도 계좌 잔액과 거래 내역이 단 1원의 오차 없이 정확한가"가 최우선 과제이다.

| 문제                      | 핵심                                | 예시                                                              |
| ----------------------- | --------------------------------- | --------------------------------------------------------------- |
| **Dirty Read**          | 아직 **커밋되지 않은 데이터**를 읽음            | A가 데이터를 수정했지만 커밋하기 전에 B가 읽음 → A가 롤백하면 B는 잘못된 데이터를 읽은 것          |
| **Non-Repeatable Read** | 같은 데이터를 **두 번 읽었는데 값이 달라짐**       | A가 데이터를 읽은 후 B가 수정·커밋 → A가 다시 읽으니 값이 달라짐                        |
| **Phantom Read**        | 같은 조건으로 조회했는데 **행(Row)의 개수가 달라짐** | A가 `WHERE` 조건으로 조회 → B가 조건에 맞는 행을 추가·커밋 → A가 다시 조회하니 새로운 행이 나타남 |

Core 뱅킹 관점에서 발생 가능한 3가지 이상 현상은 다음과 같다.

## Core 뱅킹 시나리오

#### Dirty Read 발생
1. A가 B에게 100만 원을 송금하는 중 (A 계좌 잔액 차감 완료, 아직 커밋 전)
2. 이때 B가 잔액 조회를 수행하여 차감된 A의 잔액을 확인
3. 송금 트랜잭션 중 오류가 발생하여 롤백(Rollback)됨
4. B는 실제로 존재하지도 않는 '차감된 잔액'을 본 셈이 됨 (데이터 환상 발생)

#### Non-Repeatable Read 발생
1. 이자 계산 배치 트랜잭션이 A 계좌의 잔액을 조회 (100만 원)
2. 그 순간, A가 체크카드로 3만 원을 결제하여 커밋됨 (UPDATE 실행)
3. 이자 계산 트랜잭션이 검증을 위해 A 계좌 잔액을 다시 조회 (97만 원으로 변경됨)
4. 하나의 이자 계산 과정 내에서 계좌 잔액 기준값이 변해버림.

#### Phantom Read 발생
1. 관리자가 "오늘 발생한 100만 원 이상 거래 내역 목록"을 조회 (총 5건)
2. 조회 도중, 한 고객이 새로 150만 원 입금을 완료함 (INSERT 실행 및 커밋)
3. 관리자 트랜잭션이 집계를 위해 동일한 범위 조회를 재실행함 (총 6건으로 변경됨)
4. 전체 집계 건수나 합계 금액이 조회 중간에 변경됨.

---

# Isolation Level

RDB의 트랜잭션 격리 수준(Isolation Level)은 여러 트랜잭션이 동시에 실행될 때, 어느 정도까지 서로의 변경 사항을 가릴 것인가를 결정하는 기준이다. 격리 수준이 낮을수록 동시 처리 성능(TPS)은 올라가지만 데이터 정합성이 깨질 위험이 커지고, 반대로 격리 수준이 높으면 정합성은 강력해지지만 락(Lock) 대기로 인한 성능 저하나 데드락(Deadlock) 위험이 증가한다.

ANSI/ISO SQL 표준은 이상 현상의 허용 여부에 따라 격리 수준을 4단계로 정의한다.

| 격리 수준 (Isolation Level) | Dirty Read | Non-Repeatable Read | Phantom Read | 비고 및 뱅킹 관점 특징 |
|---|---|---|---|---|
| READ UNCOMMITTED | 발생 | 발생 | 발생 | 커밋 안 된 데이터도 읽음. 금융권에서는 절대 금지. |
| READ COMMITTED | 없음 | 발생 | 발생 | 커밋된 데이터만 읽음. Oracle/PostgreSQL 기본값. |
| REPEATABLE READ | 없음 | 없음 | 발생* | 자신의 트랜잭션 시작 시점 MVCC Snapshot 참조. MySQL InnoDB 기본값. |
| SERIALIZABLE | 없음 | 없음 | 없음 | 모든 읽기에 락을 걸어 완전 직렬화. 성능 저하가 매우 심함. |

*참고 (MySQL InnoDB의 특수성): MySQL InnoDB 엔진은 REPEATABLE READ 수준에서도 MVCC(Multi-Version Concurrency Control)와 넥스트 키 락(Next-Key Lock)을 활용해 일반적인 SELECT 쿼리에서의 Phantom Read를 대부분 방지한다.

## Core 뱅킹에서 기본 격리 수준(READ COMMITTED / REPEATABLE READ)으로 충분할까?

대부분의 RDBMS는 기본값으로 READ COMMITTED나 REPEATABLE READ를 제공한다. 그러나 Core 뱅킹의 계좌 잔액 갱신(입출금/이체) 환경에서는 이 격리 수준만으로 부족한 결정적인 문제가 존재한다. 바로 **Lost Update(수정 손실 / Race Condition)** 때문이다.

```
[초기 잔액: 100만 원]

트랜잭션 A (입금 50만 원)                트랜잭션 B (출금 30만 원)
--------------------------------------    --------------------------------------
1. A 계좌 조회 (잔액: 100만 원)
                                          2. A 계좌 조회 (잔액: 100만 원)
3. 계산: 100 + 50 = 150만 원
4. UPDATE 잔액 = 150만 원
5. Commit
                                          6. 계산: 100 - 30 = 70만 원
                                          7. UPDATE 잔액 = 70만 원  <-- (A의 입금 내역이 덮어씌워져 날아감!)
                                          8. Commit
```

격리 수준을 무작정 최고 수준인 SERIALIZABLE로 올리면 DB 전체의 동시 처리량(TPS)이 무너진다.따라서 실제 Core 뱅킹 프로젝트에서는 다음과 같은 전략을 취한다.

- DB 기본 격리 수준은 READ COMMITTED 또는 REPEATABLE READ로 유지하여 전반적인 쿼리 성능을 확보한다.
- 잔액 변경처럼 동시성 충돌이 치명적인 핵심 도메인 로직에 한해서만 비관적 락(Pessimistic Lock, SELECT ... FOR UPDATE)을 적용하여 명시적으로 Row Level X-Lock(배타 락)을 획득한다.


---

# Lock을 통한 동시성 제어

트랜잭션 격리 수준(Isolation Level)과 락(Lock)은 DB 데이터 정합성을 유지하기 위해 떼려야 뗄 수 없는 관계이다.

"Isolation Level은 격리 목표(무엇을 막을 것인가)이고, Lock은 그 목표를 달성하기 위한 구체적인 수단(어떻게 막을 것인가)"이다.

## Isolation Level과 Lock의 본질적인 관계
- Isolation Level
  - DB 사용자/개발자에게 제공되는 '정책(Policy) 및 보장 범위'이다.
  - "어느 정도의 데이터 이상 현상(Dirty Read, Non-Repeatable Read, Phantom Read)을 허용할 것인가?"를 정의한다.
- Lock
  - DB 엔진 내부에서 그 정책을 실제로 강제하기 위해 사용하는 '물리적 메커니즘(Mechanism)'이다.
  - 특정 데이터 Row나 Table, Index에 concurrent 접근을 막는 열쇠 역할을 한다.

### Shared Lock과 Exclusive Lock

- Shared Lock (S-Lock, 공유 락 / 읽기 락)
  - 데이터를 읽을 때(SELECT) 사용한다.
  - 다른 트랜잭션이 동시에 읽는 것(S-Lock)은 허용하지만, 수정하는 것(X-Lock)은 차단한다.
- Exclusive Lock (X-Lock, 배타 락 / 쓰기 락)
  - 데이터를 변경할 때(INSERT, UPDATE, DELETE) 사용한다.
  - 다른 트랜잭션이 읽는 것도(S-Lock), 수정하는 것도(X-Lock) 모두 차단한다.

### 낙관적 락과 비관적 락
- 낙관적 락 (Optimistic Lock)
  - 트랜잭션들이 충돌하지 않을 것이라고 낙관적으로 가정하는 방식이다.
  - 데이터베이스가 제공하는 락을 쓰지 않고, 애플리케이션 레벨에서 버전(@Version) 정보를 이용한다. 
  - 락을 직접 걸지 않아 동시 요청 성능이 좋지만, 충돌이 발생하면 트랜잭션이 롤백되므로 애플리케이션에서 재시도 로직을 직접 구현해야 한다.

<img src="/img/posts/architecture/consistency/1.png" alt="낙관적 락" width="800">

- 비관적 락 (Pessimistic Lock)
  - 트랜잭션들이 동일한 데이터를 동시에 수정할 것이라고 비관적으로 가정하여, 데이터를 읽는 순간부터 데이터베이스 락을 거는 방식이다.
  - 비관적 락은 SELECT ... FOR UPDATE SQL 쿼리로 실행되며, 대상 Row에 X-Lock(Exclusive Lock, 배타 락)을 획득한다. 
  - 데이터 무결성을 강력하게 보장하지만, 대기 시간으로 인해 동시성이 떨어지거나 데드락(교착 상태)이 발생할 수 있다.

<img src="/img/posts/architecture/consistency/2.png" alt="비관적 락" width="800">

#### 왜 금융 계좌 시스템에서는 비관적 락인가?
- 낙관적 락(Optimistic Lock - @Version)의 한계
  - 충돌 발생 시 예외를 던지고 애플리케이션에서 재시도(Retry)해야 한다. 트래픽이 몰리는 계좌(예: 인기 상품 결제 계좌, 법인 계좌)에서는 재시도 비용이 매우 크고, 커넥션만 소모하다 실패할 확률이 높다. 
- 비관적 락의 장점
  - 데이터베이스 수준에서 순차적으로 줄을 세워(Linearization) 데이터 정합성을 확실히 보장한다.

---

# Spring Boot + JPA 구현 예시

## Core 뱅킹 입출금/잔액 갱신 시 비관적 락 적용 코드

### Repository 계층
JPA에서는 @Lock 어노테이션을 제공한다. 비관적 쓰기 락(PESSIMISTIC_WRITE)을 설정하면 JPA가 내부적으로 SELECT ... FOR UPDATE 쿼리가 실행된다.

```
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {

    // 배타 락(X-Lock)을 이용한 계좌 조회
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.accountNumber = :accountNumber")
    Optional<Account> findByAccountNumberForUpdate(@Param("accountNumber") String accountNumber);
}
```

### Service 계층 (계좌 잔액 갱신)
```
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;

@Service
public class AccountService {

    private final AccountRepository accountRepository;

    public AccountService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    /**
     * 계좌 출금 로직 (동시성 제어 적용)
     */
    @Transactional
    public void withdraw(String accountNumber, BigDecimal amount) {
        // 1. SELECT ... FOR UPDATE 를 통한 Row Lock 획득 및 조회
        Account account = accountRepository.findByAccountNumberForUpdate(accountNumber)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 계좌입니다."));

        // 2. 비즈니스 검증 (잔액 부족 여부)
        if (account.getBalance().compareTo(amount) < 0) {
            throw new IllegalStateException("잔액이 부족합니다.");
        }

        // 3. 잔액 차감
        account.withdraw(amount);
        
        // 4. 메서드 종료 시 @Transactional에 의해 트랜잭션 Commit 및 락 자동 해제
    }
}
```

## 데드락(Deadlock) 방지 전략
비관적 락을 사용할 때 가장 주의해야 할 문제는 데드락(교착 상태)이다.

### 데드락 발생 시나리오 (계좌 이체 시)
A계좌에서 B계좌로, 동시에 B계좌에서 A계좌로 송금할 때 발생한다.

1. 트랜잭션 1 (A -> B 이체): A계좌 락 획득 후 B계좌 락 획득 시도
2. 트랜잭션 2 (B -> A 이체): B계좌 락 획득 후 A계좌 락 획득 시도
3. 결과: 서로 상대방의 락 해제를 무한히 기다리는 교착 상태 발생

### Lock Ordering (순차적 락 획득)
가장 권장됨 계좌 식별자(계좌번호, Account ID 등)를 정렬하여 **항상 동일한 순서로 락을 획득**하도록 강제한다.
```
@Transactional
public void transfer(String fromAccountNumber, String toAccountNumber, BigDecimal amount) {
    // 계좌번호 순서로 정렬하여 항상 같은 순서로 락을 점유하도록 정렬
    boolean isFromFirst = fromAccountNumber.compareTo(toAccountNumber) < 0;
    String firstAccountNo = isFromFirst ? fromAccountNumber : toAccountNumber;
    String secondAccountNo = isFromFirst ? toAccountNumber : fromAccountNumber;

    // 순서대로 락 획득
    Account firstAccount = accountRepository.findByAccountNumberForUpdate(firstAccountNo).orElseThrow();
    Account secondAccount = accountRepository.findByAccountNumberForUpdate(secondAccountNo).orElseThrow();

    Account fromAccount = fromAccountNumber.equals(firstAccount.getAccountNumber()) ? firstAccount : secondAccount;
    Account toAccount = toAccountNumber.equals(firstAccount.getAccountNumber()) ? firstAccount : secondAccount;

    // 이체 로직 수행
    fromAccount.withdraw(amount);
    toAccount.deposit(amount);
}
```

### Lock Timeout (락 획득 타임아웃 설정)
락을 얻지 못하고 무한 대기하는 것을 방지하기 위해 JPA Query Hint로 타임아웃을 설정한다.
```
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.QueryHints;

public interface AccountRepository extends JpaRepository<Account, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints({@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000")}) // 3초 대기 후 예외 발생
    @Query("SELECT a FROM Account a WHERE a.accountNumber = :accountNumber")
    Optional<Account> findByAccountNumberForUpdate(@Param("accountNumber") String accountNumber);
}
```

### Redis 분산 락과의 조합 (상위 레이어 차단)
RDB 비관적 락으로 진입하기 전, Redis 분산 락을 통해 애플리케이션 진입점에서 먼저 동시 요청을 정렬한다. DB 커넥션 풀 고갈을 방지하고 RDB에 가해지는 부담을 줄일 수 있다.

---

# Redis 분산 락과 RDB Lock을 함께 사용하는 이유
**Redis의 분산 락**은 여러 서버에서 동시에 같은 작업을 수행하지 않도록 제어하는 역할이고, **RDB의 트랜잭션**은 실제 데이터 변경이 원자적으로 처리되고 정합성이 유지되도록 보장하는 역할이다.

Core 뱅킹 시스템에서 Redis 분산 락과 RDB 비관적 락은 서로 대체 관계가 아니라, 계층별로 역할을 나누어 시스템 전체의 정합성과 안정성을 함께 끌어올리는 완벽한 콤비이다.

### RDB 비관적 락만 사용할 때의 한계
동시 요청(Traffic Spike)이 한꺼번에 몰릴 때, 모든 요청이 RDB의 커넥션을 잡은 채 SELECT ... FOR UPDATE 락 대기 상태에 들어간다. 이는 DB Connection Pool 고갈, Transaction Timeout, 전체 시스템 락업(Lock-up)으로 이어진다.

### Redis 분산 락만 사용할 때의 한계
Redis는 인메모리 기반이라 매우 빠르지만, 네트워크 튐, Redis cluster failover, Master-Replica 간 동기화 지연(Replication Lag) 등으로 아주 희귀하게 분산 락이 상실될 가능성이 존재한다. 단 1원의 오차도 허용하지 않는 Core 뱅킹에서 Redis만 믿고 DB 락을 풀기에는 위험하다.

## 기술별 역할 분담

| 구분 | Redis 분산 락 (Redisson) | RDB 비관적 락 (`FOR UPDATE`) |
|---|---|---|
| **위치** | 애플리케이션 진입점 (1차 방어선) | 데이터베이스 레이어 (2차 방어선) |
| **주요 목적** | DB 보호 및 동시 진입 차단 | 데이터의 최종 정합성 보장 (SSOT) |
| **처리 방식** | 애플리케이션 단에서 요청을 순차적으로 줄 세우거나 빠르게 실패 처리 | Row Level X-Lock을 통한 스토리지 레벨 격리 |
| **장점** | DB 커넥션 소모 없음, 빠른 처리 속도 | ACID 트랜잭션 보장, 높은 데이터 안전성 |
| **단점** | Redis 장애 시 락 상실 가능성 | 커넥션 대기 증가, DB CPU/메모리 부하 |

## 전체 아키텍처 흐름 (Core 뱅킹 입출금)
```
[클라이언트 요청] 
       │
       ▼
[1. Redis 분산 락 획득 시도] ──(락 획득 실패)──> [즉시 재시도 or 예외 반환 (DB 커넥션 사용 안 함)]
       │ (락 획득 성공)
       ▼
[2. Spring @Transactional 시작] (DB 커넥션 획득)
       │
       ▼
[3. RDB 비관적 락 조회의 (SELECT ... FOR UPDATE)] ──> [DB Row Level X-Lock 확정]
       │
       ▼
[4. 비즈니스 로직 수행] (잔액 검증 및 차감)
       │
       ▼
[5. Spring @Transactional Commit] ──> [RDB 비관적 락 자동 해제]
       │
       ▼
[6. Redis 분산 락 해제]
       │
       ▼
[클라이언트 응답 성공]
```

#### 1단계: App Level (Redis 분산 락)

요청이 들어오면 @RedissonLock(key = "LOCK:ACCOUNT:" + accountNo) 등을 통해 Redis에 락을 요청한다.

이미 동일 계좌에 대한 처리 중인 요청이 있다면, DB 커넥션을 맺기도 전에 애플리케이션 단에서 대기하거나 Fast-Fail(대기 시간 초과) 처리한다.
이를 통해 RDB로 들어가는 비정상적인 동시 커넥션 수 폭증을 방지한다.

### 2단계: DB Level (RDB 비관적 락)

Redis 락을 획득한 안전한 요청만 @Transactional 영역으로 진입해 DB 커넥션을 가져온다.

AccountRepository.findByAccountNumberForUpdate()를 호출하여 DB Row에 FOR UPDATE 락을 거는 순간, 혹시라도 존재할 수 있는 분산 락의 틈새까지 완전 차단한다.

#### 3단계: 트랜잭션 종료 및 락 해제

반드시 DB 트랜잭션이 Commit/Rollback된 이후에 Redis 분산 락을 해제해야 한다.

만약 DB 트랜잭션이 커밋되기 전에 Redis 락을 풀어버리면, 대기 중이던 다른 요청이 Redis 락을 취득하여 아직 DB에 커밋되지 않은 데이터를 읽는 Race Condition이 재발한다.

## 코드 패턴 예시 (AOP 기반)
Spring AOP를 활용해 트랜잭션 커밋 이후에 Redis 락이 해제되도록 구현하는 패턴이다.

```
@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE) // @Transactional보다 먼저 실행되도록 설정
public class DistributedLockAop {

    private final RedissonClient redissonClient;
    private final AopForTransaction aopForTransaction;

    @Around("@annotation(redissonLock)")
    public Object lock(final ProceedingJoinPoint joinPoint, final RedissonLock redissonLock) throws Throwable {
        String key = CustomSpringELParser.getDynamicValue(joinPoint.getArgs(), redissonLock.key());
        RLock lock = redissonClient.getLock(key);

        try {
            // 1. Redis 분산 락 획득 시도 (타임아웃 설정)
            boolean available = lock.tryLock(redissonLock.waitTime(), redissonLock.leaseTime(), redissonLock.timeUnit());
            if (!available) {
                throw new LockAcquisitionException("현재 계좌에 대한 다른 요청이 처리 중입니다.");
            }

            // 2. 별도의 트랜잭션 생성 및 비즈니스 로직 수행 (내부에서 RDB 비관적 락 실행)
            return aopForTransaction.proceed(joinPoint);

        } finally {
            // 3. DB 트랜잭션이 완전히 커밋된 후 Redis 락 해제
            try {
                lock.unlock();
            } catch (IllegalMonitorStateException e) {
                // 이미 해제된 락 예외 처리
            }
        }
    }
}
```

---

# 결론
이번 글의 핵심은 "금융 트랜잭션" 자체를 설명하는 것이 아니라, "금융 거래를 시스템에서 안전하게 처리하기 위해 RDB 트랜잭션이 어떤 역할을 하는가"이다. 이는 앞서 공부한 Redis 멱등성과도 연결된다.

- 금융 Transaction 자체가 중복 실행되지 않도록 하는 문제 → Idempotency / Redis
- 하나의 Transaction 내부 작업이 원자적으로 처리되는 문제 → DB Transaction / ACID
- 동시에 실행되는 Transaction 간 충돌을 제어하는 문제 → Isolation Level / Lock
- 여러 서버가 동시에 같은 작업을 수행하는 문제 → Distributed Lock

이렇게 각 기술이 해결하는 문제가 다르다는 걸 이해하면 처음 고민했던 "AI가 코드를 짜주는 시대에 백엔드 개발자가 책임져야 하는 영역은 무엇인가?"라는 질문에도 답이 된다. 결국 중요한 건 기술을 많이 사용하는 것이 아니라, 어떤 데이터 정합성 문제를 어떤 계층에서 해결해야 하는지 설계하고 판단하는 것이다.


### 참고

[Gemini](https://gemini.google.com/)<br>
[ChatGPT](https://chatgpt.com/)<br>
[분산 트랜잭션](https://ko.wikipedia.org/wiki/%EB%B6%84%EC%82%B0_%ED%8A%B8%EB%9E%9C%EC%9E%AD%EC%85%98)<br>
[이제 나도 MSA 전문가: 개념부터 실무까지](https://www.msap.ai/docs/msa-expert-from-concepts-to-practice/part-1-msa-fundamentals/chapter-2-core-concepts-of-msa/section-2-5-data-management/subsection-2-5-3-distributed-transactions/)<br>
[사가 패턴(saga pattern)과 분산 트랜잭션(distributed transaction)](https://junhyunny.github.io/msa/design-pattern/distributed-transaction/)<br>
[제12장 분산 트랜잭션](https://technet.tmax.co.kr/upload/download/online/tibero/pver-20240502-000002/tibero_admin/chapter_07.html)<br>
[MSA 환경에서 SAGA 패턴으로 안전한 분산 트랜잭션 구현하기](https://haon.blog/article/toss-slash/msa-reward-transaction/)<br>
[[ETC] 분산 트랜잭션](https://ones1kk.tistory.com/entry/ETC-%EB%B6%84%EC%82%B0-%ED%8A%B8%EB%9E%9C%EC%9E%AD%EC%85%98-%EC%B2%98%EB%A6%AC-%EC%A0%84%EB%9E%B5-MA-%ED%99%98%EA%B2%BD%EC%97%90-%EC%A0%81%EC%9A%A9%ED%95%98%EA%B8%B01)<br>
[MSA 환경에서 네트워크 예외를 잘 다루는 방법](https://tech.kakaopay.com/post/msa-transaction/)<br>
[메시지 큐의 이해와 실제 적용 사례](https://f-lab.kr/insight/understanding-message-queues)