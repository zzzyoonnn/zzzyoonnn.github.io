---
layout: post
title: "왜 시스템 간 통신에 Message Queue를 사용하는 걸까?🤔"
subtitle: "비동기 처리와 서비스 분리부터 RabbitMQ와 Kafka의 차이까지"
date: 2026-07-11
permalink: /posts/2026/10/architecture/message-queue/
background: '/img/backgrounds/architecture/message-queue.png'
categories: architecture

tags:
    - Architecture
    - Financial
    - FinTech
    - Redis
    - Kafka
---

## 목차
1. Message Oriented Middleware(MOM)
2. Message Queue
    - Message Queue란?
    - 기본 구조
    - 메시징 모델
        - Point-to-Point
        - Publish/Subscribe
3. Message Queue를 사용하는 이유
    - 비동기 처리 (Asynchronous)
    - 낮은 결합도 (Decoupling)
    - 복원력 (Resilience)
    - 신뢰성 (Reliability)
    - 확장성 (Scalability)
4. Message Broker와 Event Streaming Platform
5. 대표적인 오픈소스 메시징 시스템
    - RabbitMQ
    - ActiveMQ
    - ZeroMQ
    - Kafka
6. 정리

---

# Message Oriented Middleware(MOM)

Message Oriented Middleware(MOM)는 **애플리케이션 사이에서 메시지를 주고받을 수 있도록 중간에서 통신을 지원하는 미들웨어**이다.

애플리케이션이 서로 직접 통신하는 대신 MOM을 통해 메시지를 전달함으로써 송신자와 수신자를 분리할 수 있다.

특히 비동기 메시징에서는 송신자가 메시지를 전달한 뒤 수신자의 처리가 끝날 때까지 기다릴 필요가 없다.

MOM 구현체에 따라 다음과 같은 기능을 제공할 수 있다.

- **저장(Storage)**: 메시지를 일정 기간 보관한다.
- **라우팅(Routing)**: 조건에 따라 메시지를 적절한 목적지로 전달한다.
- **전달 보장(Delivery Guarantees)**: ACK, 영속화, 재시도 등을 통해 메시지 유실 가능성을 낮춘다.
- **변환(Transformation)**: 일부 미들웨어에서는 시스템 간 메시지 형식을 변환한다.

Message Queue는 이러한 **MOM을 구현하는 대표적인 메시징 방식 중 하나**이다.

---

# Message Queue

## Message Queue란?

Queue는 먼저 들어온 데이터가 먼저 나가는 `FIFO(First In, First Out)` 구조의 자료구조이다.

Message Queue는 이러한 Queue 개념을 기반으로 **애플리케이션 사이에서 메시지를 저장하고 전달하는 메시징 방식**이다.

메시지를 보내는 주체를 `Producer`, 메시지를 처리하는 주체를 `Consumer`라고 한다.

```text
Producer → Message Queue → Consumer
```

Producer는 Consumer를 직접 호출하는 대신 Queue에 메시지를 전달하고, Consumer는 Queue에서 메시지를 가져와 처리한다.

이를 통해 **메시지를 생성하는 작업과 처리하는 작업을 분리할 수 있다.**

> 실제 메시징 시스템이 항상 엄격한 FIFO를 보장하는 것은 아니다. 우선순위, 파티션, 여러 Consumer 등의 구성에 따라 처리 순서는 달라질 수 있다.

---

## 기본 구조

Message Queue의 가장 기본적인 구조는 다음과 같다.

```text
Producer
   │
   │ Message
   ▼
┌───────────────┐
│ Message Queue │
└───────────────┘
   │
   ▼
Consumer
```

1. Producer가 메시지를 생성한다.
2. 메시지를 Queue에 전달한다.
3. Queue는 메시지를 보관한다.
4. Consumer가 메시지를 가져와 처리한다.
5. 처리가 완료되면 ACK 등을 통해 처리 완료를 확인할 수 있다.

여러 Producer와 Consumer가 하나의 Queue를 사용할 수도 있다.

