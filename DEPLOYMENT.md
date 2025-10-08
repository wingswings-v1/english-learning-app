# 🚀 배포 가이드

## 1. Netlify 배포 (추천)

### 방법 1: 드래그 앤 드롭 (가장 간단)
1. [netlify.com](https://netlify.com)에 가입/로그인
2. 대시보드에서 "Sites" 클릭
3. "Add new site" → "Deploy manually"
4. `build` 폴더를 드래그 앤 드롭으로 업로드
5. 배포 완료! 자동으로 URL 생성됨

### 방법 2: GitHub 연동 (자동 배포)
1. GitHub에 코드 푸시
2. Netlify에서 "New site from Git" 선택
3. GitHub 저장소 연결
4. 빌드 설정:
   - Build command: `npm run build`
   - Publish directory: `build`
5. "Deploy site" 클릭

### 방법 3: Netlify CLI
```bash
# Netlify CLI 설치
npm install -g netlify-cli

# 로그인
netlify login

# 배포
netlify deploy --prod --dir=build
```

## 2. Vercel 배포

### 방법 1: Vercel 웹사이트
1. [vercel.com](https://vercel.com)에 가입/로그인
2. "New Project" 클릭
3. GitHub 저장소 연결 또는 폴더 업로드
4. 자동으로 React 앱 감지 및 배포

### 방법 2: Vercel CLI
```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel --prod
```

## 3. GitHub Pages 배포

### package.json 수정
```json
{
  "homepage": "https://yourusername.github.io/english-learning-app"
}
```

### GitHub Actions 설정
`.github/workflows/deploy.yml` 파일 생성:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build
      run: npm run build
      
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./build
```

## 4. Firebase Hosting

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# Firebase 프로젝트 초기화
firebase init hosting

# 배포
firebase deploy
```

## 5. AWS S3 + CloudFront

1. S3 버킷 생성
2. `build` 폴더 내용을 S3에 업로드
3. CloudFront 배포 생성
4. HTTPS 설정

## 배포 후 확인사항

### ✅ 필수 확인
- [ ] HTTPS가 활성화되어 있는지 확인 (카메라 접근에 필요)
- [ ] 모바일에서 카메라 권한 요청이 정상 작동하는지 확인
- [ ] 모든 기능이 정상 작동하는지 테스트

### 🔧 환경 변수 (필요시)
```bash
# .env 파일 생성
REACT_APP_API_URL=https://your-api-url.com
```

### 📱 모바일 테스트
- 실제 모바일 기기에서 테스트
- 다양한 브라우저에서 테스트 (Chrome, Safari, Firefox)
- 카메라 권한 요청 테스트

## 추천 배포 순서

1. **Netlify** (가장 쉬움, 무료, HTTPS 자동)
2. **Vercel** (Netlify와 유사, 빠른 배포)
3. **GitHub Pages** (GitHub 사용자에게 적합)
4. **Firebase Hosting** (Google 서비스와 연동 시)

## 문제 해결

### 카메라 접근 오류
- HTTPS가 활성화되어 있는지 확인
- 브라우저에서 카메라 권한이 허용되어 있는지 확인

### 빌드 오류
```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 모바일에서 느린 로딩
- 이미지 최적화
- 코드 스플리팅 적용
- CDN 사용