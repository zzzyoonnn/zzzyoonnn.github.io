---
layout: post
title: "왜 JVM은 워밍업이 필요할까?🤔(JIT 컴파일과 실행 성능의 관계)"
subtitle: "JIT 컴파일이 Java 실행 성능에 미치는 영향"
date: 2026-08-08
permalink: /posts/2026/08/etc/jvm-warm-up
background: '/img/backgrounds/etc/jvm-warm-up.png'
categories: 

tags:
    - JVM
    - JIT-Compiler
    - Warm-up
    - Class Loading
    - Java
---

### 목차

1. 작성 이유
2. JVM
   - JVM의 구조
   - JVM의 작동 방식
3. Interpreter 
4. JIT Compiler
   - JIT 컴파일러의 작동 방식
   - Tier 구조
   - C1 Compiler
   - C2 Compiler
   - JIT 컴파일 설정 확인하기
5. JVM에서 웜업이 반드시 필요한 이유
6. 결론

---

# 작성 이유

리트코드 문제를 풀면서 Space Complexity를 개선했음에도 불구하고, 실행 결과에서는 눈에 띄는 차이가 나타나지 않았다. 그 이유가 궁금해 알아보게 되었다.

- [238. Product of Array Except Self](https://github.com/zzzyoonnn/LeetCode/blob/main/medium/238.%20Product%20of%20Array%20Except%20Self.md)
- [1137. N-th Tribonacci Number](https://github.com/zzzyoonnn/LeetCode/blob/main/easy/1137.%20N-th%20Tribonacci%20Number.md)

여러 가지 이유가 있겠지만, LeetCode의 채점 환경에 따라 같은 코드를 여러 번 제출하더라도 측정 결과가 일정하지 않을 수 있다. 특히 Java는 **JVM Warm-up과 JIT 컴파일의 영향, 서버의 부하 상태** 등에 따라 실행 시간에 편차가 발생할 수 있기 때문에, 단일 제출 결과만으로 두 코드의 성능을 비교하기에는 한계가 있다.

또한 **Big-O와 실제 하드웨어에서의 동작은 다르다.** Big-O는 입력 크기가 증가함에 따라 알고리즘의 실행 시간이나 공간 사용량이 어떻게 증가하는지를 나타내는 점근적 지표이지, 특정 입력 크기에서의 절대적인 실행 속도를 보장하는 것은 아니다.

그렇다고 해서 **Space Complexity 개선이 의미 없는 것은 아니다.** 입력 배열의 크기가 수백만 개 이상으로 커진다면 불필요하게 사용하는 메모리의 차이가 실제 성능 차이로 이어질 수 있다. 따라서 당장의 실행 결과에서 큰 차이가 나타나지 않더라도, 불필요한 메모리 할당을 줄이는 것은 여전히 의미 있는 최적화이며 좋은 코딩 습관이라고 생각한다.

이번 문제를 계기로 **JVM Warm-up과 JIT 컴파일이 실제 실행 성능에 어떤 영향을 미치는지** 궁금해졌고, 이를 조금 더 자세히 알아보게 되었다.


---

# JVM

JVM(Java Virtual Machine)은 자바 바이트코드를 실행하기 위한 가상 머신으로, 물리적인 컴퓨터처럼 메모리와 실행 환경을 소프트웨어로 구현한 것이다. JVM은 자바 애플리케이션을 클래스 로더를 통해 읽어 들여 자바 API와 함께 실행한다.

JVM은 Java 프로그램과 운영체제 사이에서 중개자 역할을 수행하여, 동일한 바이트코드를 다양한 운영체제에서 실행할 수 있도록 한다. 그리고 메모리관리, Garbage collection을 수행한다.

**JVM에 대해 알아야 하는 이유는 한정된 메모리를 효율적으로 사용하여 최고의 성능을 내기 위해서** 이다. 메모리 효율성을 위해 메모리 구조를 알아야 한다. 동일한 기능의 프로그램이더라도 메모리 관리에 따라 성능이 좌우된다. 메모리 관리가 되지 않은 경우 속도저하 현상이나 튕김 현상 등이 일어날 수 있다.

### JVM의 구조
<img src="/img/posts/etc/jvm/1.png" alt="JVM 구조" width="800">
JVM은 크게 아래 4가지로 구성된다.

- 자바 인터프리터(interpreter)
- 클래스 로더(class loader)
- JIT 컴파일러(Just-In Time compiler)
- 가비지 컬렉터(garbage collector)

### JVM의 작동 방식
JVM은 다음과 같은 과정을 거치며 애플리케이션이 시작할 때 진행된다.

```
Java Source Code
      ↓ javac
   Bytecode
      ↓
     JVM
   ┌───────────────┐
   │ Interpreter   │ ──→ Bytecode를 직접 실행
   │       ↓       │
   │   Profiling   │
   │       ↓       │
   │ JIT Compiler  │ ──→ 자주 실행되는 코드를
   │               │     Machine Code로 컴파일
   └───────────────┘
          ↓
    Machine Code 실행
```
JVM은 Bytecode를 Interpreter를 통해 실행하는 동시에 실행 정보를 프로파일링하며, 자주 실행되는 코드(hot code)는 JIT Compiler가 Native Machine Code로 컴파일하여 더 빠르게 실행할 수 있도록 한다.

---

# Interpreter

자바 컴파일러에 의해 변환된 바이트코드를 인터프리터 방식으로 실행하는 것이 자바 인터프리터(Interpreter)이다. 원래 JVM에서는 인터프리터 방식만 사용하다가 성능 이슈가 발생해서 JIT 컴파일러를 추가해서 성능을 끌어올렸다. 현재는 컴파일과 인터프리터 방식을 병행해서 사용한다.

---

# JIT Compiler

인터프리터 방식의 단점을 보완하기 위해 도입된 것이 JIT 컴파일러이다. 코드가 한번만 실행된다면 컴파일해서 컴파일된 코드를 한번만 실행하는 것보다 자바 바이트코드를 인터프리트하는 편이 더 빠르다. 즉, 코드가 실행될수록, JVM은 다양한 실행 프로파일 정보를 수집하고, 이를 기반으로 JIT가 점진적으로 최적화를 적용해간다.

```
              ┌─→ Interpreter ──→ 실행
Bytecode ─────┤
              │
              └─→ JIT Compiler ─→ Machine Code ─→ 실행
```

## JIT 컴파일러의 작동 방식

JIT 컴파일러는 기본적으로 Tiered Compilation이라는 메커니즘을 사용하여 최적화를 진행한다. 즉, 자주 실행되는 코드일수록 더 높은 Tier에서 더욱 정교한 최적화가 이루어진다. 이때 컴파일 단위는 주로 메소드 단위이며, 네이티브 코드로 변환된다.

```
Java/Kotlin Bytecode
        ↓
   Interpreter
        ↓
 실행 횟수 증가
        ↓
   Tiered Compilation
        ↓
 ┌───────────────┐
 │ C1 Compiler   │ ← 빠른 컴파일, 비교적 적은 최적화
 └───────────────┘
        ↓
 실행 정보 축적
        ↓
 ┌───────────────┐
 │ C2 Compiler   │ ← 느린 컴파일, 강력한 최적화
 └───────────────┘
        ↓
최적화된 Native Code
```

## Tier 구조

C1과 C2는 JIT Compiler 안에서 서로 다른 수준의 최적화를 담당하는 컴파일러이다. Tier 3과 Tier 4는 컴파일 레벨이다. 일반적인 Tiered Compilation에서는 Tier 0에서 인터프리터로 실행을 시작하고, 실행 빈도와 프로파일링 정보를 바탕으로 C1과 C2 컴파일러를 활용해 점진적으로 최적화한다.

| Tier | 컴파일러 | 설명 |
|---|---|---|
| Tier 0 | 인터프리터 | 해석 실행 |
| Tier 1 | C1 | 프로파일링 없음 |
| Tier 2 | C1 | 제한적 프로파일링 |
| Tier 3 | C1 | 전체 프로파일링 |
| Tier 4 | C2 | 최대 최적화 |


## C1 Compiler

C1(Client Compiler)은 컴파일 속도가 빠른 대신 최적화 수준이 상대적으로 낮은 컴파일러이다. JVM이 어떤 메서드를 자주 실행하기 시작하면 빠르게 컴파일해서 Interpreter보다 효율적으로 실행할 수 있도록 한다.

### 특징

- 컴파일이 빠름
- 비교적 가벼운 최적화
- 빠르게 실행 가능한 Native Code 생성
- 프로파일링 정보를 수집하는 데 중요한 역할

## C2 Compiler

C2(Server Compiler)는 C1보다 컴파일에 더 많은 시간과 자원을 사용하면서 강력한 최적화를 수행한다. 코드가 계속해서 실행되면서 충분한 프로파일링 정보가 쌓이면 JVM은 해당 코드를 더 높은 수준으로 최적화할 수 있다.

모든 코드를 처음부터 C2로 컴파일하면 컴파일 비용이 너무 크다. 그렇다고 모든 코드를 Interpreter로 계속 실행하면 성능이 떨어질 수 있다. 그래서 다음과 같이 실행 빈도에 따라 점진적으로 최적화한다.

개념적으로 단순화하면 다음과 같이 실행 빈도와 프로파일링 정보에 따라 더 높은 수준의 최적화가 이루어진다고 볼 수 있다.

```
             실행 횟수 증가 →
             
Interpreter → C1 → C2
    │          │     │
    │          │     └─ 강력한 최적화
    │          └─────── 빠른 컴파일
    └────────────────── 초기 실행
```

### C1과 C2 비교

| 구분 | C1 | C2 |
|---|---|---|
| 목적 | 빠른 컴파일 | 강력한 최적화 |
| 컴파일 속도 | 빠름 | 상대적으로 느림 |
| 최적화 수준 | 상대적으로 낮음 | 높음 |
| 프로파일링 | 활용/수집 | 적극 활용 |
| 대상 | 비교적 덜 hot한 코드 | 매우 hot한 코드 |
| 역할 | 빠르게 성능 개선 | 장기적인 성능 최적화 |


## JIT 컴파일 설정 확인하기

JVM이 JIT 컴파일을 어떻게 수행할지 결정하는 설정값을 확인하는 명령어이다.

```
java -XX:+PrintFlagsFinal -version | grep -i compile
```

<img src="/img/posts/etc/jvm/2.png" alt="JIT 컴파일 설정 확인하기" width="800">

---

# JVM에서 웜업이 필요한 이유

JVM 웜업이란 프로그램을 실행하면서 어떤 코드가 자주 실행되는지 파악하고 JIT Compiler가 최적화할 수 있도록 충분히 실행시키는 과정이다.

JVM에서 웜업이 반드시 필요한 이유는 JVM의 런타임 특성과 관련이 있다. JVM은 JIT (Just-In-Time) 컴파일러와 동적 클래스로딩 등을 통해 최적화를 수행하며, 이러한 최적화가 이루어지기 전까지 애플리케이션 성능이 저하될 수 있기 때문이다.

일반적으로 JVM 애플리케이션의 초기 성능 안정화에는 JIT 컴파일뿐만 아니라 클래스 로딩, 애플리케이션 초기화, GC 등의 요인도 영향을 줄 수 있다.

### 웜업 시, 이점

- 초기 요청 지연 감소
- 안정적인 성능 제공
- 애플리케이션의 신뢰성 향상

### 웜업이 필요한 상황

- 대규모 트래픽 처리
- API 응답 시간이 중요한 애플리케이션
- 대기 시간이 중요한 배치 시스템

### 애플리케이션 Warm-up 시 고려할 사항
- JIT 최적화가 필요한 코드 식별
- 자주 사용되는 클래스와 메서드 미리 호출
- 데이터베이스와 캐시 초기화 상태 확인
- 외부 의존성(API, 메시지 브로커, 파일 스토리지 등) 상태 점검
- GC 성능 확인

## 웜업 효과 확인하기

```
public class Main {

    static class HeavyComputation {

        int compute(int input) {
            int sum = 0;

            for (int i = 1; i <= 10_000; i++) {
                sum += i * input;
            }

            return sum;
        }
    }

    static void measure(String name, HeavyComputation computation) {
        long start = System.nanoTime();

        for (int i = 0; i < 100; i++) {
            computation.compute(i);
        }

        long end = System.nanoTime();

        System.out.println(
            name + ": " + (end - start) / 1_000_000.0 + " ms"
        );
    }

    public static void main(String[] args) {

        HeavyComputation computation = new HeavyComputation();

        // Measure before explicit warm-up
        System.out.println("=== Before explicit warm-up ===");
        measure("Run 1", computation);

        // Explicit warm-up
        System.out.println("\n=== Explicit warm-up ===");

        for (int i = 0; i < 10_000; i++) {
            computation.compute(i % 100);
        }

        // Measure after explicit warm-up
        System.out.println("\n=== After explicit warm-up ===");

        for (int i = 0; i < 5; i++) {
            measure("Run " + (i + 1), computation);
        }
    }
}
```

<img src="/img/posts/etc/jvm/3.png" alt="웜업 효과 확인하기" width="400">

명시적인 Warm-up을 수행하기 전에는 초기 실행 비용 등의 영향으로 3.23ms가 측정되었지만, Warm-up 이후에는 약 0.57ms 수준으로 실행 시간이 안정화되었다. 이는 JVM이 코드를 실행하면서 프로파일링하고 JIT 컴파일 및 최적화를 수행하기 때문에 초기 실행과 이후 실행의 성능이 달라질 수 있음을 보여준다.

---

# 결론

지금까지 살펴본 용어들을 정리하면 다음과 같다.

| 용어 | 역할 |
|---|---|
| Interpreter | JVM Bytecode를 해석하여 실행 |
| JIT Compiler | 자주 실행되는 Bytecode를 Native Code로 컴파일하고 최적화 |
| Warm-up | JIT가 최적화할 수 있도록 코드가 충분히 실행되는 과정 |
| Hot Code / Hot Method | JVM이 자주 실행되는 것으로 판단한 코드 |

JVM의 클래스 로딩은 **지연 로딩(Lazy Loading)** 방식으로 동작한다. 애플리케이션 실행 시 모든 클래스를 한꺼번에 로딩하는 것이 아니라, 실제로 해당 클래스가 필요해지는 시점에 로딩한다. 따라서 애플리케이션이 실행된 이후 처음 사용되는 클래스가 있다면, 해당 시점에 추가적인 클래스 로딩이 발생할 수 있다.

JVM Warm-up은 실제 성능을 측정하기 전에 코드를 반복적으로 실행하여 JIT Compiler가 코드를 최적화할 수 있도록 하는 과정이다. 이를 통해 실제 측정 구간에서 초기 실행 과정에서 발생하는 오버헤드의 영향을 줄일 수 있다.

| 적용 전                                                                                 | 적용 후                                                                                                                                      |
|--------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| 프로그램 실행<br>  ↓<br>초기화 + 클래스 로딩<br>  ↓<br>JIT 컴파일/최적화<br>  ↓<br>실제 코드 실행<br>  ↓<br>측정 | 프로그램 실행<br>  ↓<br>초기화<br>  ↓<br>JIT 웜업<br>  ↓<br>JIT 컴파일/최적화 유도<br>  ↓<br>──────────────<br>실제 측정 시작<br>  ↓<br>최적화된 코드 실행<br>  ↓<br>측정 종료 |

처음에는 코드를 개선하면서 **Space Complexity를 줄였음에도 LeetCode의 성능 측정 결과에서 눈에 띄는 차이가 나타나지 않는 이유**가 궁금해서 시작한 글이었다. LeetCode의 실행 시간과 메모리 측정에는 여러 요인이 영향을 줄 수 있고, 특히 Java는 JVM의 JIT 컴파일과 실행 환경에 따라 측정 결과가 달라질 수 있다는 것을 알게 되었다.

덕분에 이번 기회에 JVM의 구조와 동작 과정에 대해 더 깊이 알아볼 수 있었다. 특히 JVM의 지연 로딩을 살펴보면서 **N+1 문제에서의 지연 로딩**과 연결해서 생각해볼 수 있었고, JVM의 Warm-up을 공부하면서 **Redis의 Cache Miss와 Cache Hit**의 개념까지 떠올려볼 수 있었다.

하나의 궁금증에서 시작했지만, 서로 다른 기술의 개념을 연결해서 생각해볼 수 있었던 점이 이번 학습에서 가장 재미있었던 부분이었다.


### 참고

[Gemini](https://gemini.google.com/)<br>
[ChatGPT](https://chatgpt.com/)<br>
[Claude.ai](https://claude.ai/)<br>
[배포 직후 발생하는 응답 지연을 해결하기 위한 여정 (feat. JVM 웜업)](https://tech.kakaopay.com/post/jvm-warm-up/)<br>
[JVM 어플리케이션 웜업(Warm-up)](https://velog.io/@brunchkim/JVMWarmup)<br>
[How to Warm Up the JVM](https://www.baeldung.com/java-jvm-warmup)<br>
[자바의 JIT 컴파일러와 JVM 워밍업 이해하기](https://f-lab.kr/insight/understanding-jit-compiler-and-jvm-warmup-20260301)<br>
[Java - JVM 구성 요소와 역할 정리! (+ JIT 컴파일러, 인터프리터, 클래스...](https://jaehoney.tistory.com/173)<br>
[Compiler vs Interpreter(+JIT vs Interpreter), 정적 vs 동적](https://m.blog.naver.com/PostView.naver?isHttpsRedirect=true&blogId=parkjy76&logNo=220199093415)<br>
[[Java] JIT 컴파일러란?](https://hyeinisfree.tistory.com/26)<br>
[JVM Warm-up 개선 (feat. JIT Compiler)](https://jobc.tistory.com/235)<br>
[API 호출식 웜업의 부작용을 넘어서 : 라이브러리만 데우는 JVM 웜업](https://d2.naver.com/helloworld/1580651)<br>
[컴파일러와 인터프리터, 그리고 JIT 컴파일](https://velog.io/@bcj0114/%EC%BB%B4%ED%8C%8C%EC%9D%BC%EB%9F%AC%EC%99%80-%EC%9D%B8%ED%84%B0%ED%94%84%EB%A6%AC%ED%84%B0-%EA%B7%B8%EB%A6%AC%EA%B3%A0-JIT-%EC%BB%B4%ED%8C%8C%EC%9D%BC)<br>
[[JVM] JIT 컴파일러(Just-In Time Compiler)의 다양한 최적화 기술들 알아보기(Optionazation techniques)](https://mangkyu.tistory.com/343)<br>
[Java 동작원리 및 개념](https://velog.io/@dkwktm45/Java-%EB%8F%99%EC%9E%91%EC%9B%90%EB%A6%AC-%EB%B0%8F-%EA%B0%9C%EB%85%90)