```text
Producer 1 ─┐
Producer 2 ─┼─→ Queue ─┬─→ Consumer 1
Producer 3 ─┘          ├─→ Consumer 2
                       └─→ Consumer 3
```

여러 Consumer가 하나의 Queue를 함께 소비하는 **Competing Consumers** 구조에서는 일반적으로 하나의 메시지를 하나의 Consumer가 담당하도록 분배할 수 있다.

---

## 메시징 모델

메시징 시스템에서는 메시지를 어떤 Consumer에게 전달할 것인지에 따라 여러 모델을 사용할 수 있다.

대표적으로 `Point-to-Point`와 `Publish/Subscribe`가 있다.

### Point-to-Point

```text
Producer → Queue → Consumer
```

Producer가 Queue에 메시지를 전달하고 여러 Consumer가 경쟁하여 메시지를 처리한다.

일반적으로 **하나의 메시지는 하나의 Consumer가 처리**한다.

따라서 주문 처리, 이메일 발송, 정산 작업처럼 하나의 작업을 특정 Worker가 처리하면 되는 경우에 적합하다.

![Point-to-Point](/img/posts/architecture/message-queue/point-to-point.png)

### Publish/Subscribe

```text
                    ┌→ Subscriber A
Publisher → Topic ──┼→ Subscriber B
                    └→ Subscriber C
```

메시지를 생성하는 주체를 `Publisher`, 메시지를 구독하는 주체를 `Subscriber`라고 한다.

Publisher가 `Topic`에 메시지를 발행하면 해당 Topic을 구독하고 있는 여러 Subscriber가 메시지를 받을 수 있다.

따라서 하나의 이벤트를 **여러 시스템에서 각각 처리해야 하는 경우**에 적합하다.

예를 들어 결제 완료 이벤트를 발행했을 때 알림, 포인트, 주문, 데이터 분석 시스템 등이 각각 이벤트를 받아 처리하는 구조를 만들 수 있다.

![Publish/Subscribe](/img/posts/architecture/message-queue/pub-sub.png)


---

# Message Queue를 사용하는 이유

## 비동기 처리 (Asynchronous)

Producer가 Consumer를 직접 호출하면 Consumer의 작업이 끝날 때까지 결과를 기다려야 하는 경우가 있다.

Message Queue를 사용하면 Producer는 메시지를 Queue에 전달한 뒤 자신의 작업을 계속하고, Consumer는 독립적으로 메시지를 처리할 수 있다.

즉, **Producer와 Consumer의 처리 시점을 분리할 수 있다.**

---

## 낮은 결합도 (Decoupling)

Producer는 Consumer를 직접 호출할 필요 없이 정해진 메시지를 전달하면 된다.

따라서 두 서비스 사이의 직접적인 의존성을 줄이고 **각 서비스를 독립적으로 변경하고 확장하기 쉬워진다.**

이러한 특성 때문에 Message Queue는 MSA와 이벤트 기반 아키텍처에서 자주 활용된다.

---

## 복원력 (Resilience)

Consumer에 일시적인 장애가 발생하더라도 메시지를 Queue에 보관할 수 있다.

Consumer가 복구된 이후 저장된 메시지를 다시 처리할 수 있으므로 **한 서비스의 장애가 다른 서비스로 직접 전파되는 것을 완화할 수 있다.**

---

## 신뢰성 (Reliability)

메시징 시스템은 제품과 설정에 따라 ACK, 메시지 영속화, 재시도, Dead Letter Queue(DLQ) 등의 기능을 제공한다.

이를 통해 메시지 유실 가능성을 낮추고 실패한 메시지를 다시 처리할 수 있다.

다만 `At-least-once` 방식에서는 동일한 메시지가 여러 번 전달될 수 있으므로 **Consumer의 멱등성(Idempotency)** 역시 중요하다.

---

## 확장성 (Scalability)

처리해야 할 메시지가 증가하면 Consumer를 추가하여 작업을 분산할 수 있다.

```text
              ┌→ Consumer 1
Queue ────────┼→ Consumer 2
              └→ Consumer 3
```

