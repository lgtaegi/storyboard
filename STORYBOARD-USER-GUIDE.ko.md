# AI Story Builder 사용설명서

Created: 2026-04-22 America/Denver  
Created by lgtaegi

## 개요

이 문서는 스토리보드 툴을 사용할 때,
- 아이디어 생성
- 스토리 생성
- 유튜브 업로드용 내용 생성
- 저장
- 업로드용 보관
- AI 모델 관리

까지 한 번에 따라갈 수 있도록 정리한 사용설명서야.

이 앱은 주로 아래 용도로 설계되어 있어:
- 숏폼 AI 비디오 아이디어 만들기
- 씬 단위 스토리보드 생성
- 레퍼런스 스크립트 구조 빌려오기
- 유튜브 업로드용 제목/설명/태그 만들기
- 로컬 저장과 업로드 대기용 분리 저장

## 앱 실행 방법

1. Ollama 앱을 연다
2. `check-requirements.command` 실행
3. `start.command` 실행
4. 브라우저에서 [http://127.0.0.1:5055](http://127.0.0.1:5055) 열기

## 가장 기본적인 사용 순서

가장 쉬운 기본 흐름은 이거야:

1. `Character` 입력
2. 필요하면 `Object keyword` 입력
3. 필요하면 `Set` 입력
4. `Genre`와 `Mood` 선택
5. `Generate Idea` 클릭
6. `Create AI Story` 클릭
7. `Generate YouTube Upload Content` 클릭
8. `Save name` 확인
9. `Save Story` 또는 `Send to Upload` 클릭

## 각 입력칸 설명

### Character

주인공이나 중심 대상을 적는 칸이야.

예:
- `Among Us Pink`
- `Among Us Yellow`
- `A nervous astronaut`

비워두면 모델이 스스로 주인공을 만들 수 있어.

### Object keyword

여기에 오브젝트를 직접 입력하면, 이 물건이 스토리와 제목 생성에서 최우선이 돼.

예:
- `face mask`
- `rubber chicken toy`
- `soap dish`

이 칸이 비어 있으면:
- 앱이 먼저 완전 랜덤 오브젝트를 하나 고르고
- 그 다음 선택한 `Mood`가 그 오브젝트를 중심으로 이야기 톤을 만든다

### Set

주요 장소나 환경을 적는 칸이야.

예:
- `spaceship bathroom`
- `old supermarket aisle`
- `foggy playground at night`

비워두면, 아이디어나 생성된 이야기 안에서 장소를 만들어 쓴다.

### Art Style

비주얼 방향을 정하는 칸이야.

사용 가능한 방식:
- `2D Animation`
- `Live-Action`
- `Custom`
- `Saved Art Style`

아트 스타일은 저장하고 다시 불러올 수도 있어.

## Generate Idea

`Generate Idea`는 짧은 한 줄 아이디어를 만든다.

현재 동작 방식:
- 하나의 중심 오브젝트를 유지하려고 한다
- `Object keyword`가 비어 있으면 오브젝트를 먼저 랜덤으로 고른다
- `Mood`가 사건의 톤을 결정한다
- 일부러 말도 안 되는 방식으로 오브젝트를 쓰는 아이디어도 허용한다

예:
- face mask를 우주선 조종 장치처럼 씀
- rubber chicken toy를 명품 패션 소품처럼 씀
- soap dish를 trampoline처럼 씀

## Create AI Story

`Create AI Story`는 현재 설정을 바탕으로 시간 순서가 있는 스토리보드 씬들을 만든다.

가능한 한 유지하려는 요소:
- 선택한 캐릭터
- 선택한 오브젝트
- 선택한 장소
- 선택한 아트 스타일
- 선택한 장르와 무드

일부 값이 비어 있으면, 이야기 흐름 안에서 필요한 요소를 채운다.

## Reference Script

`Show reference script`를 누르면 열 수 있어.

안에는 아래 옵션이 들어 있어:
- `Reference script`
- `Reference strength`
- `Always keep my settings first`

### Reference strength

- `0`: 레퍼런스 사용 안 함
- `1–30`: 가볍게 참고
- `31–60`: 적당히 참고
- `61–85`: 강하게 참고
- `86–99`: 아주 강하게 참고
- `100`: 거의 원본 구조 그대로 재현

### Always keep my settings first

이 옵션을 켜면:
- 캐릭터 우선
- 오브젝트 우선
- 장소 우선
- 아트 스타일 우선

이 옵션을 끄면:
- 레퍼런스가 더 강하게 전체 구조를 끌고 갈 수 있어

예를 들면:
- 레퍼런스에서 누군가가 face mask를 얼굴에 붙이는 장면이 있고
- 네 오브젝트가 `rubber chicken toy`라면
- 레퍼런스 강도가 높을 때 rubber chicken toy를 얼굴에 붙이는 이상한 장면으로 바뀔 수 있어

이런 비상식적인 치환은 일부러 허용하는 거야. 웃기고 강한 훅이 될 수 있으니까.

## Generate YouTube Upload Content

이 버튼은 아래 내용을 만든다:
- YouTube 제목
- 설명
- 키워드/태그

이 결과는 Save name 제목 검증에도 사용돼.

## Save name 규칙

현재 Save name은 대략 이런 순서로 결정돼:

1. `Object keyword`가 있으면 그걸 먼저 사용
2. 없으면 이야기에서 사건을 처음 일으키는 핵심 오브젝트를 추정
3. 그 오브젝트가 YouTube 업로드 내용과 맞는지 확인
4. 같은 오브젝트를 가리키면 그 일치된 이름을 우선 사용
5. 명확한 오브젝트를 찾지 못하면 저장을 막고 안내 문구를 보여줌

목표는:
- 웃긴 문장 전체가 아니라
- 가장 중요한 핵심 사물 이름 1~2단어를 뽑는 것

예:
- `Soap Dish`
- `Toy Dinosaur`
- `Face Mask`
- `Traffic Cone`

## Save Story 와 Send to Upload 차이

### Save Story

일반 저장용이야.

저장 위치:
- `data/`

### Send to Upload

업로드 대기용 저장이야.

저장 위치:
- `upload-stories/`

즉 앱 안에는 두 개의 저장 리스트가 따로 있어:
- `Saved Storys`
- `Upload Storys`

## Revert Story

`Revert Story`는 현재 세션 안에서 이전 상태로 되돌린다.

이럴 때 유용해:
- 새로 생성한 결과가 더 별로일 때
- 직전 상태가 더 좋았을 때
- 다시 쉽게 되돌아가고 싶을 때

## AI Model 관련 기능

### 메인 AI model 선택기

실제로 스토리 생성에 쓰이는 설치된 모델을 고르는 곳이야.

### Show advanced model tools

이 안에는:
- 설치된 모델 관리
- 추천 모델 리스트
- 커스텀 모델 설치

기능이 들어 있어.

### Installed model manager

여기서는:
- 설치된 모델 업데이트
- 설치된 모델 삭제

를 할 수 있어.

### Recommended newer models

추천 모델 리스트는:
- `recommended-models.json`

에서 읽어온다.

### Custom model tag

직접 모델 이름을 입력해서 설치하는 칸이야.

예:
- `qwen3:latest`
- `gemma3:latest`
- `deepseek-r1:latest`

## 대형 모델 경고

일부 모델은 작은 Mac에서는 너무 무거울 수 있어.

예:
- `llama3.3`은 16GB Mac에서 상호작용용으로는 너무 느릴 수 있음

느리면:
- 더 작은 모델로 바꾸거나
- advanced model tools에서 삭제하는 게 좋아

## 언어 변환

`Convert Script`는 스토리보드를 영어/한국어로 바꾸는 기능이야.

가장 좋은 사용 순서는:
1. 이야기 생성
2. 씬 내용 확인
3. 그 다음 변환

## 추천 사용 방식

### 랜덤 오브젝트 아이디어 방식

1. `Object keyword`를 비운다
2. `Mood`를 선택한다
3. `Generate Idea`
4. `Create AI Story`

이 방식은 랜덤 오브젝트 하나를 먼저 고르고, 무드가 그걸 중심으로 이야기를 만든다.

### 제품 중심 방식

1. `Object keyword` 입력
2. `Character` 입력
3. `Set` 입력
4. `Generate Idea`
5. `Create AI Story`

제품이나 오브젝트가 중요할 때 좋다.

### 레퍼런스 중심 방식

1. 레퍼런스 스크립트 붙여넣기
2. `Reference strength` 설정
3. `Always keep my settings first` 켤지 결정
4. 이야기 생성

이 방식은:
- 샷 구조
- 카메라 문법
- 연출 흐름

을 강하게 가져오고 싶을 때 좋다.

## 문제가 있을 때

### Save name이 이상할 때

이 순서대로 보면 좋아:
- `Object keyword`가 맞는지 확인
- YouTube 업로드 내용 다시 생성
- 아이디어 다시 생성
- 스토리 다시 생성

### 모델이 너무 느릴 때

메인 AI model에서 더 작은 모델을 사용해.

### Reference 100%가 너무 원본 그대로일 때

아래 값으로 낮춰봐:
- `60`
- `75`
- `85`

## 주요 로컬 폴더

- `data/` — 일반 저장 스토리
- `upload-stories/` — 업로드 대기용 스토리
- `auto-generated/` — 자동 저장된 생성 결과
- `art-styles/` — 저장된 아트 스타일
- `app-settings/` — 앱 설정 저장
- `versions/` — 로컬 백업 폴더

## 마지막 메모

- 이 앱은 로컬 중심으로 설계돼 있어
- 빠른 반복에는 작은 모델이 유리해
- 레퍼런스는 `100`일 때 가장 강하게 작동해
- 일부러 황당한 오브젝트 사용도 허용하는 구조야
- 가장 좋은 흐름은 보통 `idea -> story -> YouTube -> save -> upload queue` 야
