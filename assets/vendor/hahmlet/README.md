# Hahmlet (조각) — 표제 글꼴

화면 **제목과 도장에만** 쓰는 글꼴이다. 본문은 Pretendard 그대로다.

| | |
|---|---|
| 원본 | [google/fonts `ofl/hahmlet`](https://github.com/google/fonts/tree/main/ofl/hahmlet) — `Hahmlet[wght].ttf` (3,559,144 B, 가변) |
| 만든 곳 | [hyper-type/hahmlet](https://github.com/hyper-type/hahmlet) |
| 라이선스 | SIL Open Font License 1.1 — 원문은 같은 폴더 `OFL.txt` |
| 이 폴더의 파일 | `Hahmlet-Bold.subset.woff2` **88,792 B** · 글리프 916개 · 굵기 **700 고정** |
| 덮는 글자 | 880자 — `covered.txt` |

## 왜 굵기가 하나뿐인가

가변 원본의 굵기축을 살려서 자르면 **173KB** 가 된다. 표제는 한 굵기로 충분해서
700 하나만 남겼다(89KB). 대신 `hahmlet.css` 의 `font-weight` 를 `100 900` 으로
적어 둔다 — 화면 쪽이 800·900 을 불러도 이 파일이 그대로 걸리고, 브라우저가
굵기를 흉내 내서 획을 부풀리지 않는다. 범위를 `700` 하나로 적으면 900 을 부르는
자리에서 **가짜 굵게**가 걸려 세리프가 뭉갠다.

## 왜 이 글꼴인가

후보 여섯을 실제 화면 글자(판 제목 17개 · 도장 · 시작 화면 제목)로 나란히 놓고
골랐다. 본문이 고딕이므로 표제도 고딕이면(Gothic A1 계열) **바꾼 티가 안 나면서
파일만 는다.** Hahmlet 은 획이 각지고 세리프가 자로 그은 것처럼 생겨서 이 화면이
가려는 도면 표제란 쪽에 맞고, 15px 로 줄여도 획이 안 뭉갠다. 탈락한 것들:

| 후보 | 왜 안 썼나 |
|---|---|
| Gothic A1 800 | Pretendard 와 갈래가 같아 나란히 놓아도 구별이 안 된다 |
| Black Han Sans | 굵기가 하나뿐이고, 작은 크기에서 속공간이 막혀 안 읽힌다 |
| Song Myung | 획이 가늘어 도장·제목에서 힘이 안 실린다 |
| Gowun Batang | 획 끝이 둥글어 책 쪽이다. 도면 화면과 안 맞는다 |
| Diphylleia | 작은 크기에서 사라진다 |

## 어디에 걸리나

`assets/tokens.css` 의 `--font-display`, 거는 자리는 `assets/styles.css` 한 곳에
모아 뒀다 — 화면 제목 · 시작 화면 제목 · 도장 · 등급 이름 · 실시간 판의 큰 알림.

**숫자에는 안 건다.** 계기판 숫자는 고정폭(`--font-mono`)이라야 자릿수가 안 흔들린다.
검사(`test-font.mjs`)가 숫자 자리에 표제 글꼴이 새어 들어갔는지 본다.

조각에 없는 기호(`★ ✓ ① ▌` 따위 10개)는 `--font-display` 뒤의 Pretendard 로
떨어진다. 그 기호들은 제목에 안 쓰이므로 그대로 둔다.

## 글자를 추가했으면 다시 만들어야 한다

본문 글꼴과 똑같다. `node _tests/test-font.mjs` 가 빠진 글자를 찍어 준다.
**한글·영숫자만 본다** — 기호는 위에 적은 이유로 안 본다.

```sh
# 1) 화면에 나가는 글자 목록 (저장소 루트에서) — 본문 글꼴과 같은 파일을 쓴다
node _tests/font-chars.mjs > chars.txt

# 2) 원본을 받는다
curl -sSL -o "Hahmlet[wght].ttf" \
  https://raw.githubusercontent.com/google/fonts/main/ofl/hahmlet/Hahmlet%5Bwght%5D.ttf

# 3) 굵기 700 으로 고정한 뒤
python -m fontTools.varLib.instancer "Hahmlet[wght].ttf" wght=700 -o Hahmlet-Bold.ttf

# 4) 잘라낸다
python -m fontTools.subset Hahmlet-Bold.ttf \
  --text-file=chars.txt --flavor=woff2 --no-hinting --desubroutinize \
  --name-IDs+=0,7,13,14 \
  --output-file=assets/vendor/hahmlet/Hahmlet-Bold.subset.woff2

# 5) covered.txt 를 새 폰트에서 다시 뽑는다 (검사가 이 파일을 본다)
python -c "from fontTools.ttLib import TTFont; \
f=TTFont('assets/vendor/hahmlet/Hahmlet-Bold.subset.woff2'); \
cm=set().union(*[set(t.cmap) for t in f['cmap'].tables]); \
open('assets/vendor/hahmlet/covered.txt','w',encoding='utf-8')\
.write(''.join(sorted(set(c for c in open('chars.txt',encoding='utf-8').read() if ord(c) in cm))))"

# 6) 검사
node _tests/run-all.mjs
```

**글자가 줄기만 했으면** 2·3번을 건너뛰고 지금 조각(`Hahmlet-Bold.subset.woff2`)을
입력으로 넣어 다시 자르면 된다. 인터넷이 필요 없다 — 본문 글꼴 README 의
같은 항목과 방법이 똑같다.