또한 Queue가 메시지를 일시적으로 저장하는 `Buffer` 역할을 하기 때문에 순간적으로 요청이 증가하더라도 Consumer가 자신의 처리 속도에 맞춰 작업할 수 있다.

이를 통해 **트래픽을 완충하고 Consumer를 수평 확장하여 처리량을 높일 수 있다.**

---

# Message Broker와 Event Streaming Platform

메시징 시스템을 이해할 때 RabbitMQ와 Kafka의 차이를 이해하는 것이 중요하다.

다만 이를 단순히 `Message Broker`와 `Event Broker`라는 두 종류의 Message Queue로 구분하기보다는 **메시지 전달 중심의 시스템과 이벤트 스트림 저장·처리 중심의 시스템**으로 이해하는 편이 정확하다.

## Message Broker

RabbitMQ나 ActiveMQ가 대표적이다.

```text
Producer → Broker → Consumer
```

Message Broker는 Producer로부터 메시지를 받아 Queue 등에 저장하고 적절한 Consumer에게 전달한다.

핵심 목적은 **메시지를 목적지까지 안정적으로 전달하고 작업을 분배하는 것**이다.

ACK, Routing, Retry, Dead Letter Queue 등의 기능을 활용하여 메시지 전달 과정을 세밀하게 제어할 수 있다.

대표적인 시스템으로는 다음이 있다.

- RabbitMQ
- ActiveMQ

---

## Event Streaming Platform

Kafka가 대표적이다.

```text
Producer → Topic / Partition → Consumer
                         ↑
                    Offset
```

Kafka에서는 이벤트를 Topic의 Partition에 순차적으로 기록하고 설정된 보존 기간 동안 유지한다.

Consumer가 메시지를 가져갔다고 바로 삭제하는 구조가 아니라 **Consumer가 자신의 Offset을 관리하면서 이벤트를 읽는다.**

따라서 같은 이벤트를 여러 Consumer Group이 독립적으로 읽거나 필요한 경우 과거 이벤트를 다시 처리할 수 있다.

이 때문에 Kafka는 단순한 작업 전달뿐 아니라 다음과 같은 환경에서 강점을 가진다.

- 대규모 이벤트 스트리밍
- 로그 수집
- 데이터 파이프라인
- 이벤트 기반 아키텍처
- 이벤트 재처리

즉, **RabbitMQ는 메시지를 어떻게 전달할 것인가에 강점이 있고, Kafka는 발생한 이벤트를 어떻게 저장하고 여러 시스템에서 활용할 것인가에 강점이 있다.**

---

# 대표적인 오픈소스 메시징 시스템

## RabbitMQ

RabbitMQ는 대표적인 **Message Broker**이다.

메시지 라우팅과 전달 제어가 강력하며 ACK, 재전달, Dead Letter Exchange, Priority Queue 등의 다양한 기능을 제공한다.

따라서 주문 처리, 알림, 결제 후속 처리와 같이 **작업을 비동기로 전달하고 안정적으로 처리해야 하는 환경**에서 활용할 수 있다.

**핵심: 메시지 전달과 라우팅**

---

## ActiveMQ

ActiveMQ는 Apache에서 개발한 Message Broker이다.

JMS(Java Message Service)를 지원하며 다양한 메시징 프로토콜 및 기존 엔터프라이즈 시스템과의 연동에 강점이 있다.

따라서 **Java 기반 엔터프라이즈 시스템이나 기존 시스템과 메시징 시스템을 연동해야 하는 환경**에서 활용할 수 있다.

**핵심: 엔터프라이즈 메시징과 JMS**

---

## ZeroMQ

ZeroMQ는 RabbitMQ나 ActiveMQ와 성격이 다르다.

별도의 중앙 Broker를 운영하는 메시징 서버가 아니라 **애플리케이션에 포함하여 사용하는 경량 메시징 라이브러리**이다.

애플리케이션 사이에서 다양한 메시징 패턴을 구현할 수 있으며 중앙 Broker를 반드시 거치지 않아 저지연 통신에 활용할 수 있다.

