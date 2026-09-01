# MemoPad

Electron 기반 크로스플랫폼 스티커 메모 앱. 데스크톱에 여러 개의 메모 창을 띄워두고, 목록 창에서 검색·태그 필터로 한눈에 관리한다.

## 주요 기능

- 색상별 스티커 메모, 태그 지정/검색
- 메모 창/목록 창 각각 "항상 위에 고정" 지원
- 메모별 글씨 크기, 목록 카드 글씨 크기 별도 설정
- 트레이 상주, 창을 모두 닫아도 백그라운드 유지
- 저장 실패 시 에러 배너 안내, 손상된 데이터 파일 자동 백업/복구

## 개발

```bash
npm install
npm run dev        # 개발 모드 실행
npm run typecheck  # 타입 체크 (main/preload/shared + renderer/shared/tests)
npm test           # 단위 테스트 (Vitest)
npm run build      # 프로덕션 빌드
npm run dist       # 배포용 패키징 (electron-builder)
```

## 스택

Electron, React 18, TypeScript, electron-store, Vite(electron-vite), Vitest
