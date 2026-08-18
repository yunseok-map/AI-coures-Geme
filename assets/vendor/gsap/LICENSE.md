# GSAP

Copyright (c) 2008-2025, GreenSock. All rights reserved.

GSAP is distributed under GreenSock's standard "no charge" license:
<https://gsap.com/standard-license>

## 여기 들어 있는 것

| 파일 | 크기 | 무엇 |
|---|---|---|
| `gsap.esm.js` | 70,182 B | 코어 |
| `Flip.esm.js` | 24,204 B | 물건이 A자리에서 B자리로 옮겨가는 연출 |
| `SplitText.esm.js` | 6,980 B | 글자를 한 자씩 세우는 연출 |
| `DrawSVGPlugin.esm.js` | 4,060 B | 선이 끝에서 끝으로 **그어지는** 연출 (배선·증거판) |
| `CustomEase.esm.js` | 6,641 B | 이 게임 전용 곡선(`swift` · `settle`) |


버전 **3.13.0**. jsDelivr 가 만든 ESM 묶음을 받아 저장소에 넣었다 —
빌드 단계 없이 `import` 로 바로 쓰기 위해서다.
받은 주소는 `https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm` 와 같은 꼴이다
(`/Flip/+esm` · `/SplitText/+esm` · `/DrawSVGPlugin/+esm` · `/CustomEase/+esm`).

**받은 뒤 `//# sourceMappingURL=` 주석을 지운다.** 그 줄이 남아 있으면 개발자도구를 여는
순간 브라우저가 jsDelivr 로 소스맵을 받으러 나간다 — 외부 요청 0건이 깨진다.
**CDN 을 가리키지 않는다.** 파일은 저장소 안에 있고 상대경로로만 불린다.

## 이 라이선스로 무엇이 되고 무엇이 안 되나

- 상업적 사용 **된다.** 예전에 유료였던 플러그인(SplitText 등)도 무료다.
- **오픈소스 라이선스는 아니다** (OSI 인증 아님). 무료로 쓸 수 있는 사용 허가다.
- 금지되는 것은 "코드 없이 애니메이션을 만드는 도구"를 만들어 Webflow 와 경쟁하는 것이다.
  이 저장소는 교육용 웹게임이라 해당하지 않는다.
- 파일 안의 저작권 표기를 지우지 않는다.

라이선스 원문은 위 주소에서 확인한다 — 여기 옮겨 적으면 원문이 바뀌었을 때
이 파일만 낡은 채로 남는다.