다만 Broker가 제공하는 메시지 영속화나 중앙 집중적인 메시지 관리 등을 애플리케이션 측에서 별도로 고려해야 할 수 있다.

**핵심: 경량·저지연 메시징**

---

## Kafka

Kafka는 **분산 이벤트 스트리밍 플랫폼**이다.

이벤트를 Topic의 Partition에 기록하고 일정 기간 보관하며 Consumer는 Offset을 기준으로 이벤트를 읽는다.

높은 처리량과 확장성, 이벤트 보존 및 재처리가 중요한 환경에서 강점을 가진다.

따라서 대규모 이벤트 처리, 로그 수집, 데이터 파이프라인, 이벤트 기반 시스템 등에 널리 활용된다.

**핵심: 대규모 이벤트 저장과 스트리밍**

---

## 간단히 비교하면

| 시스템 | 분류 | 핵심 특징 | 적합한 환경 |
|---|---|---|---|
| **RabbitMQ** | Message Broker | Routing, ACK, 메시지 전달 | 비동기 작업 처리 |
| **ActiveMQ** | Message Broker | JMS, 엔터프라이즈 연동 | Java/레거시 시스템 |
| **ZeroMQ** | Messaging Library | Brokerless, 저지연 | 빠른 프로세스 간 통신 |
| **Kafka** | Event Streaming Platform | 이벤트 저장, 재처리, 높은 처리량 | 대규모 이벤트 스트리밍 |

---

# 정리

Message Queue는 **Producer와 Consumer 사이에서 메시지를 전달하여 두 시스템의 처리 시점과 의존성을 분리하는 메시징 방식**이다.

![Point-to-Point](/img/posts/architecture/message-queue/message-queue.png)

이를 통해 비동기 처리, 낮은 결합도, 장애 격리, 신뢰성 있는 메시지 처리, 수평 확장 등의 장점을 얻을 수 있다.

하지만 모든 메시징 시스템이 동일한 방식으로 동작하는 것은 아니다.

RabbitMQ와 ActiveMQ는 **메시지를 목적지까지 안정적으로 전달하는 Message Broker**에 가깝고, Kafka는 **이벤트를 지속적으로 저장하고 여러 Consumer가 활용할 수 있도록 하는 Event Streaming Platform**에 가깝다. ZeroMQ는 이들과 달리 별도의 Broker 없이 메시징 기능을 제공하는 라이브러리이다.

따라서 메시징 시스템을 선택할 때는 단순히 성능만 비교하기보다 다음과 같은 질문이 중요하다.

**“메시지를 안정적으로 전달하는 것이 중요한가, 아니면 발생한 이벤트를 저장하고 여러 시스템에서 지속적으로 활용하는 것이 중요한가?”**

이 차이를 이해하면 RabbitMQ와 Kafka가 각각 어떤 문제를 해결하기 위해 사용되는지도 자연스럽게 이해할 수 있다.



### 참고

[Gemini](https://gemini.google.com/)<br>
[ChatGPT](https://chatgpt.com/)<br>
[Claude.ai](https://claude.ai/)<br>
[메시지 대기열이란 무엇인가요?](https://www.ibm.com/kr-ko/think/topics/message-queues)<br>
[[서버] 메세지 큐(Message Queue)을 알아보자](https://velog.io/@choidongkuen/%EC%84%9C%EB%B2%84-%EB%A9%94%EC%84%B8%EC%A7%80-%ED%81%90Message-Queue-%EC%9D%84-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90)<br>
[메시지 큐(Message Queue)?? 그게 뭔데](https://joojae.com/what-is-message-queue/)<br>
[[IT정보] 메시지 큐(Message Queue, MQ) 개념](https://m.blog.naver.com/seek316/222117711303)<br>
[Point-to-Point vs Publish/Subscribe](https://developer.confluent.io/courses/microservices/point-to-point-vs-publish-subscribe/)<br>
[Point-to-point messaging](https://eda-visuals.boyney.io/visuals/point-to-point-messaging)<br>
[Understanding publish & subscribe messaging](https://eda-visuals.boyney.io/visuals/publish-subscribe)














