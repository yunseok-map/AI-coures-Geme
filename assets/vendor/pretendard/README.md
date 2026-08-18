# Pretendard (조각)

이 게임 화면에 실제로 나오는 글자만 남긴 Pretendard 가변 폰트다.

| | |
|---|---|
| 원본 | [orioncactus/pretendard](https://github.com/orioncactus/pretendard) **v1.3.9** `dist/web/variable/woff2/PretendardVariable.woff2` (2,057,688 B) |
| 라이선스 | SIL Open Font License 1.1 — 원문은 같은 폴더 `OFL.txt` |
| 이 폴더의 파일 | `PretendardVariable.subset.woff2` **158,452 B** · 글리프 953개 · 굵기축 `wght 45~930` |
| 덮는 글자 | 861자 — `covered.txt` |

원본 2MB 를 그대로 넣으면 사내망 첫 로딩에서 체감된다. 굵기축이 살아 있으므로
Regular/Bold 를 따로 받지 않고 이 파일 **하나**로 45~930 굵기를 다 쓴다.

## 왜 이름을 안 바꿨나

자형·메트릭·굵기축은 원본 그대로고 **쓰지 않는 글리프만 덜어냈다.** 원저작자가
공식 배포하는 dynamic-subset 파일도 같은 이름(`Pretendard Variable`)을 쓴다.
라이선스 원문(`OFL.txt`)을 같이 넣었고, 폰트 파일 안의 name 항목 0·7·13·14
(저작권·상표·라이선스·라이선스 URL)도 지우지 않고 남겼다.

## 글자를 추가했으면 폰트를 다시 만들어야 한다

**한글 문구를 새로 쓰면 그 음절이 이 조각에 없을 수 있다.** 없으면 그 글자만
맑은 고딕으로 나와서 한 단어 안에서 글꼴이 섞인다 — 화면에서 바로 티가 난다.

그걸 사람이 눈으로 찾지 않도록 검사가 있다:

```
node _tests/test-font.mjs
```

빠진 글자를 그대로 찍어 준다. 찍혔으면 아래 순서로 다시 만든다.

## 다시 만드는 순서

fonttools 가 필요하다. 이 PC 에는 이미 넣어 뒀다(`python -m pip install --user fonttools brotli`).

```sh
# 1) 화면에 나가는 글자 목록을 뽑는다 (저장소 루트에서)
node _tests/font-chars.mjs > chars.txt

# 2) 원본을 받는다 — jsDelivr 의 npm 경로만 이 파일을 갖고 있다.
#    gh 경로(cdn.jsdelivr.net/gh/...)에는 없다. 404 가 오면 경로를 잘못 본 것이다.
curl -o PretendardVariable.woff2 \
  https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/woff2/PretendardVariable.woff2

# 3) 잘라낸다
python -m fontTools.subset PretendardVariable.woff2 \
  --text-file=chars.txt --flavor=woff2 --no-hinting --desubroutinize \
  --name-IDs+=0,7,13,14 \
  --output-file=assets/vendor/pretendard/PretendardVariable.subset.woff2

# 4) covered.txt 를 새 폰트에서 다시 뽑는다 (검사가 이 파일을 본다)
python -c "from fontTools.ttLib import TTFont; \
f=TTFont('assets/vendor/pretendard/PretendardVariable.subset.woff2'); \
cm=set().union(*[set(t.cmap) for t in f['cmap'].tables]); \
open('assets/vendor/pretendard/covered.txt','w',encoding='utf-8')\
.write(''.join(sorted(c for c in open('chars.txt',encoding='utf-8').read() if ord(c) in cm)))"

# 5) 검사
node _tests/run-all.mjs
```

`chars.txt` 는 저장소에 넣지 않는다 — 언제든 1번으로 다시 만들 수 있다.

## Pretendard 에 아예 없는 글자

원본에도 없어서 조각에 넣을 수 없는 것들이다. 이 넷은 시스템 글꼴로 나온다.

| 글자 | 유니코드 | 어디에 |
|---|---|---|
| `▌` | U+258C | `.log__line--now` 의 커서 |
| `▸` | U+25B8 | `.log__line--read` 의 앞머리 |
| `✕` | U+2715 | `.part--evicted` 의 밀려남 표시 |
| `⊃` | U+2283 | (없앨 것) 용어 설명의 포함 기호 |

앞의 셋은 각자 자기 칸(`::before`)에만 있는 기호라서 글꼴이 달라도 한 단어가
쪼개지지 않는다. 그래서 그냥 둔다. 넷째는 한국어 문장 **안에** 있어서 눈에 띈다 —
기호를 쓰지 말고 우리말로 풀어 쓴다.
