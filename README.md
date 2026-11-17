# Meta Ads Office Starter Kit

Meta 광고 연결, 성과 조회, 소재 접수, 미게재 초안과 Meta 미리보기용 Vercel + Supabase 시작 템플릿입니다. 원래 Agent Office에서 해당 기능만 분리한 재사용용 패키지입니다.

## 이 패키지에 포함된 것

- Supabase 이메일 로그인과 허용 이메일 목록
- Meta OAuth 연결 및 사용자별 암호화 토큰 저장
- Meta 광고 계정의 기간별 성과와 최근 7일 저장 보고서
- 이미지 소재 접수, 광고 설정 폼, 취소/초기화
- Meta에 미게재 초안을 만들고 실제 지면 미리보기를 조회하는 흐름
- Codex용 설치·운영 스킬

실제 게재 버튼은 템플릿에 포함되어 있습니다. 초안 작성과 미리보기만 이용할 경우 버튼을 누르지 마세요. 광고를 실제로 게재하면 광고 계정에 변경 및 비용이 발생할 수 있습니다.

## 빠른 시작

1. 이 저장소의 `app-template/` 내용을 새 GitHub 저장소로 복사합니다.
2. Vercel에서 그 저장소를 배포하고 프로젝트 환경변수를 `.env.example` 기준으로 설정합니다.
3. Supabase에서 `supabase/migrations/0001_meta_ads_office.sql`을 실행하고 이메일 사용자를 초대합니다.
4. Meta 개발자 앱의 OAuth 리디렉션 URI를 `https://<배포 도메인>/api/meta/callback`으로 등록하고 필요한 권한·앱 검수를 마칩니다.
5. 배포된 사이트에서 이메일로 로그인한 뒤 Meta 광고 계정을 연결합니다.

자세한 과정과 Meta 앱 요구사항은 [`app-template/SETUP.md`](app-template/SETUP.md)를 확인하세요. Meta 앱, Supabase, Vercel은 각 사용자의 계정으로 직접 설정해야 합니다. 이 저장소는 누구의 자격증명도 제공하지 않습니다.

## Codex 스킬 설치

저장소 루트에서 Codex CLI를 사용하는 경우:

```sh
gh skill install <owner>/<repository> meta-ads-office-setup --agent codex --scope user
```

또는 `.agents/skills/meta-ads-office-setup/` 폴더를 대상 프로젝트의 `.agents/skills/` 아래 복사합니다. 이는 Codex의 개발 안내를 설치하는 것이며 앱 배포나 Meta 계정 연결은 별도입니다.

## 구조

- `app-template/`: 독립 실행형 웹 앱 원본
- `.agents/skills/meta-ads-office-setup/`: Codex 스킬

## 안전 및 범위

템플릿에는 개인 광고 계정, 페이지, 픽셀, 이메일, GA4, OAuth 비밀키, 운영 DB 자료를 넣지 않습니다. Meta 토큰은 서버에서 암호화하고 Supabase 서버 권한으로만 저장합니다. `.env.example`은 빈 설정 이름만 제공합니다.

## 참고

- [Codex Skills 안내](https://developers.openai.com/plugins/concepts/skills)
- [Codex CLI의 GitHub 스킬 설치](https://developers.openai.com/api/reference/cli)
